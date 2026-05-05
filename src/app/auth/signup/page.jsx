"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SignUp, useUser } from "@clerk/nextjs";
import Navbar from "@/components/Navbar";
import styles from "./signup.module.css";

export default function Signup() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.push("/profile");
    }
  }, [isLoaded, isSignedIn, router]);

  return (
    <>
      <Navbar />
      <div className={styles.page}>
        <div className={styles.container}>
          <h1 className={styles.title}>Create Account</h1>
          <p className={styles.desc}>Sign up with your university email</p>
          <div style={{ display: "flex", justifyContent: "center", marginTop: "12px" }}>
            <SignUp
              routing="hash"
              signInUrl="/auth/login"
              fallbackRedirectUrl="/profile"
              appearance={{
                elements: {
                  card: {
                    boxShadow: "none",
                    border: "none",
                    background: "transparent",
                  },
                  headerTitle: { display: "none" },
                  headerSubtitle: { display: "none" },
                  socialButtonsBlockButton: { borderRadius: "10px" },
                  formButtonPrimary: {
                    background: "linear-gradient(135deg, #f472b6, #fb923c)",
                    borderRadius: "10px",
                  },
                  formFieldInput: { borderRadius: "10px" },
                  footerActionText: { color: "#6b7280" },
                  footerActionLink: { color: "#f472b6" },
                },
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
}
