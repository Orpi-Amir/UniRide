export default function RideCard({ ride, styles }) {
  return (
    <div className={styles.rideCard}>
      <p><strong>Driver:</strong> {ride.driver}</p>
      <p><strong>From:</strong> {ride.from}</p>
      <p><strong>To:</strong> {ride.to}</p>
      <p>
        <strong>Date:</strong> {ride.date} | <strong>Time:</strong> {ride.time}
      </p>
      <p><strong>Seats Available:</strong> {ride.seats}</p>
      <p>
        <strong>Price:</strong>{" "}
        {ride.price === "Free" ? "Free" : `${ride.price} BHD`}
      </p>

      <button className={styles.bookButton}>
        Book Ride
      </button>
    </div>
  );
}