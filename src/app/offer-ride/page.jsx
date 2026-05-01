"use client";

import Navbar from "../../components/Navbar";
import styles from "./offerRide.module.css";
import Image from "next/image";
import { useState } from "react";
import { getCurrentUser } from "@/lib/auth";

const OfferRide = () => {
  const [formData, setFormData] = useState({
    from: "",
    to: "",
    date: "",
    time: "",
    seats: "",
    price: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const user = getCurrentUser();

    if (!user) {
      alert("Please login first!");
      return;
    }

    const newRide = {
      driver: user.email,
      from: formData.from,
      to: formData.to,
      date: formData.date,
      time: formData.time,
      seats: Number(formData.seats),
      price: formData.price || "Free",
    };

    const res = await fetch("/api/rides", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(newRide),
    });

    const data = await res.json();

    if (data.success) {
      alert("Ride posted successfully 🚗");

      setFormData({
        from: "",
        to: "",
        date: "",
        time: "",
        seats: "",
        price: "",
      });
    } else {
      alert("Failed to post ride");
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

            <button className={styles.button} type="submit">
              Post Ride
            </button>

          </form>

        </div>
      </div>
    </>
  );
};

export default OfferRide;