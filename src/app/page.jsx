"use client";

import Navbar from "../components/Navbar";
import Image from "next/image";
import styles from "./page.module.css";
import { useRouter } from "next/navigation";

const Home = () => {
  const router = useRouter();

  return (
    <div className={styles.page}>
      <Navbar />

      <div className={styles.container}>
        
        <div className={styles.line1}></div>
        <div className={styles.line2}></div>

        <div className={styles.content}>
         
          <div className={styles.logo}>
            <Image src="/logo.png" alt="UniRide Logo" width={140} height={70} />
          </div>

          <h1 className={styles.title}>UniRide</h1>
          <p className={styles.desc}>Share rides. Save time. Make friends.</p>

          <div className={styles.buttons}>
            <button
              className={styles.buttonPrimary}
              onClick={() => router.push("/find-ride")}
              type="button"
            >
              Find Ride
            </button>

            <button
              className={styles.buttonSecondary}
              onClick={() => router.push("/offer-ride")}
              type="button"
            >
              Offer Ride
            </button>
          </div>
        </div>

        <div className={styles.gifWrapper}>
          <Image
            src="/home.gif"
            alt="UniRide Hero"
            width={1000}
            height={300}
            className={styles.image}
          />
        </div>
      </div>
    </div>
  );
};

export default Home;