"use client";

import Navbar from "../../../components/Navbar";
import styles from "./login.module.css";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSignIn } from "@clerk/nextjs";

const blockedDomains = [
  "@gmail.com",
  "@yahoo.com",
  "@hotmail.com",
  "@outlook.com",
  "@icloud.com",
];

const isValidUniversityEmail = (email) => {
  const lower = email.toLowerCase();

  const isBlocked = blockedDomains.some((d) =>
    lower.endsWith(d)
  );

  if (isBlocked) return false;

  return (
    lower.includes(".edu") ||
    lower.includes(".ac") ||
    lower.includes(".org.bh") ||
    lower.includes(".std")
  );
};

const Login = () => {
  const router = useRouter();
  const { isLoaded, signIn, setActive } = useSignIn();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!isLoaded) return;

    // University email validation
    if (!isValidUniversityEmail(formData.email)) {
      alert("Please use your official university email.");
      return;
    }

    try {
      const result = await signIn.create({
        identifier: formData.email,
        password: formData.password,
      });

      await setActive({
        session: result.createdSessionId,
      });

      alert("Login successful!");
      router.push("/");

    } catch (err) {
      console.log("LOGIN ERROR:", err);

      alert(
        err?.errors?.[0]?.longMessage ||
        "Invalid email or password. Please try again."
      );
    }
  };

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

          <h1 className={styles.title}>Welcome Back</h1>

          <p className={styles.desc}>
            Login using your university credentials
          </p>

          <form className={styles.form} onSubmit={handleLogin}>
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
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              required
            />

            <button className={styles.button} type="submit">
              Login
            </button>
          </form>

          <p className={styles.message}>
            Don’t have an account?{" "}
            <Link href="/auth/signup">Sign Up</Link>
          </p>
        </div>
      </div>
    </>
  );
};

export default Login;