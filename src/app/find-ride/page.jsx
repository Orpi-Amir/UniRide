"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import dynamic from "next/dynamic";
import styles from "./findRide.module.css";
import { getCurrentUser } from "@/lib/auth";

// 🗺️ Safe Leaflet import
const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
});

const FindRide = () => {
  console.log("🚀 FindRide page loaded");

  const [rides, setRides] = useState([]);
  const [allRides, setAllRides] = useState([]);
  const [searched, setSearched] = useState(false);

  const [formData, setFormData] = useState({
    from: "",
    to: "",
    seats: 1,
  });

  // 📡 FETCH RIDES
  useEffect(() => {
    const fetchRides = async () => {
      try {
        const res = await fetch("/api/rides");
        const data = await res.json();

        console.log("📦 All rides from DB:", data);

        if (data.success) {
          setAllRides(data.rides);
          setRides(data.rides);
        }
      } catch (err) {
        console.error("❌ Error loading rides:", err);
      }
    };

    fetchRides();
  }, []);

  // ✏️ INPUT
  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  // 🔍 SEARCH (IMPROVED LOGIC)
  const handleSearch = (e) => {
    e.preventDefault();

    console.log("🔍 Searching rides with:", formData);

    const results = allRides.filter((ride) => {
      const fromMatch = formData.from
        ? ride.from.toLowerCase().includes(formData.from.toLowerCase())
        : true;

      const toMatch = formData.to
        ? ride.to.toLowerCase().includes(formData.to.toLowerCase())
        : true;

      const seatsMatch = ride.seats >= Number(formData.seats || 1);

      return fromMatch && toMatch && seatsMatch;
    });

    console.log("📊 Filter results:", results);

    setRides(results);
    setSearched(true);
  };

  // 🚗 BOOK RIDE
  const bookRide = async (rideId) => {
    const user = getCurrentUser();

    console.log("👤 User:", user);

    if (!user) {
      alert("Please login first!");
      return;
    }

    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rideId,
        userEmail: user.email,
      }),
    });

    const data = await res.json();

    console.log("📦 Booking response:", data);

    if (data.success) {
      alert("Ride booked successfully 🚗");
    } else {
      alert(data.message || "Booking failed");
    }
  };

  return (
    <>
      <Navbar />

      <div className={styles.page}>
        <div className={styles.container}>
          <h1 className={styles.title}>Find a Ride</h1>
          <p className={styles.desc}>Search and book rides easily</p>

          {/* 🗺️ MAP */}
          <div style={{ marginBottom: "20px" }}>
            <MapView />
          </div>

          {/* 🔍 SEARCH FORM */}
          <form className={styles.searchForm} onSubmit={handleSearch}>
            <input
              type="text"
              name="from"
              placeholder="From location"
              value={formData.from}
              onChange={handleChange}
              className={styles.input}
            />

            <input
              type="text"
              name="to"
              placeholder="To location"
              value={formData.to}
              onChange={handleChange}
              className={styles.input}
            />

            <input
              type="number"
              name="seats"
              placeholder="Seats needed"
              value={formData.seats}
              onChange={handleChange}
              className={styles.input}
            />

            <button type="submit" className={styles.searchButton}>
              Search
            </button>
          </form>

          {/* 🚗 RESULTS */}
          <div className={styles.rideList}>
            {rides.length > 0 ? (
              rides.map((ride) => (
                <div key={ride._id} className={styles.rideCard}>
                  <p><strong>Driver:</strong> {ride.driver}</p>
                  <p><strong>From:</strong> {ride.from}</p>
                  <p><strong>To:</strong> {ride.to}</p>

                  <button
                    className={styles.bookButton}
                    onClick={() => bookRide(ride._id)}
                  >
                    Book Ride
                  </button>
                </div>
              ))
            ) : searched ? (
              <p className={styles.noRides}>No rides found</p>
            ) : (
              <p>Enter search details to find rides</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default FindRide;