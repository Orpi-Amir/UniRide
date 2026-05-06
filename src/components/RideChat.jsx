"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./RideChat.module.css";

function formatTime(timestamp) {
  try {
    return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function haversineDistanceKm(fromCoords, toCoords) {
  if (!Array.isArray(fromCoords) || !Array.isArray(toCoords)) return null;
  const [lat1, lng1] = fromCoords;
  const [lat2, lng2] = toCoords;
  if ([lat1, lng1, lat2, lng2].some((value) => typeof value !== "number")) return null;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function formatDistance(km) {
  if (typeof km !== "number" || Number.isNaN(km)) return "";
  if (km < 1) return `${Math.round(km * 1000)} m away`;
  return `${km.toFixed(1)} km away`;
}

function deriveSenderEmail(data) {
  const fromPayload = (data?.senderEmail || data?.sender || "").toLowerCase().trim();
  if (fromPayload.includes("@")) return fromPayload;
  return fromPayload;
}

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

/** Ably connection events vary by transport; poll state until connected or terminal failure. */
function waitForChatConnected(realtime, timeoutMs = 22000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    let timer = null;

    const finish = (fn) => {
      if (timer !== null) clearInterval(timer);
      timer = null;
      fn();
    };

    const tick = () => {
      const state = realtime.connection.state;
      if (state === "connected") {
        finish(() => resolve());
        return;
      }
      if (state === "failed" || state === "closed") {
        finish(() =>
          reject(
            new Error(
              realtime.connection.errorReason?.message || "Chat connection failed"
            )
          )
        );
        return;
      }
      if (state === "disconnected") {
        const reason = realtime.connection.errorReason;
        if (reason) {
          finish(() =>
            reject(new Error(reason.message || "Chat disconnected"))
          );
          return;
        }
      }
      if (Date.now() >= deadline) {
        finish(() => reject(new Error("Chat connection timed out")));
      }
    };

    tick();
    timer = setInterval(tick, 90);
  });
}

function messagePayloadFrom(itemData) {
  const sender = itemData?.sender || "";
  const type =
    itemData?.type ||
    (sender === "System" ? "system" : itemData?.coords ? "location" : "message");
  return {
    text: itemData?.text || "",
    type,
    coords: itemData?.coords || null,
    sender,
    senderEmail: deriveSenderEmail(itemData),
  };
}

export default function RideChat({ rideId, currentUserEmail, onError }) {
  const userEmail = (currentUserEmail || "").toLowerCase().trim();
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const [bootLoading, setBootLoading] = useState(true);
  const [channelReady, setChannelReady] = useState(false);
  const [initError, setInitError] = useState("");
  const [retryTick, setRetryTick] = useState(0);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sharingLocation, setSharingLocation] = useState(false);
  const [currentCoords, setCurrentCoords] = useState(null);
  const [connectionOk, setConnectionOk] = useState(false);
  const clientRef = useRef(null);
  const channelRef = useRef(null);
  const listRef = useRef(null);
  const tokenRef = useRef(null);

  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)),
    [messages]
  );

  const upsertMessage = (incoming) => {
    if (!incoming) return;
    setMessages((prev) => {
      const rawEmail = deriveSenderEmail({
        senderEmail: incoming.senderEmail,
        sender: incoming.sender,
      });
      const normalized = {
        id: incoming.id || `${incoming.sender}-${incoming.timestamp}-${incoming.text}`,
        text: incoming.text || "",
        type: incoming.type || "message",
        coords: incoming.coords || null,
        sender: incoming.sender || "Unknown",
        senderEmail: rawEmail,
        timestamp: incoming.timestamp || Date.now(),
      };
      const existingIndex = prev.findIndex((item) => item.id === normalized.id);
      if (existingIndex === -1) return [...prev, normalized];
      const next = [...prev];
      next[existingIndex] = normalized;
      return next;
    });
  };

  useEffect(() => {
    let mounted = true;
    let messageListener = null;
    const connectionHandlers = [];

    const fetchChatAuth = async () => {
      const authRes = await fetch(`/api/rides/${rideId}/chat-auth`, { cache: "no-store" });
      const authData = await authRes.json();
      if (!authData.success) throw new Error(authData.message || "Chat auth failed");
      if (authData.tokenRequest) tokenRef.current = authData.tokenRequest;
      return authData;
    };

    const init = async () => {
      if (mounted) {
        setBootLoading(true);
        setInitError("");
        setChannelReady(false);
        setConnectionOk(false);
      }

      try {
        const authData = await fetchChatAuth();

        const AblyModule = await import("ably");
        const Ably = AblyModule.default ?? AblyModule;

        const realtime = new Ably.Realtime({
          clientId: authData.ablyClientId,
          authCallback: async (_, callback) => {
            try {
              if (tokenRef.current) {
                const token = tokenRef.current;
                tokenRef.current = null;
                callback(null, token);
                return;
              }
              const tokenData = await fetchChatAuth();
              if (!tokenData.tokenRequest) {
                callback(new Error("Unable to authorize chat"));
                return;
              }
              callback(null, tokenData.tokenRequest);
            } catch (err) {
              callback(err instanceof Error ? err : new Error("Unable to authorize chat"));
            }
          },
        });

        await waitForChatConnected(realtime);

        const channel = realtime.channels.get(authData.channelName);
        await withTimeout(channel.attach(), 18000, "Could not open chat channel");

        clientRef.current = realtime;
        channelRef.current = channel;

        if (mounted) {
          setChannelReady(true);
          setConnectionOk(realtime.connection.state === "connected");
        }

        const syncConnectionUi = () => {
          if (!mounted) return;
          setConnectionOk(realtime.connection.state === "connected");
        };
        ["connected", "disconnected", "failed", "suspended", "closing"].forEach(
          (ev) => {
            realtime.connection.on(ev, syncConnectionUi);
            connectionHandlers.push([ev, syncConnectionUi]);
          }
        );

        channel.history({ limit: 50 }, (err, page) => {
          if (err || !mounted) return;
          const existingMessages = (page.items || []).map((item) => {
            const payload = messagePayloadFrom(item.data);
            return {
              id: item.id,
              ...payload,
              timestamp: item.timestamp || Date.now(),
            };
          });
          setMessages([]);
          existingMessages.forEach(upsertMessage);
        });

        messageListener = (msg) => {
          if (!mounted) return;
          const payload = messagePayloadFrom(msg.data);
          upsertMessage({
            id: msg.id,
            ...payload,
            timestamp: msg.timestamp || Date.now(),
          });
        };
        await channel.subscribe("message", messageListener);
      } catch (error) {
        const msg = error?.message || "Unable to load chat";
        if (mounted) {
          setInitError(msg);
          setConnectionOk(false);
        }
        onErrorRef.current?.(msg);
      } finally {
        if (mounted) setBootLoading(false);
      }
    };

    init();

    return () => {
      mounted = false;
      const client = clientRef.current;
      const chan = channelRef.current;
      if (chan && messageListener) {
        chan.unsubscribe("message", messageListener);
      }
      if (client) {
        connectionHandlers.forEach(([ev, fn]) => {
          client.connection.off(ev, fn);
        });
        client.close();
      }
      clientRef.current = null;
      channelRef.current = null;
      setChannelReady(false);
      setConnectionOk(false);
    };
  }, [rideId, retryTick]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [sortedMessages.length]);

  const canSendMessages = channelReady && connectionOk;

  const send = async (e) => {
    e.preventDefault();
    const content = text.trim();
    if (!content || !channelReady || !connectionOk || !channelRef.current) return;

    try {
      setSending(true);
      await channelRef.current.publish("message", {
        type: "message",
        text: content,
        sender: userEmail,
        senderEmail: userEmail,
      });
      setText("");
    } catch (err) {
      onError?.(err?.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const shareLocation = async () => {
    if (
      !channelRef.current ||
      sharingLocation ||
      !channelReady ||
      !connectionOk
    )
      return;
    if (!navigator?.geolocation) {
      onError?.("Geolocation is not supported in this browser");
      return;
    }

    try {
      setSharingLocation(true);
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 10000,
        });
      });
      const coords = [position.coords.latitude, position.coords.longitude];
      setCurrentCoords(coords);
      await channelRef.current.publish("message", {
        type: "location",
        text: "Shared location",
        coords,
        sender: userEmail,
        senderEmail: userEmail,
      });
    } catch {
      onError?.("Unable to share your current location");
    } finally {
      setSharingLocation(false);
    }
  };

  if (bootLoading && !channelReady && !initError) {
    return <div className={styles.empty}>Opening chat…</div>;
  }

  if (initError && !channelReady) {
    return (
      <div className={styles.chatShell}>
        <div className={styles.initErrorBox}>
          <p className={styles.initErrorText}>{initError}</p>
          <button
            type="button"
            className={styles.retryBtn}
            onClick={() => setRetryTick((t) => t + 1)}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const connectionLabel = connectionOk ? "Online" : channelReady ? "Reconnecting" : "Offline";

  return (
    <div className={styles.chatShell}>
      <div className={styles.toolbar}>
        <div className={styles.connectionDotWrap}>
          <span
            className={connectionOk ? styles.dotOnline : styles.dotOffline}
            title={connectionOk ? "Connected" : channelReady ? "Reconnecting to chat" : "Offline"}
          />
          <span className={styles.connectionLabel}>{connectionLabel}</span>
        </div>
        <button
          type="button"
          onClick={shareLocation}
          disabled={sharingLocation || !canSendMessages}
          className={styles.actionBtn}
        >
          {sharingLocation ? "…" : "Share location"}
        </button>
      </div>
      <div ref={listRef} className={styles.messages}>
        {sortedMessages.length === 0 ? (
          <div className={styles.empty}>No messages yet — say hello or confirm pickup details.</div>
        ) : (
          sortedMessages.map((msg) => {
            if (msg.type === "system") {
              return (
                <div key={msg.id} className={styles.rowSystem}>
                  <div className={styles.systemBubble}>
                    <div className={styles.systemText}>{msg.text}</div>
                    <div className={styles.meta}>{formatTime(msg.timestamp)}</div>
                  </div>
                </div>
              );
            }

            const own =
              msg.type !== "system" &&
              ((msg.senderEmail || "").toLowerCase().trim() === userEmail ||
                (!msg.senderEmail?.includes("@") && msg.sender === userEmail));
            const coords =
              Array.isArray(msg.coords) && msg.coords.length === 2 ? msg.coords : null;
            const mapsUrl = coords ? `https://www.google.com/maps?q=${coords[0]},${coords[1]}` : "";
            const label =
              msg.type === "location"
                ? own
                  ? "You shared a location"
                  : `${msg.sender} shared a location`
                : own
                  ? "You"
                  : msg.senderEmail?.includes("@")
                    ? msg.senderEmail
                    : msg.sender;

            return (
              <div key={msg.id} className={`${styles.row} ${own ? styles.rowOwn : ""}`}>
                <div className={`${styles.bubble} ${own ? styles.bubbleOwn : styles.bubbleOther}`}>
                  <div className={styles.sender}>{label}</div>
                  {msg.type === "message" ? <div className={styles.text}>{msg.text}</div> : null}
                  {msg.type === "location" && coords ? (
                    <div className={styles.locationMeta}>
                      Lat: {Number(coords[0]).toFixed(5)}, Lng: {Number(coords[1]).toFixed(5)}
                      {!own && currentCoords
                        ? ` • ${formatDistance(haversineDistanceKm(currentCoords, coords))}`
                        : ""}
                      <br />
                      <a className={styles.mapLink} href={mapsUrl} target="_blank" rel="noreferrer">
                        Open in Maps
                      </a>
                    </div>
                  ) : null}
                  <div className={styles.meta}>{formatTime(msg.timestamp)}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
      <form onSubmit={send} className={styles.composer}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            !channelReady
              ? "Opening chat…"
              : !connectionOk
                ? "Waiting to reconnect…"
                : "Write a message…"
          }
          className={styles.input}
          disabled={!canSendMessages}
        />
        <button
          type="submit"
          disabled={sending || !text.trim() || !canSendMessages}
          className={styles.sendBtn}
        >
          Send
        </button>
      </form>
    </div>
  );
}
