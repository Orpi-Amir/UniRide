"use client";

import Navbar from "@/components/Navbar";
import { SignOutButton } from "@clerk/nextjs";
import styles from "./not-university.module.css";

export default function NotUniversityPage() {
  return (
    <>
      <Navbar />
      <div className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>University email required</h1>
          <p className={styles.text}>
            UniRide is only for approved Bahrain university email accounts. Personal
            email providers (Gmail, Yahoo, Hotmail, etc.) are not allowed.
          </p>
          <p className={styles.text}>
            Please sign out and create an account using your official university email.
          </p>
          <div className={styles.actions}>
            <SignOutButton redirectUrl="/auth/signup">
              <button
                type="button"
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "none",
                  background: "linear-gradient(135deg, #f472b6, #fb923c)",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Sign out
              </button>
            </SignOutButton>
          </div>
        </div>
      </div>
    </>
  );
}
