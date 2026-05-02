"use client";

import Navbar from "@/components/Navbar";
import styles from "./signup.module.css";
import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSignUp } from "@clerk/nextjs";
import { isValidUniversityEmail } from "@/lib/universityEmailValidator";

export default function Signup() {
  const router = useRouter();
  const { isLoaded, signUp } = useSignUp();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });

  // Debug logging
  useEffect(() => {
    console.log("=== SIGNUP PAGE DEBUG ===");
    console.log("isLoaded:", isLoaded);
    console.log("signUp available:", !!signUp);
    console.log("Current time:", new Date().toISOString());
    
    if (!isLoaded) {
      console.log("⏳ Waiting for Clerk to load...");
    } else {
      console.log("✅ Clerk is loaded!");
    }
  }, [isLoaded, signUp]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const validateForm = () => {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError("Please enter a valid email address");
      return false;
    }

    // Validate university email domain
    if (!isValidUniversityEmail(formData.email)) {
      setError(
        "Please use a valid university email address (e.g., student@university.edu)"
      );
      return false;
    }

    // Validate password strength (minimum 8 characters, at least one number and letter)
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(formData.password)) {
      setError(
        "Password must be at least 8 characters with uppercase, lowercase, and numbers"
      );
      return false;
    }

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return false;
    }

    return true;
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");

    console.log("📝 Signup form submitted");
    console.log("isLoaded:", isLoaded);
    console.log("signUp available:", !!signUp);

    // Wait until Clerk is fully loaded
    if (!isLoaded) {
      const errorMsg = "Authentication is still loading. Please wait a moment.";
      setError(errorMsg);
      console.error("❌ " + errorMsg);
      return;
    }

    if (!signUp) {
      const errorMsg = "Clerk SignUp is not available. Please refresh the page.";
      setError(errorMsg);
      console.error("❌ " + errorMsg);
      return;
    }

    // Validate form
    if (!validateForm()) {
      console.warn("❌ Form validation failed");
      return;
    }

    console.log("✅ Form validation passed");
    console.log("📧 Email:", formData.email);

    try {
      setLoading(true);

      // STEP 1: Create user with Clerk
      console.log("🔄 Creating user with Clerk...");
      const result = await signUp.create({
        emailAddress: formData.email,
        password: formData.password,
      });
      console.log("✅ User created successfully:", result.id);

      // STEP 2: Send email verification
      console.log("🔄 Sending verification email...");
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      console.log("✅ Verification email sent to:", formData.email);

      // STEP 3: Store email in session and redirect to verification
      sessionStorage.setItem("signupEmail", formData.email);
      console.log("📦 Email stored in session");
      
      console.log("🚀 Redirecting to verify-email page...");
      router.push("/verify-email");
    } catch (err) {
      console.error("🔥 Signup error occurred:");
      console.error("Error object:", err);
      console.error("Error type:", err?.constructor?.name);
      console.error("Error message:", err?.message);
      
      if (err?.errors) {
        console.error("Clerk errors array:", err.errors);
        err.errors.forEach((e, i) => {
          console.error(`  Error ${i}:`, e);
          console.error(`    - message: ${e.message}`);
          console.error(`    - longMessage: ${e.longMessage}`);
          console.error(`    - code: ${e.code}`);
        });
      }

      const errorMessage =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        err?.message ||
        "Signup failed. Please try again.";

      setError(errorMessage);
      console.error("❌ Error shown to user:", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Don't show the form until Clerk has finished loading
  if (!isLoaded) {
    console.log("⏳ Rendering loading state...");
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
  }

  console.log("✅ Rendering signup form");
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

          {error && <div className={styles.error}>{error}</div>}

          <form className={styles.form} onSubmit={handleSignup}>
            <div className={styles.formGroup}>
              <label htmlFor="email">University Email</label>
              <input
                id="email"
                type="email"
                name="email"
                placeholder="your.email@university.edu"
                value={formData.email}
                onChange={handleChange}
                required
                autoComplete="email"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                name="password"
                placeholder="Min. 8 chars, uppercase, lowercase, numbers"
                value={formData.password}
                onChange={handleChange}
                required
                autoComplete="new-password"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                name="confirmPassword"
                placeholder="Confirm Password"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              className={styles.button}
              disabled={loading}
            >
              {loading ? "Creating Account..." : "Create Account"}
            </button>
          </form>

          <p className={styles.footer}>
            Already have an account?{" "}
            <a href="/auth/login" className={styles.link}>
              Sign in
            </a>
          </p>

          <p style={{ marginTop: "20px", fontSize: "12px", color: "#999", textAlign: "center" }}>
            <a href="/debug" style={{ color: "#667eea" }}>Debug Info</a>
          </p>
        </div>
      </div>
    </>
  );
}
