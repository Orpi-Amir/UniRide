"use client";

import Link from "next/link";
import styles from "./Navbar.module.css";
import {
  useUser,
  UserButton,
} from "@clerk/nextjs";

const Navbar = () => {
  const { isSignedIn, isLoaded } = useUser();

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
      
      {/* Logo */}
      <div className={styles.logo}>
        <Link href="/">
          <span style={{ color: "#f4a6b8" }}>Uni</span>
          <span style={{ color: "#f7b267" }}>Ride</span>
        </Link>
      </div>

      {/* Navigation Links */}
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

        <Link href="/profile" className={styles.link}>
          Profile
        </Link>

        {/* AUTH SECTION */}
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