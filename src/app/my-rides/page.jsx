"use client";

import { useEffect, useState } from "react";
import Navbar from "../../components/Navbar";
import styles from "./my-rides.module.css";
import { getCurrentUser } from "@/lib/auth";

export default function MyRides() {
  const [offeredRides, setOfferedRides] = useState([]);
  const [joinedRides, setJoinedRides] = useState([]);

  useEffect(() => {
    loadRides();
  }, []);

  const loadRides = async () => {
    const user = getCurrentUser();

    if (!user) {
      setOfferedRides([]);
      setJoinedRides([]);
      return;
    }

    const res = await fetch("/api/rides");
    const data = await res.json();

    if (!data.success) return;

    const storedRides = data.rides;

    // ================= OFFERED RIDES =================
    const myOffered = storedRides.filter(
      (ride) => ride.driver === user.email
    );

    setOfferedRides(myOffered);

    // ================= JOINED RIDES =================
    const myJoined = storedRides.filter(
      (ride) =>
        ride.bookedUsers &&
        ride.bookedUsers.includes(user.email)
    );

    setJoinedRides(myJoined);
  };

  // 🚗 DELETE RIDE
  const deleteRide = async (id) => {
    const res = await fetch(`/api/rides/${id}`, {
      method: "DELETE",
    });

    const data = await res.json();

    if (data.success) {
      loadRides();
    } else {
      alert(data.message || "Failed to delete ride");
    }
  };

  // 🚨 CANCEL BOOKING (NEW)
  const cancelBooking = async (rideId) => {
    const user = getCurrentUser();

    const res = await fetch("/api/bookings/cancel", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        rideId,
        userEmail: user.email,
      }),
    });

    const data = await res.json();

    if (data.success) {
      alert("Booking cancelled successfully");
      loadRides();
    } else {
      alert(data.message || "Failed to cancel booking");
    }
  };

  return (
    <>
      <Navbar />

      <div className={styles.page}>
        <div className={styles.container}>
          <h1 className={styles.title}>My Rides</h1>

          {/* ================= OFFERED RIDES ================= */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>
              Rides I Offered
            </h2>

            {offeredRides.length > 0 ? (
              offeredRides.map((ride) => (
                <div key={ride._id || ride.id} className={styles.card}>
                  <p><b>From:</b> {ride.from}</p>
                  <p><b>To:</b> {ride.to}</p>
                  <p><b>Date:</b> {ride.date}</p>
                  <p><b>Time:</b> {ride.time}</p>
                  <p><b>Seats:</b> {ride.seats}</p>
                  <p><b>Price:</b> {ride.price}</p>

                  <button
                    onClick={() => deleteRide(ride._id || ride.id)}
                    style={{
                      marginTop: "10px",
                      padding: "8px 12px",
                      background: "#ff4d4d",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                    }}
                  >
                    Delete Ride
                  </button>
                </div>
              ))
            ) : (
              <div className={styles.card}>
                <p className={styles.empty}>
                  You haven’t offered any rides yet
                </p>
              </div>
            )}
          </div>

          {/* ================= JOINED RIDES ================= */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>
              Rides I Joined
            </h2>

            {joinedRides.length > 0 ? (
              joinedRides.map((ride) => (
                <div key={ride._id || ride.id} className={styles.card}>
                  <p><b>From:</b> {ride.from}</p>
                  <p><b>To:</b> {ride.to}</p>
                  <p><b>Date:</b> {ride.date}</p>
                  <p><b>Time:</b> {ride.time}</p>
                  <p><b>Price:</b> {ride.price}</p>

                  {/* 🚨 NEW CANCEL BUTTON */}
                  <button
                    onClick={() => cancelBooking(ride._id || ride.id)}
                    style={{
                      marginTop: "10px",
                      padding: "8px 12px",
                      background: "#ff9800",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                    }}
                  >
                    Cancel Booking
                  </button>
                </div>
              ))
            ) : (
              <div className={styles.card}>
                <p className={styles.empty}>
                  You haven’t joined any rides yet
                </p>
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}