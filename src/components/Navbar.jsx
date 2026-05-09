"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./Navbar.module.css";
import { useUser, UserButton } from "@clerk/nextjs";

const Navbar = () => {
  const { isSignedIn, isLoaded } = useUser();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!isLoaded || !isSignedIn) {
      queueMicrotask(() => {
        if (!cancelled) setUnreadCount(0);
      });
      return () => {
        cancelled = true;
      };
    }

    const tick = async () => {
      try {
        const res = await fetch("/api/notifications", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data.success) setUnreadCount(Number(data.unreadHint || 0));
      } catch {}
    };
    queueMicrotask(() => {
      if (!cancelled) void tick();
    });
    const interval = setInterval(tick, 25000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isLoaded, isSignedIn]);

  if (!isLoaded) {
    return (
      <nav className={styles.navbar} aria-busy="true">
        <div className={styles.logo}>
          <span style={{ color: "#f4a6b8" }}>Uni</span>
          <span style={{ color: "#f7b267" }}>Ride</span>
        </div>
        <div className={styles.skeletonLinks} aria-hidden="true">
          <div className={styles.skeletonPill} />
          <div className={styles.skeletonPill} />
          <div className={styles.skeletonPill} />
        </div>
      </nav>
    );
  }

  return (
    <nav className={styles.navbar}>
      <div className={styles.logo}>
        <Link href="/">
          <span style={{ color: "#f4a6b8" }}>Uni</span>
          <span style={{ color: "#f7b267" }}>Ride</span>
        </Link>
      </div>

      <div className={styles.links}>
        <Link href="/" className={styles.link}>
          Home
        </Link>

        <Link href="/find-ride" className={styles.link}>
          Find Ride
        </Link>

        <Link href="/offer-ride" className={styles.link}>
          Offer Ride
        </Link>

        <Link href="/my-rides" className={styles.link}>
          My Rides
        </Link>

        <Link href="/chat" className={styles.link}>
          Chat
        </Link>

        <Link href="/notifications" className={`${styles.link} ${styles.linkBadgeWrap}`}>
          Notifications
          {isSignedIn && unreadCount > 0 ? (
            <span className={styles.badge} aria-label={`${unreadCount} unread`}>
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </Link>

        <Link href="/profile" className={styles.link}>
          Profile
        </Link>

        {!isSignedIn ? (
          <>
            <Link href="/auth/login" className={styles.link}>
              Login
            </Link>

            <Link href="/auth/signup" className={styles.link}>
              Signup
            </Link>
          </>
        ) : (
          <UserButton afterSignOutUrl="/" />
        )}
      </div>
    </nav>
  );
};

export default Navbar;
