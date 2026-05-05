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

export default function RideChat({ rideId, currentUserEmail, onError }) {
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sharingLocation, setSharingLocation] = useState(false);
  const [currentCoords, setCurrentCoords] = useState(null);
  const [connectionState, setConnectionState] = useState("connecting");
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
        coords: incoming.coords || null,
        sender: incoming.sender || "Unknown",
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
    let unsubscribe = null;

    const fetchChatAuth = async () => {
      const authRes = await fetch(`/api/rides/${rideId}/chat-auth`, { cache: "no-store" });
      const authData = await authRes.json();
      if (!authData.success) throw new Error(authData.message || "Chat auth failed");
      if (authData.tokenRequest) tokenRef.current = authData.tokenRequest;
      return authData;
    };

    const init = async () => {
      try {
        const authData = await fetchChatAuth();

        await new Promise((resolve, reject) => {
          if (window.Ably) return resolve();

          const existing = document.querySelector('script[data-ably-sdk="true"]');
          if (existing) {
            existing.addEventListener("load", () => resolve(), { once: true });
            existing.addEventListener("error", () => reject(new Error("Failed to load chat SDK")), {
              once: true,
            });
            return;
          }

          const script = document.createElement("script");
          script.src = "https://cdn.ably.com/lib/ably.min-1.js";
          script.async = true;
          script.dataset.ablySdk = "true";
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Failed to load chat SDK"));
          document.body.appendChild(script);
        });

        const ably = window.Ably;
        const realtime = new ably.Realtime({
          clientId: authData.clientId,
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
                callback("Unable to authorize chat");
                return;
              }
              callback(null, tokenData.tokenRequest);
            } catch {
              callback("Unable to authorize chat");
            }
          },
        });
        const channel = realtime.channels.get(authData.channelName);
        realtime.connection.on((stateChange) => {
          if (!mounted) return;
          setConnectionState(stateChange.current || "unknown");
        });

        clientRef.current = realtime;
        channelRef.current = channel;

        channel.history({ limit: 50 }, (err, page) => {
          if (err || !mounted) return;
          const existingMessages = (page.items || []).map((item) => ({
            id: item.id,
            text: item.data?.text || "",
            type: item.data?.type || "message",
            coords: item.data?.coords || null,
            sender: item.clientId || item.data?.sender || "Unknown",
            timestamp: item.timestamp || Date.now(),
          }));
          setMessages([]);
          existingMessages.forEach(upsertMessage);
        });

        unsubscribe = channel.subscribe("message", (msg) => {
          if (!mounted) return;
          upsertMessage({
            id: msg.id,
            text: msg.data?.text || "",
            type: msg.data?.type || "message",
            coords: msg.data?.coords || null,
            sender: msg.clientId || msg.data?.sender || "Unknown",
            timestamp: msg.timestamp || Date.now(),
          });
        });
      } catch (error) {
        onError?.(error.message || "Unable to load chat");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
      if (clientRef.current) clientRef.current.close();
      clientRef.current = null;
      channelRef.current = null;
    };
  }, [rideId, onError]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [sortedMessages.length]);

  const send = async (e) => {
    e.preventDefault();
    const content = text.trim();
    if (!content || !channelRef.current) return;

    try {
      setSending(true);
      await channelRef.current.publish("message", {
        type: "message",
        text: content,
        sender: currentUserEmail,
      });
      setText("");
    } catch {
      onError?.("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const shareLocation = async () => {
    if (!channelRef.current || sharingLocation) return;
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
        text: "Shared live location",
        coords,
        sender: currentUserEmail,
      });
    } catch {
      onError?.("Unable to share your current location");
    } finally {
      setSharingLocation(false);
    }
  };

  if (loading) {
    return <div className={styles.empty}>Loading chat...</div>;
  }

  return (
    <div className={styles.chatShell}>
      <div className={styles.toolbar}>
        <div className={styles.status}>
          Chat status:{" "}
          <span className={connectionState === "connected" ? styles.statusOnline : ""}>
            {connectionState}
          </span>
        </div>
        <button
          type="button"
          onClick={shareLocation}
          disabled={sharingLocation}
          className={styles.actionBtn}
        >
          {sharingLocation ? "Sharing..." : "Share my location"}
        </button>
      </div>
      <div ref={listRef} className={styles.messages}>
        {sortedMessages.length === 0 ? (
          <div className={styles.empty}>No messages yet.</div>
        ) : (
          sortedMessages.map((msg) => {
            const own = msg.sender === currentUserEmail;
            const coords =
              Array.isArray(msg.coords) && msg.coords.length === 2 ? msg.coords : null;
            const mapsUrl = coords
              ? `https://www.google.com/maps?q=${coords[0]},${coords[1]}`
              : "";
            return (
              <div
                key={msg.id}
                className={`${styles.row} ${own ? styles.rowOwn : ""}`}
              >
                <div className={`${styles.bubble} ${own ? styles.bubbleOwn : styles.bubbleOther}`}>
                  <div className={styles.sender}>{own ? "You" : msg.sender}</div>
                  <div className={styles.text}>
                    {msg.type === "location" ? "Location update shared" : msg.text}
                  </div>
                  {msg.type === "location" && coords ? (
                    <div className={styles.locationMeta}>
                      Lat: {Number(coords[0]).toFixed(5)}, Lng: {Number(coords[1]).toFixed(5)}
                      {msg.sender !== currentUserEmail && currentCoords
                        ? ` • ${formatDistance(haversineDistanceKm(currentCoords, coords))}`
                        : ""}
                      <br />
                      <a
                        className={styles.mapLink}
                        href={mapsUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
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
          placeholder="Type a message for this ride..."
          className={styles.input}
        />
        <button type="submit" disabled={sending || !text.trim()} className={styles.sendBtn}>
          {sending ? "..." : "Send"}
        </button>
      </form>
    </div>
  );
}
