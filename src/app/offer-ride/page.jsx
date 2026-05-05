"use client";

import Navbar from "../../components/Navbar";
import styles from "./offerRide.module.css";
import Image from "next/image";
import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import dynamic from "next/dynamic";
import { isValidUniversityEmail } from "@/lib/universityEmailValidator";
import { useToast } from "@/components/ToastProvider";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
});

const OfferRide = () => {
  const { user, isLoaded } = useUser();
  const { showSuccess, showError } = useToast();
  const [formData, setFormData] = useState({
    from: "",
    to: "",
    date: "",
    time: "",
    seats: "",
    price: "",
    fromCoords: [],
    toCoords: [],
  });
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState({ type: "", message: "" });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setBanner({ type: "", message: "" });

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBanner({ type: "", message: "" });

    if (!isLoaded) {
      setBanner({ type: "error", message: "Authentication is still loading. Please wait a moment." });
      return;
    }

    if (!user) {
      setBanner({ type: "error", message: "Please sign in to post a ride." });
      return;
    }

    const userEmail =
      user.primaryEmailAddress?.emailAddress || user.emailAddresses?.[0]?.emailAddress;
    if (!userEmail) {
      setBanner({
        type: "error",
        message: "Your account email is missing. Please sign out and sign in again.",
      });
      return;
    }
    if (!isValidUniversityEmail(userEmail)) {
      setBanner({
        type: "error",
        message: "UniRide is only available for approved university email accounts.",
      });
      return;
    }

    const newRide = {
      driver: userEmail,
      from: formData.from,
      to: formData.to,
      fromCoords: formData.fromCoords,
      toCoords: formData.toCoords,
      date: formData.date,
      time: formData.time,
      seats: Number(formData.seats),
      price: formData.price || "Free",
    };

    try {
      setSubmitting(true);
      const res = await fetch("/api/rides", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newRide),
      });

      const data = await res.json();

      if (data.success) {
        showSuccess("Ride posted successfully.");
        setFormData({
          from: "",
          to: "",
          date: "",
          time: "",
          seats: "",
          price: "",
          fromCoords: [],
          toCoords: [],
        });
      } else {
        const msg = data.message || "Failed to post ride";
        setBanner({ type: "error", message: msg });
        showError(msg);
      }
    } catch {
      const msg = "Network error. Please check your connection and try again.";
      setBanner({ type: "error", message: msg });
      showError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Navbar />

      <div className={styles.page}>
        
        <div className={styles.track1}></div>
        <div className={styles.carWrapper1}>
          <div className={styles.car}></div>
        </div>

        <div className={styles.track2}></div>
        <div className={styles.carWrapper2}>
          <div className={styles.car}></div>
        </div>

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

          <h1 className={styles.title}>Offer a Ride</h1>
          <p className={styles.desc}>
            Share your ride with other university members
          </p>

          {banner.message ? (
            <div
              className={`${styles.banner} ${
                banner.type === "error" ? styles.bannerError : styles.bannerInfo
              }`}
              role="status"
            >
              {banner.message}
            </div>
          ) : null}

          <div className={styles.mapWrap}>
            <MapView
              previewFromCoords={formData.fromCoords}
              previewToCoords={formData.toCoords}
              setFromCoords={(coords) =>
                setFormData((prev) => ({ ...prev, fromCoords: coords }))
              }
              setToCoords={(coords) =>
                setFormData((prev) => ({ ...prev, toCoords: coords }))
              }
              setFromLocation={(location) =>
                setFormData((prev) => ({ ...prev, from: location }))
              }
              setToLocation={(location) =>
                setFormData((prev) => ({ ...prev, to: location }))
              }
            />
          </div>

          <p className={styles.hint}>
            Tip: click the map once to set pickup, then again to set dropoff. You can still edit
            the text fields afterwards.
          </p>

          <form className={styles.form} onSubmit={handleSubmit}>
            
            <input
              type="text"
              name="from"
              placeholder="From (Location)"
              required
              value={formData.from}
              onChange={handleChange}
            />

            <input
              type="text"
              name="to"
              placeholder="To (Location)"
              required
              value={formData.to}
              onChange={handleChange}
            />

            <input
              type="date"
              name="date"
              required
              value={formData.date}
              onChange={handleChange}
            />

            <input
              type="time"
              name="time"
              required
              value={formData.time}
              onChange={handleChange}
            />

            <input
              type="number"
              name="seats"
              placeholder="Available Seats"
              required
              value={formData.seats}
              onChange={handleChange}
            />

            <input
              type="text"
              name="price"
              placeholder="Price (optional)"
              value={formData.price}
              onChange={handleChange}
            />

            <button className={styles.button} type="submit" disabled={submitting}>
              {submitting ? "Posting..." : "Post Ride"}
            </button>

          </form>

        </div>
      </div>
    </>
  );
};

export default OfferRide;