"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import styles from "./findRide.module.css";
import { getCurrentUser } from "@/lib/auth";

const FindRide = () => {
  const [rides, setRides] = useState([]);
  const [allRides, setAllRides] = useState([]);
  const [searched, setSearched] = useState(false);

  const [formData, setFormData] = useState({
    from: "",
    to: "",
    date: "",
    time: "",
    seats: 1,
    fare: "",
  });

  // 🚀 FETCH RIDES FROM MONGODB
  useEffect(() => {
    fetchRides();
  }, []);

  const fetchRides = async () => {
    const res = await fetch("/api/rides");
    const data = await res.json();

    if (data.success) {
      setAllRides(data.rides);
      setRides(data.rides);
    }
  };

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSearch = (e) => {
    e.preventDefault();

    const results = allRides.filter((ride) => {
      const matchesFare =
        formData.fare === "" ||
        (formData.fare === "free" && ride.price === "Free") ||
        (formData.fare === "paid" && ride.price !== "Free");

      return (
        ride.from.toLowerCase().includes(formData.from.toLowerCase()) &&
        ride.to.toLowerCase().includes(formData.to.toLowerCase()) &&
        ride.date === formData.date &&
        ride.time === formData.time &&
        ride.seats >= Number(formData.seats) &&
        matchesFare
      );
    });

    setRides(results);
    setSearched(true);
  };

  // 🚗 BOOK RIDE (MONGODB VERSION)
  const bookRide = async (rideId) => {
    const user = getCurrentUser();

    if (!user) {
      alert("Please login first!");
      return;
    }

    const res = await fetch("/api/bookings", {
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
      alert("Ride booked successfully 🚗");
      fetchRides(); // refresh updated seats
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

          <form className={styles.searchForm} onSubmit={handleSearch}>
            <div className={styles.inputGroup}>
              <div className={styles.inputLabelGroup}>
                <label>From</label>
                <input
                  type="text"
                  name="from"
                  value={formData.from}
                  onChange={handleChange}
                  required
                  className={styles.input}
                />
              </div>

              <div className={styles.inputLabelGroup}>
                <label>To</label>
                <input
                  type="text"
                  name="to"
                  value={formData.to}
                  onChange={handleChange}
                  required
                  className={styles.input}
                />
              </div>
            </div>

            <div className={styles.inputGroup}>
              <div className={styles.inputLabelGroup}>
                <label>Date</label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  required
                  className={styles.input}
                />
              </div>

              <div className={styles.inputLabelGroup}>
                <label>Time</label>
                <input
                  type="time"
                  name="time"
                  value={formData.time}
                  onChange={handleChange}
                  required
                  className={styles.input}
                />
              </div>
            </div>

            <div className={styles.inputGroup}>
              <div className={styles.inputLabelGroup}>
                <label>Seats Required</label>
                <input
                  type="number"
                  name="seats"
                  value={formData.seats}
                  onChange={handleChange}
                  className={styles.input}
                />
              </div>

              <div className={styles.inputLabelGroup}>
                <label>Fare</label>
                <select
                  name="fare"
                  value={formData.fare}
                  onChange={handleChange}
                  className={styles.input}
                >
                  <option value="">Any</option>
                  <option value="free">Free</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
            </div>

            <button type="submit" className={styles.searchButton}>
              Search
            </button>
          </form>

          <div className={styles.rideList}>
            {rides.length > 0 ? (
              rides.map((ride) => (
                <div key={ride._id || ride.id} className={styles.rideCard}>
                  <p><strong>Driver:</strong> {ride.driver}</p>
                  <p><strong>From:</strong> {ride.from}</p>
                  <p><strong>To:</strong> {ride.to}</p>
                  <p>
                    <strong>Date:</strong> {ride.date} |{" "}
                    <strong>Time:</strong> {ride.time}
                  </p>
                  <p>
                    <strong>Seats Available:</strong> {ride.seats}
                  </p>
                  <p>
                    <strong>Price:</strong>{" "}
                    {ride.price === "Free"
                      ? "Free"
                      : `${ride.price} BHD`}
                  </p>

                  <button
                    className={styles.bookButton}
                    onClick={() => bookRide(ride._id || ride.id)}
                  >
                    Book Ride
                  </button>
                </div>
              ))
            ) : searched ? (
              <p className={styles.noRides}>No rides found</p>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
};

export default FindRide;