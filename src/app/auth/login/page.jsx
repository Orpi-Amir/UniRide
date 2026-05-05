"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SignIn, useUser } from "@clerk/nextjs";
import Navbar from "@/components/Navbar";
import styles from "./login.module.css";

export default function Login() {
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
          <h1 className={styles.title}>Welcome Back</h1>
          <p className={styles.desc}>Login to continue with UniRide</p>
          <div style={{ display: "flex", justifyContent: "center", marginTop: "12px" }}>
            <SignIn
              routing="hash"
              signUpUrl="/auth/signup"
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
