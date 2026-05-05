"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import dynamic from "next/dynamic";
import styles from "./findRide.module.css";
import { useUser } from "@clerk/nextjs";
import { isValidUniversityEmail } from "@/lib/universityEmailValidator";
import { useToast } from "@/components/ToastProvider";
import { useRouter } from "next/navigation";

// 🗺️ Safe Leaflet import
const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
});

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

const FindRide = () => {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const { showSuccess, showError } = useToast();

  const [rides, setRides] = useState([]);
  const [allRides, setAllRides] = useState([]);
  const [searched, setSearched] = useState(false);

  const [formData, setFormData] = useState({
    from: "",
    to: "",
    seats: 1,
  });
  const [bookingRideId, setBookingRideId] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedRouteCoords, setSelectedRouteCoords] = useState(null);
  const [rideContacts, setRideContacts] = useState({});
  const [pickupCoords, setPickupCoords] = useState([]);

  // 📡 FETCH RIDES
  useEffect(() => {
    const fetchRides = async () => {
      try {
        setLoadingList(true);
        setListError("");
        const res = await fetch("/api/rides");
        const data = await res.json();

        if (data.success) {
          setAllRides(data.rides);
          setRides(data.rides);
        } else {
          setListError(data.message || "Failed to load rides.");
        }
      } catch {
        setListError("Network error while loading rides.");
      } finally {
        setLoadingList(false);
      }
    };

    fetchRides();
  }, []);

  // ✏️ INPUT
  const handleChange = (e) => {
    setNotice("");
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  // 🔍 SEARCH (IMPROVED LOGIC)
  const handleSearch = (e) => {
    e.preventDefault();
    setNotice("");

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

    setRides(results);
    setSearched(true);
  };

  // 🚗 BOOK RIDE
  const bookRide = async (rideId) => {
    setNotice("");

    if (!isLoaded) {
      setNotice("Authentication is still loading. Please wait a moment.");
      return;
    }

    if (!user) {
      router.push("/auth/login");
      return;
    }
    const userEmail =
      user.primaryEmailAddress?.emailAddress || user.emailAddresses?.[0]?.emailAddress;
    if (!userEmail || !isValidUniversityEmail(userEmail)) {
      setNotice("UniRide is only available for approved university email accounts.");
      return;
    }

    try {
      setBookingRideId(rideId);
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rideId,
          pickupCoords: Array.isArray(pickupCoords) && pickupCoords.length === 2 ? pickupCoords : undefined,
          pickupLabel: formData.from || "",
        }),
      });

      const data = await res.json();

      if (data.success) {
        showSuccess("Ride booked successfully.");
        setAllRides((prev) =>
          prev.map((ride) =>
            ride._id === rideId ? { ...ride, seats: Math.max(ride.seats - 1, 0) } : ride
          )
        );
        setRides((prev) =>
          prev.map((ride) =>
            ride._id === rideId ? { ...ride, seats: Math.max(ride.seats - 1, 0) } : ride
          )
        );
        await loadRideContacts(rideId);
      } else {
        const msg = data.message || "Booking failed";
        setNotice(msg);
        showError(msg);
      }
    } catch {
      const msg = "Network error while booking. Please try again.";
      setNotice(msg);
      showError(msg);
    } finally {
      setBookingRideId("");
    }
  };

  const loadRideContacts = async (rideId) => {
    try {
      const res = await fetch(`/api/rides/${rideId}/contacts`);
      const data = await res.json();
      if (!data.success) {
        showError(data.message || "Failed to load contact details");
        return;
      }
      setRideContacts((prev) => ({ ...prev, [rideId]: data }));
    } catch {
      showError("Network error while loading contact details.");
    }
  };

  return (
    <>
      <Navbar />

      <div className={styles.page}>
        <div className={styles.container}>
          <h1 className={styles.title}>Find a Ride</h1>
          <p className={styles.desc}>Search and book rides easily</p>

          <div className={styles.statusRow}>
            <div className={styles.muted}>
              {loadingList ? "Loading rides…" : `${rides.length} ride${rides.length === 1 ? "" : "s"} shown`}
            </div>
          </div>

          {listError ? (
            <div className={`${styles.banner} ${styles.bannerError}`} role="alert">
              {listError}
            </div>
          ) : null}

          {notice ? (
            <div className={`${styles.banner} ${styles.bannerError}`} role="status">
              {notice}
            </div>
          ) : null}

          {/* 🗺️ MAP */}
          <div className={styles.mapWrap}>
            <MapView
              rides={rides}
              routeFromCurrentToCoords={selectedRouteCoords}
              setFromCoords={(coords) => setPickupCoords(coords)}
              setFromLocation={(location) =>
                setFormData((prev) => ({ ...prev, from: location }))
              }
              setToLocation={(location) =>
                setFormData((prev) => ({ ...prev, to: location }))
              }
            />
          </div>

          <p className={styles.hint}>
            Click the map to auto-fill pickup and dropoff, or use the text search below.
          </p>
          {Array.isArray(pickupCoords) && pickupCoords.length === 2 ? (
            <p className={styles.hint}>Your pickup location will be shared with the driver after booking.</p>
          ) : null}

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

            <button type="submit" className={styles.searchButton} disabled={loadingList}>
              Search
            </button>
          </form>

          {/* 🚗 RESULTS */}
          <div className={styles.rideList}>
            {loadingList ? (
              <p className={styles.noRides}>Loading rides…</p>
            ) : rides.length > 0 ? (
              rides.map((ride) => (
                <div key={ride._id} className={styles.rideCard}>
                  <p><strong>Driver:</strong> {ride.driver}</p>
                  <p><strong>From:</strong> {ride.from}</p>
                  <p><strong>To:</strong> {ride.to}</p>
                  <p><strong>Date:</strong> {ride.date}</p>
                  <p><strong>Time:</strong> {ride.time}</p>
                  <p><strong>Seats:</strong> {ride.seats}</p>
                  <p><strong>Price:</strong> {ride.price}</p>
                  {Array.isArray(pickupCoords) &&
                  pickupCoords.length === 2 &&
                  Array.isArray(ride.fromCoords) &&
                  ride.fromCoords.length === 2 ? (
                    <p>
                      <strong>Distance from your pickup to driver start:</strong>{" "}
                      {haversineDistanceKm(pickupCoords, ride.fromCoords)?.toFixed(1)} km
                    </p>
                  ) : null}

                  <button
                    className={styles.bookButton}
                    onClick={() => bookRide(ride._id)}
                    disabled={ride.seats <= 0 || bookingRideId === ride._id}
                  >
                    {ride.seats <= 0
                      ? "No Seats Left"
                      : bookingRideId === ride._id
                      ? "Booking..."
                      : "Book Ride"}
                  </button>

                  <div style={{ display: "flex", gap: "10px", marginTop: "10px", flexWrap: "wrap" }}>
                    <button
                      className={styles.bookButton}
                      type="button"
                      onClick={() =>
                        setSelectedRouteCoords(
                          Array.isArray(ride.fromCoords) && ride.fromCoords.length === 2
                            ? ride.fromCoords
                            : null
                        )
                      }
                      disabled={!Array.isArray(ride.fromCoords) || ride.fromCoords.length !== 2}
                    >
                      Route to Pickup
                    </button>
                    <button
                      className={styles.bookButton}
                      type="button"
                      onClick={() => loadRideContacts(ride._id)}
                    >
                      Show Driver Contact
                    </button>
                  </div>

                  {rideContacts[ride._id]?.contact ? (
                    <div className={`${styles.banner} ${styles.statusRow ? "" : ""}`} style={{ marginTop: "12px" }}>
                      <strong>Driver Contact</strong>
                      <div>Name: {rideContacts[ride._id].contact.name || "N/A"}</div>
                      <div>Email: {rideContacts[ride._id].contact.email || "N/A"}</div>
                      <div>Phone: {rideContacts[ride._id].contact.phone || "N/A"}</div>
                    </div>
                  ) : null}
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