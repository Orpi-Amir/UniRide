"use client";

import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import Navbar from "@/components/Navbar";
import RideChat from "@/components/RideChat";
import { useToast } from "@/components/ToastProvider";
import styles from "./chat.module.css";

export default function ChatPage() {
  const { user, isLoaded } = useUser();
  const { showError } = useToast();
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRideId, setSelectedRideId] = useState("");

  const currentEmail =
    user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || "";

  useEffect(() => {
    const load = async () => {
      if (!isLoaded || !currentEmail) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch("/api/rides");
        const data = await res.json();
        if (!data.success) {
          showError(data.message || "Failed to load rides for chat");
          setLoading(false);
          return;
        }

        const participantRides = (data.rides || []).filter((ride) => {
          const isDriver = ride.driver === currentEmail;
          const isPassenger = (ride.bookedUsers || []).includes(currentEmail);
          return isDriver || isPassenger;
        });

        setRides(participantRides);
        if (participantRides[0]?._id) setSelectedRideId(participantRides[0]._id);
      } catch {
        showError("Network error while loading chats");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [isLoaded, currentEmail, showError]);

  const selectedRide = useMemo(
    () => rides.find((r) => r._id === selectedRideId) || null,
    [rides, selectedRideId]
  );

  return (
    <>
      <Navbar />
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.panel}>
            <h1 className={styles.heading}>Chats</h1>
            <p className={styles.muted}>
              One chat per ride. Only the driver and currently booked passengers can join.
            </p>
            {loading ? (
              <p className={styles.muted}>Loading chats...</p>
            ) : rides.length === 0 ? (
              <p className={styles.muted}>No chats yet. Book or offer a ride first.</p>
            ) : (
              rides.map((ride) => (
                <button
                  key={ride._id}
                  type="button"
                  className={`${styles.rideBtn} ${
                    selectedRideId === ride._id ? styles.rideBtnActive : ""
                  }`}
                  onClick={() => setSelectedRideId(ride._id)}
                >
                  <div>
                    <strong>{ride.from}</strong> to <strong>{ride.to}</strong>
                  </div>
                  <div className={styles.muted}>
                    {ride.date} at {ride.time}
                  </div>
                </button>
              ))
            )}
          </div>

          <div className={styles.panel}>
            {selectedRide ? (
              <>
                <div className={styles.chatHeader}>
                  <h2 className={styles.heading} style={{ marginBottom: "4px" }}>
                    {selectedRide.from} to {selectedRide.to}
                  </h2>
                  <p className={styles.muted}>
                    Use this chat for pickup coordination and live location sharing.
                  </p>
                </div>
                <RideChat
                  rideId={selectedRide._id}
                  currentUserEmail={currentEmail}
                  onError={showError}
                />
              </>
            ) : (
              <p className={styles.muted}>Select a ride from the left to start chatting.</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
