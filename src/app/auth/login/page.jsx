"use client";

import Navbar from "@/components/Navbar";
import styles from "./login.module.css";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSignIn } from "@clerk/nextjs";
import { isValidUniversityEmail } from "@/lib/universityEmailValidator";

export default function Login() {
  const router = useRouter();
  const { isLoaded, signIn, setActive } = useSignIn();

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    // Wait for Clerk initialization
    if (typeof isLoaded === "undefined" || !isLoaded) {
      setError("Authentication is still loading. Please wait a moment.");
      return;
    }

    // Validate university email
    if (!isValidUniversityEmail(formData.email)) {
      setError("Please use your official university email (e.g., ending in .edu or .ac).");
      return;
    }

    try {
      setLoading(true);

      // Step 1: Create a sign‑in attempt
      const result = await signIn.create({
        identifier: formData.email,
        password: formData.password,
      });

      // Step 2: Finish sign‑in and set active session
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.push("/profile");
      } else {
        setError("Additional steps required. Please check your email.");
      }
    } catch (err) {
      console.error("LOGIN ERROR:", err);

      const msg =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        err.message ||
        "Invalid email or password.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Render loading placeholder until Clerk finishes
  if (typeof isLoaded === "undefined" || !isLoaded)
    return (
      <>
        <Navbar />
        <div className={styles.page}>
          <p style={{ textAlign: "center", color: "#666" }}>
            Loading authentication…
          </p>
        </div>
      </>
    );

  return (
    <>
      <Navbar />

      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.logoWrapper}>
            <Image
              src="/logo.png"
              alt="UniRide Logo"
              width={150}
              height={75}
              priority
            />
          </div>

          <h1 className={styles.title}>Welcome Back</h1>
          <p className={styles.desc}>
            Log in with your university credentials
          </p>

          {error && <div className={styles.error}>{error}</div>}

          <form className={styles.form} onSubmit={handleLogin}>
            <input
              type="email"
              name="email"
              placeholder="University Email"
              value={formData.email}
              onChange={handleChange}
              required
              autoComplete="email"
            />

            <input
              type="password"
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              required
              autoComplete="current-password"
            />

            <button
              className={styles.button}
              type="submit"
              disabled={loading}
            >
              {loading ? "Logging in…" : "Login"}
            </button>
          </form>

          <p className={styles.message}>
            Don’t have an account?{" "}
            <Link href="/auth/signup" className={styles.link}>
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
