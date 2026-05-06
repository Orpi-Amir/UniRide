"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Navbar from "../../components/Navbar";
import styles from "./my-rides.module.css";
import { useUser } from "@clerk/nextjs";
import { isValidUniversityEmail } from "@/lib/universityEmailValidator";
import { useToast } from "@/components/ToastProvider";

function haversineDistanceKm(fromCoords, toCoords) {
  if (!Array.isArray(fromCoords) || !Array.isArray(toCoords)) return null;
  const [lat1, lng1] = fromCoords;
  const [lat2, lng2] = toCoords;
  if ([lat1, lng1, lat2, lng2].some((value) => typeof value !== "number")) return null;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

export default function MyRides() {
  const { user, isLoaded } = useUser();
  const { showSuccess, showError } = useToast();
  const [offeredRides, setOfferedRides] = useState([]);
  const [joinedRides, setJoinedRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [contactsByRide, setContactsByRide] = useState({});
  const [liveByRide, setLiveByRide] = useState({});
  const [publishingRideId, setPublishingRideId] = useState("");
  const watchRef = useRef({ rideId: "", watchId: null });
  const bookingCountRef = useRef({});
  const bootstrappedBookingCountsRef = useRef(false);

  const loadRides = useCallback(async () => {
    if (!user) {
      setOfferedRides([]);
      setJoinedRides([]);
      setLoading(false);
      setError("");
      return;
    }

    const userEmailRaw =
      user.primaryEmailAddress?.emailAddress || user.emailAddresses?.[0]?.emailAddress;
    const userEmail = userEmailRaw?.toLowerCase().trim();
    if (!userEmail) {
      setLoading(false);
      return;
    }
    if (!isValidUniversityEmail(userEmail)) {
      setError("UniRide is only available for approved university email accounts.");
      setOfferedRides([]);
      setJoinedRides([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/rides");
      const data = await res.json();

      if (!data.success) {
        setError(data.message || "Failed to load rides.");
        return;
      }

      const storedRides = data.rides || [];

      const myOffered = storedRides.filter(
        (ride) => (ride.driver || "").toLowerCase().trim() === userEmail
      );
      setOfferedRides(myOffered);

      const myJoined = storedRides.filter(
        (ride) =>
          Array.isArray(ride.bookedUsers) &&
          ride.bookedUsers.some((email) => (email || "").toLowerCase().trim() === userEmail)
      );
      setJoinedRides(myJoined);

      const currentBookingCounts = {};
      myOffered.forEach((ride) => {
        const rideId = ride._id || ride.id;
        currentBookingCounts[rideId] = Array.isArray(ride.bookedUsers) ? ride.bookedUsers.length : 0;
      });

      if (bootstrappedBookingCountsRef.current) {
        myOffered.forEach((ride) => {
          const rideId = ride._id || ride.id;
          const previous = bookingCountRef.current[rideId] ?? 0;
          const next = currentBookingCounts[rideId] ?? 0;
          if (next > previous) {
            showSuccess(`New booking received for ride: ${ride.from} to ${ride.to}`);
          }
        });
      } else {
        bootstrappedBookingCountsRef.current = true;
      }

      bookingCountRef.current = currentBookingCounts;
    } catch {
      setError("Network error while loading rides.");
    } finally {
      setLoading(false);
    }
  }, [user, showSuccess]);

  useEffect(() => {
    if (!isLoaded) return;
    queueMicrotask(() => {
      void loadRides();
    });
  }, [isLoaded, loadRides]);

  useEffect(() => {
    if (!isLoaded || !user) return;
    const interval = setInterval(() => {
      void loadRides();
    }, 20000);
    return () => clearInterval(interval);
  }, [isLoaded, user, loadRides]);

  // 🚗 DELETE RIDE
  const deleteRide = async (id) => {
    if (!window.confirm("Delete this ride? This cannot be undone.")) return;

    try {
      const res = await fetch(`/api/rides/${id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (data.success) {
        showSuccess("Ride deleted.");
        loadRides();
      } else {
        const msg = data.message || "Failed to delete ride";
        showError(msg);
      }
    } catch {
      showError("Network error while deleting the ride.");
    }
  };

  // 🚨 CANCEL BOOKING (NEW)
  const cancelBooking = async (rideId) => {
    if (!window.confirm("Cancel your booking for this ride?")) return;

    try {
      const res = await fetch("/api/bookings/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rideId,
        }),
      });

      const data = await res.json();

      if (data.success) {
        showSuccess("Booking cancelled.");
        setLiveByRide((prev) => {
          const next = { ...prev };
          delete next[rideId];
          return next;
        });
        loadRides();
      } else {
        const msg = data.message || "Failed to cancel booking";
        showError(msg);
      }
    } catch {
      showError("Network error while cancelling the booking.");
    }
  };

  const loadContacts = async (rideId) => {
    try {
      const res = await fetch(`/api/rides/${rideId}/contacts`);
      const data = await res.json();
      if (!data.success) {
        showError(data.message || "Failed to load contact details");
        return;
      }
      setContactsByRide((prev) => ({ ...prev, [rideId]: data }));
    } catch {
      showError("Network error while loading contact details.");
    }
  };

  const publishLiveLocation = useCallback(async (rideId, coords) => {
    const hasValidCoords =
      Array.isArray(coords) && coords.length === 2 && coords.every((value) => typeof value === "number");
    if (!hasValidCoords) return;
    try {
      await fetch(`/api/rides/${rideId}/live-location`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coords }),
      });
    } catch {}
  }, []);

  const startDriverTracking = (rideId) => {
    if (!navigator?.geolocation) {
      showError("Geolocation is not supported in this browser.");
      return;
    }
    if (watchRef.current.watchId !== null) {
      navigator.geolocation.clearWatch(watchRef.current.watchId);
      watchRef.current = { rideId: "", watchId: null };
    }
    setPublishingRideId(rideId);
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const coords = [position.coords.latitude, position.coords.longitude];
        publishLiveLocation(rideId, coords);
        setLiveByRide((prev) => ({
          ...prev,
          [rideId]: { coords, updatedAt: new Date().toISOString() },
        }));
      },
      () => {
        showError("Unable to read your location. Please allow location access.");
        setPublishingRideId("");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      }
    );
    watchRef.current = { rideId, watchId };
  };

  const stopDriverTracking = () => {
    if (watchRef.current.watchId !== null && navigator?.geolocation) {
      navigator.geolocation.clearWatch(watchRef.current.watchId);
    }
    watchRef.current = { rideId: "", watchId: null };
    setPublishingRideId("");
  };

  const fetchPassengerLiveLocation = useCallback(async (rideId) => {
    try {
      const res = await fetch(`/api/rides/${rideId}/live-location`, { cache: "no-store" });
      const data = await res.json();
      if (!data.success) {
        if (res.status === 403) {
          setLiveByRide((prev) => {
            const next = { ...prev };
            delete next[rideId];
            return next;
          });
        }
        return;
      }
      setLiveByRide((prev) => ({
        ...prev,
        [rideId]: data.liveLocation || { coords: [], updatedAt: null },
      }));
    } catch {}
  }, []);

  useEffect(() => {
    if (!joinedRides.length) return;
    joinedRides.forEach((ride) => fetchPassengerLiveLocation(ride._id || ride.id));
    const interval = setInterval(() => {
      joinedRides.forEach((ride) => fetchPassengerLiveLocation(ride._id || ride.id));
    }, 15000);
    return () => clearInterval(interval);
  }, [joinedRides, fetchPassengerLiveLocation]);

  useEffect(() => {
    return () => {
      if (watchRef.current.watchId !== null && navigator?.geolocation) {
        navigator.geolocation.clearWatch(watchRef.current.watchId);
      }
    };
  }, []);

  return (
    <>
      <Navbar />

      <div className={styles.page}>
        <div className={styles.container}>
          <h1 className={styles.title}>My Rides</h1>

          {error ? (
            <div className={`${styles.banner} ${styles.bannerError}`} role="alert">
              {error}
            </div>
          ) : null}

          {loading ? <p className={styles.empty}>Loading your rides…</p> : null}

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
                  <p><b>Bookings:</b> {(ride.bookedUsers || []).length}</p>

                  <div className={styles.rowActions}>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnDanger}`}
                      onClick={() => deleteRide(ride._id || ride.id)}
                      disabled={loading}
                    >
                      Delete Ride
                    </button>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnWarn}`}
                      onClick={() => startDriverTracking(ride._id || ride.id)}
                    >
                      {publishingRideId === (ride._id || ride.id) ? "Live Tracking On" : "Start Live Tracking"}
                    </button>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnDanger}`}
                      onClick={stopDriverTracking}
                      disabled={publishingRideId !== (ride._id || ride.id)}
                    >
                      Stop Tracking
                    </button>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnWarn}`}
                      onClick={() => loadContacts(ride._id || ride.id)}
                    >
                      Passenger Contacts
                    </button>
                  </div>
                  {contactsByRide[ride._id || ride.id]?.passengers?.length ? (
                    <div className={styles.banner} style={{ marginTop: "10px" }}>
                      <strong>Passengers</strong>
                      {contactsByRide[ride._id || ride.id].passengers.map((p) => (
                        <div key={p.email}>
                          {p.name} - {p.email} - {p.phone || "No phone"}
                          {p.pickupLabel ? ` - Pickup: ${p.pickupLabel}` : ""}
                          {typeof p.distanceFromDriverStartKm === "number"
                            ? ` (${p.distanceFromDriverStartKm.toFixed(1)} km from your start)`
                            : ""}
                        </div>
                      ))}
                    </div>
                  ) : null}
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

                  <div className={styles.rowActions}>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnWarn}`}
                      onClick={() => cancelBooking(ride._id || ride.id)}
                      disabled={loading}
                    >
                      Cancel Booking
                    </button>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnWarn}`}
                      onClick={() => loadContacts(ride._id || ride.id)}
                    >
                      Driver Contact
                    </button>
                  </div>
                  {Array.isArray(liveByRide[ride._id || ride.id]?.coords) &&
                  liveByRide[ride._id || ride.id].coords.length === 2 ? (
                    <div className={styles.banner} style={{ marginTop: "10px" }}>
                      <strong>Driver live location</strong>
                      {(() => {
                        const passengerPickup = contactsByRide[ride._id || ride.id]?.pickup?.coords;
                        const driverCoords = liveByRide[ride._id || ride.id].coords;
                        const km = haversineDistanceKm(driverCoords, passengerPickup);
                        const estimatedMinutes = typeof km === "number" ? Math.max(1, Math.round((km / 35) * 60)) : null;
                        return typeof km === "number" ? (
                          <div>
                            Driver is about {km.toFixed(1)} km away from your pickup
                            {estimatedMinutes ? ` (~${estimatedMinutes} min)` : ""}.
                          </div>
                        ) : null;
                      })()}
                      <div>
                        Lat: {Number(liveByRide[ride._id || ride.id].coords[0]).toFixed(5)}, Lng:{" "}
                        {Number(liveByRide[ride._id || ride.id].coords[1]).toFixed(5)}
                      </div>
                      <div>
                        Updated:{" "}
                        {liveByRide[ride._id || ride.id].updatedAt
                          ? new Date(liveByRide[ride._id || ride.id].updatedAt).toLocaleTimeString()
                          : "Unknown"}
                      </div>
                    </div>
                  ) : (
                    <div className={styles.banner} style={{ marginTop: "10px" }}>
                      Driver live location is not active yet.
                    </div>
                  )}
                  {contactsByRide[ride._id || ride.id]?.contact ? (
                    <div className={styles.banner} style={{ marginTop: "10px" }}>
                      <strong>Driver</strong>
                      <div>{contactsByRide[ride._id || ride.id].contact.name}</div>
                      <div>{contactsByRide[ride._id || ride.id].contact.email}</div>
                      <div>{contactsByRide[ride._id || ride.id].contact.phone || "No phone"}</div>
                      {contactsByRide[ride._id || ride.id].pickup?.label ? (
                        <div>
                          Your pickup: {contactsByRide[ride._id || ride.id].pickup.label}
                          {typeof contactsByRide[ride._id || ride.id].pickup
                            .distanceFromDriverStartKm === "number"
                            ? ` (${contactsByRide[ride._id || ride.id].pickup.distanceFromDriverStartKm.toFixed(1)} km from driver start)`
                            : ""}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
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