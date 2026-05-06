"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { useUser } from "@clerk/nextjs";
import { useToast } from "@/components/ToastProvider";
import styles from "./notifications.module.css";

export default function NotificationsPage() {
  const { isLoaded, isSignedIn } = useUser();
  const { showError } = useToast();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const load = async () => {
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
    };
    load();
    const interval = setInterval(load, 25000);
    return () => clearInterval(interval);
  }, [isLoaded, isSignedIn, showError]);

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
              {notifications.map((n) => (
                <li key={n.id} className={styles.card}>
                  <div className={styles.cardTitle}>{n.title}</div>
                  <div className={styles.cardBody}>{n.message}</div>
                  <div className={styles.cardActions}>
                    <Link href={`/chat`} className={styles.link}>
                      Open chat
                    </Link>
                    <Link href="/my-rides" className={styles.link}>
                      My rides
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
