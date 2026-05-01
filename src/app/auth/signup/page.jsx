"use client";

import Navbar from "@/components/Navbar";
import styles from "./signup.module.css";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSignUp } from "@clerk/nextjs";

export default function Signup() {
  const router = useRouter();
  const { isLoaded, signUp } = useSignUp();

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const isValidUniversityEmail = (email) => {
    return (
      email.endsWith(".edu") ||
      email.endsWith(".edu.bh") ||
      email.includes("aou") ||
      email.includes("university")
    );
  };

  const handleSignup = async (e) => {
    e.preventDefault();

    // Wait until Clerk is fully loaded
    if (!isLoaded) {
      alert("Authentication is still loading. Please wait a moment.");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    if (!isValidUniversityEmail(formData.email)) {
      alert("Please use your university email address");
      return;
    }

    try {
      setLoading(true);

      // STEP 1: Create user
      const result = await signUp.create({
        emailAddress: formData.email,
        password: formData.password,
      });
      console.log("✅ Created user:", result);

      // STEP 2: Send verification
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      console.log("✅ Verification email sent");

      // STEP 3: Redirect to verify‑email page
      router.push("/verify-email");
    } catch (err) {
      console.error("🔥 Clerk error:", err);
      alert(
        err?.errors?.[0]?.longMessage ||
          err?.errors?.[0]?.message ||
          err.message ||
          "Signup failed"
      );
    } finally {
      setLoading(false);
    }
  };

  // Don’t show the form until Clerk has finished loading
  if (!isLoaded)
    return (
      <>
        <Navbar />
        <div className={styles.page}>
          <p style={{ textAlign: "center" }}>Loading authentication…</p>
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
              width={140}
              height={70}
              priority
            />
          </div>

          <h1 className={styles.title}>Create Account</h1>
          <p className={styles.desc}>Sign up using your university email</p>

          <form className={styles.form} onSubmit={handleSignup}>
            <input
              type="email"
              name="email"
              placeholder="University Email"
              value={formData.email}
              onChange={handleChange}
              required
            />
            <input
              type="password"
              name="password"
              placeholder="Create Password"
              value={formData.password}
              onChange={handleChange}
              required
            />
            <input
              type="password"
              name="confirmPassword"
              placeholder="Confirm Password"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
            />
            <button
              type="submit"
              className={styles.button}
              disabled={loading}
            >
              {loading ? "Creating Account..." : "Create Account"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
