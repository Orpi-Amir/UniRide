"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSignUp, useAuth } from "@clerk/nextjs";
import { isValidUniversityEmail } from "@/lib/universityEmailValidator";
import styles from "../auth/signup/signup.module.css";

export default function VerifyEmailPage() {
  const router = useRouter();
  const { isLoaded, signUp, setActive } = useSignUp();
  const { isSignedIn } = useAuth();

  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");

  // Redirect if already signed in
  useEffect(() => {
    if (isSignedIn) {
      router.push("/");
    }
  }, [isSignedIn, router]);

  // Get email from session storage on mount (deferred to satisfy react-hooks/set-state-in-effect)
  useEffect(() => {
    queueMicrotask(() => {
      const storedEmail = sessionStorage.getItem("signupEmail");
      if (storedEmail) {
        setEmail(storedEmail);

        if (!isValidUniversityEmail(storedEmail)) {
          setError("Invalid university email. Please sign up again.");
          setTimeout(() => router.push("/auth/signup"), 2000);
        }
      } else {
        setError("No email found. Please sign up first.");
        setTimeout(() => router.push("/auth/signup"), 2000);
      }
    });
  }, [router]);

  const handleVerify = async (e) => {
    e.preventDefault();
    setError("");

    // Validate code format
    if (!code || code.trim().length === 0) {
      setError("Please enter the verification code");
      return;
    }

    if (code.length < 6) {
      setError("Verification code should be at least 6 characters");
      return;
    }

    if (!isLoaded || !signUp) {
      setError("Authentication is not ready. Please refresh the page.");
      return;
    }

    try {
      setLoading(true);

      console.log("🔍 Submitting verification code for:", email);

      const result = await signUp.attemptEmailAddressVerification({
        code: code.trim(),
      });

      console.log("✅ Verification result:", result.status);

      if (result.status === "complete") {
        // Verify university email one more time on success
        if (!isValidUniversityEmail(email)) {
          throw new Error("Email verification failed: Not a valid university email");
        }

        console.log("🎉 Session activating...");
        await setActive({
          session: result.createdSessionId,
        });

        // Clear session storage
        sessionStorage.removeItem("signupEmail");

        console.log("✅ User successfully registered with university email");
        router.push("/");
      } else {
        setError(`Verification incomplete. Status: ${result.status}`);
      }
    } catch (err) {
      console.error("🔥 Verification error:", err);

      const errorMessage =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        err?.message ||
        "Verification failed. Please try again.";

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <h1 className={styles.title}>Verify Your Email</h1>

        <p className={styles.desc}>
          {email ? (
            <>
              Enter the verification code sent to<br />
              <strong>{email}</strong>
            </>
          ) : (
            "Enter the verification code sent to your email"
          )}
        </p>

        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={handleVerify} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="code">Verification Code</label>
            <input
              id="code"
              type="text"
              placeholder="Enter 6-digit code"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setError("");
              }}
              required
              maxLength="8"
              autoComplete="off"
            />
          </div>

          <button 
            type="submit" 
            className={styles.button}
            disabled={loading}
          >
            {loading ? "Verifying..." : "Verify Email"}
          </button>
        </form>

        <p className={styles.footer}>
          Didn&apos;t receive the code?{" "}
          <a 
            href="/auth/signup" 
            className={styles.link}
            onClick={() => sessionStorage.removeItem("signupEmail")}
          >
            Sign up again
          </a>
        </p>
      </div>
    </div>
  );
}