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

function formatDayLabel(timestamp) {
  try {
    const d = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const sameDay = (a, b) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
    if (sameDay(d, today)) return "Today";
    if (sameDay(d, yesterday)) return "Yesterday";
    return d.toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" });
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
  return (data?.senderEmail || data?.sender || "").toLowerCase().trim();
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
          finish(() => reject(new Error(reason.message || "Chat disconnected")));
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

function normalizeIncoming(itemData, fallback = {}) {
  const sender = itemData?.sender || fallback.sender || "";
  const type =
    itemData?.type ||
    fallback.type ||
    (sender === "System" ? "system" : itemData?.coords?.length === 2 ? "location" : "message");
  const senderEmail = deriveSenderEmail({
    senderEmail: itemData?.senderEmail,
    sender: itemData?.sender,
  });
  return {
    id: itemData?.id || fallback.id || `${sender}-${itemData?.timestamp || Date.now()}`,
    text: itemData?.text || "",
    type,
    coords: Array.isArray(itemData?.coords) ? itemData.coords : [],
    sender,
    senderEmail,
    timestamp: itemData?.timestamp || fallback.timestamp || Date.now(),
  };
}

export default function RideChat({ rideId, currentUserEmail, onError, locked = false, lockedMessage = "" }) {
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
      const normalized = {
        id: incoming.id || `${incoming.sender}-${incoming.timestamp}-${incoming.text}`,
        text: incoming.text || "",
        type: incoming.type || "message",
        coords: Array.isArray(incoming.coords) ? incoming.coords : [],
        sender: incoming.sender || "Unknown",
        senderEmail: deriveSenderEmail({
          senderEmail: incoming.senderEmail,
          sender: incoming.sender,
        }),
        timestamp: incoming.timestamp || Date.now(),
      };
      const existingIndex = prev.findIndex((item) => item.id === normalized.id);
      if (existingIndex === -1) return [...prev, normalized];
      const next = [...prev];
      next[existingIndex] = normalized;
      return next;
    });
  };

  // Load durable history from MongoDB on mount/rideId change
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setMessages([]);
    });
    (async () => {
      try {
        const res = await fetch(`/api/rides/${rideId}/messages`, { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        if (!data.success) {
          if (onErrorRef.current) onErrorRef.current(data.message || "Failed to load chat history");
          return;
        }
        if (Array.isArray(data.messages)) {
          setMessages(
            data.messages.map((m) => ({
              id: m.id,
              text: m.text || "",
              type: m.type || "message",
              coords: Array.isArray(m.coords) ? m.coords : [],
              sender: m.sender || "Unknown",
              senderEmail: deriveSenderEmail({ senderEmail: m.senderEmail, sender: m.sender }),
              timestamp: m.timestamp || Date.now(),
            }))
          );
        }
      } catch {
        if (cancelled) return;
        if (onErrorRef.current) onErrorRef.current("Network error while loading chat history");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rideId]);

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

        messageListener = (msg) => {
          if (!mounted) return;
          const incoming = normalizeIncoming(msg.data, {
            id: msg.id,
            timestamp: msg.timestamp || Date.now(),
          });
          upsertMessage(incoming);
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

  const send = async (e) => {
    e.preventDefault();
    if (locked || sending) return;
    const content = text.trim();
    if (!content) return;

    try {
      setSending(true);
      const res = await fetch(`/api/rides/${rideId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: content, type: "message" }),
      });
      const data = await res.json();
      if (!data.success) {
        onErrorRef.current?.(data.message || "Failed to send message");
        return;
      }
      // Optimistic insert in case Ably echo is slow / disconnected.
      if (data.message) upsertMessage(data.message);
      setText("");
    } catch {
      onErrorRef.current?.("Network error while sending message");
    } finally {
      setSending(false);
    }
  };

  const shareLocation = async () => {
    if (locked || sharingLocation) return;
    if (!navigator?.geolocation) {
      onErrorRef.current?.("Geolocation is not supported in this browser");
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
      const res = await fetch(`/api/rides/${rideId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "location", coords, text: "Shared location" }),
      });
      const data = await res.json();
      if (!data.success) {
        onErrorRef.current?.(data.message || "Could not share your location");
        return;
      }
      if (data.message) upsertMessage(data.message);
    } catch {
      onErrorRef.current?.("Unable to share your current location");
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

  let lastDay = "";

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
          disabled={sharingLocation || locked}
          className={styles.actionBtn}
          title={locked ? lockedMessage : "Share your current location"}
        >
          {sharingLocation ? "Sharing…" : "Share location"}
        </button>
      </div>
      <div ref={listRef} className={styles.messages}>
        {sortedMessages.length === 0 ? (
          <div className={styles.empty}>
            No messages yet — say hello or confirm pickup details.
          </div>
        ) : (
          sortedMessages.map((msg) => {
            const dayLabel = formatDayLabel(msg.timestamp);
            const showDayDivider = dayLabel && dayLabel !== lastDay;
            if (showDayDivider) lastDay = dayLabel;

            if (msg.type === "system") {
              return (
                <div key={msg.id}>
                  {showDayDivider ? (
                    <div className={styles.dayDivider}>{dayLabel}</div>
                  ) : null}
                  <div className={styles.rowSystem}>
                    <div className={styles.systemBubble}>
                      <div className={styles.systemText}>{msg.text}</div>
                      <div className={styles.meta}>{formatTime(msg.timestamp)}</div>
                    </div>
                  </div>
                </div>
              );
            }

            const own =
              (msg.senderEmail || "").toLowerCase().trim() === userEmail ||
              (!msg.senderEmail?.includes("@") && msg.sender === userEmail);
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
                  : msg.sender || msg.senderEmail;

            return (
              <div key={msg.id}>
                {showDayDivider ? (
                  <div className={styles.dayDivider}>{dayLabel}</div>
                ) : null}
                <div className={`${styles.row} ${own ? styles.rowOwn : ""}`}>
                  <div className={`${styles.bubble} ${own ? styles.bubbleOwn : styles.bubbleOther}`}>
                    <div className={styles.sender}>{label}</div>
                    {msg.type === "message" ? (
                      <div className={styles.text}>{msg.text}</div>
                    ) : null}
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
            locked
              ? lockedMessage || "Chat will open once the booking is accepted."
              : !channelReady
                ? "Opening chat…"
                : !connectionOk
                  ? "Reconnecting… you can still send"
                  : "Write a message…"
          }
          className={styles.input}
          disabled={locked}
        />
        <button
          type="submit"
          disabled={sending || !text.trim() || locked}
          className={styles.sendBtn}
        >
          {sending ? "Sending…" : "Send"}
        </button>
      </form>
    </div>
  );
}
