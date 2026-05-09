"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { useUser } from "@clerk/nextjs";
import { useToast } from "@/components/ToastProvider";
import styles from "./notifications.module.css";

const TYPE_META = {
  booking_request: {
    label: "Booking request",
    accent: "warn",
  },
  waiting_driver: {
    label: "Pending request",
    accent: "info",
  },
  booking_accepted: {
    label: "Confirmed",
    accent: "ok",
  },
};

export default function NotificationsPage() {
  const { isLoaded, isSignedIn } = useUser();
  const { showError, showSuccess } = useToast();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [actingId, setActingId] = useState("");

  const load = useCallback(async () => {
    if (!isLoaded || !isSignedIn) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      const data = await res.json();
      if (!data.success) {
        showError(data.message || "Failed to load notifications");
        return;
      }
      setNotifications(data.notifications || []);
    } catch {
      showError("Network error loading notifications");
    } finally {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn, showError]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    const interval = setInterval(() => {
      void load();
    }, 20000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [load]);

  const acceptRequest = async (notification) => {
    if (!notification.passengerEmail || !notification.rideId) return;
    try {
      setActingId(notification.id);
      const res = await fetch("/api/bookings/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rideId: notification.rideId,
          passengerEmail: notification.passengerEmail,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        showError(data.message || "Failed to accept booking");
        return;
      }
      showSuccess("Booking accepted.");
      await load();
    } catch {
      showError("Network error while accepting booking");
    } finally {
      setActingId("");
    }
  };

  const declineRequest = async (notification) => {
    if (!notification.passengerEmail || !notification.rideId) return;
    if (!window.confirm("Decline this booking request?")) return;
    try {
      setActingId(notification.id);
      const res = await fetch("/api/bookings/decline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rideId: notification.rideId,
          passengerEmail: notification.passengerEmail,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        showError(data.message || "Failed to decline booking");
        return;
      }
      showSuccess("Booking declined.");
      await load();
    } catch {
      showError("Network error while declining booking");
    } finally {
      setActingId("");
    }
  };

  return (
    <>
      <Navbar />
      <div className={styles.page}>
        <div className={styles.container}>
          <h1 className={styles.title}>Notifications</h1>
          <p className={styles.desc}>
            Booking requests, confirmations, and reminders.{" "}
            <Link href="/my-rides" className={styles.inlineLink}>
              Manage rides
            </Link>
          </p>

          {loading ? (
            <p className={styles.muted}>Loading…</p>
          ) : notifications.length === 0 ? (
            <p className={styles.muted}>No notifications right now.</p>
          ) : (
            <ul className={styles.list}>
              {notifications.map((n) => {
                const meta = TYPE_META[n.type] || { label: "Update", accent: "info" };
                const accentClass =
                  meta.accent === "warn"
                    ? styles.cardWarn
                    : meta.accent === "ok"
                      ? styles.cardOk
                      : styles.cardInfo;
                return (
                  <li key={n.id} className={`${styles.card} ${accentClass}`}>
                    <div className={styles.cardHeader}>
                      <span className={styles.tag}>{meta.label}</span>
                      <span className={styles.cardTitle}>{n.title}</span>
                    </div>
                    <div className={styles.cardBody}>{n.message}</div>
                    <div className={styles.cardActions}>
                      {n.type === "booking_request" && n.actionable ? (
                        <>
                          <button
                            type="button"
                            className={`${styles.btn} ${styles.btnPrimary}`}
                            onClick={() => acceptRequest(n)}
                            disabled={actingId === n.id}
                          >
                            {actingId === n.id ? "Accepting…" : "Accept"}
                          </button>
                          <button
                            type="button"
                            className={`${styles.btn} ${styles.btnGhost}`}
                            onClick={() => declineRequest(n)}
                            disabled={actingId === n.id}
                          >
                            Decline
                          </button>
                        </>
                      ) : null}
                      <Link href={`/chat`} className={styles.link}>
                        Open chat
                      </Link>
                      <Link href="/my-rides" className={styles.link}>
                        My rides
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
