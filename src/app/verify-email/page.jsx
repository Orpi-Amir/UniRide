"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSignUp } from "@clerk/nextjs";
import styles from "../auth/signup/signup.module.css";

export default function VerifyEmailPage() {
  const router = useRouter();
  const { isLoaded, signUp, setActive } = useSignUp();

  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");

  useEffect(() => {
    console.log("VERIFY PAGE STATE:", { isLoaded, signUp });
  }, [isLoaded, signUp]);

  const handleVerify = async (e) => {
    e.preventDefault();

    console.log("VERIFY CLICKED");

    if (!isLoaded || !signUp) {
      alert("Clerk is not ready. Refresh the page.");
      return;
    }

    try {
      setLoading(true);

      console.log("Submitting verification code:", code);

      const result = await signUp.attemptEmailAddressVerification({
        code,
      });

      console.log("Verification result:", result);

      if (result.status === "complete") {
        await setActive({
          session: result.createdSessionId,
        });

        console.log("SESSION ACTIVATED");

        router.push("/");
      } else {
        console.log("Unexpected status:", result.status);
        alert("Verification not complete. Try again.");
      }
    } catch (err) {
      console.log("VERIFICATION ERROR:", err);

      alert(
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        err?.message ||
        "Verification failed"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <h1 className={styles.title}>Verify Your Email</h1>

        <p className={styles.desc}>
          Enter the verification code sent to your email
        </p>

        <form onSubmit={handleVerify} className={styles.form}>
          <input
            type="text"
            placeholder="Enter verification code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? "Verifying..." : "Verify Email"}
          </button>
        </form>
      </div>
    </div>
  );
}