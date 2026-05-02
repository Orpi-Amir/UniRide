import mongoose from "mongoose";

const rideSchema = new mongoose.Schema(
  {
    // 👤 Driver (temporary: Clerk email for now)
    driver: {
      type: String,
      required: true,
      trim: true,
    },

    // 📍 Route details
    from: {
      type: String,
      required: true,
      trim: true,
    },

    to: {
      type: String,
      required: true,
      trim: true,
    },

    // 📅 Schedule
    date: {
      type: String,
      required: true,
    },

    time: {
      type: String,
      required: true,
    },

    // 💺 Seats available
    seats: {
      type: Number,
      required: true,
      min: 1,
    },

    // 💰 Price (string allows "Free" or "5 BHD")
    price: {
      type: String,
      default: "Free",
      trim: true,
    },

    // 🚗 Users who booked this ride
    bookedUsers: {
      type: [String], // store emails for now
      default: [],
    },
  },
  {
    timestamps: true, // createdAt + updatedAt
  }
);

// 🧠 Prevent model overwrite in dev (Next.js fix)
export default mongoose.models.Ride || mongoose.model("Ride", rideSchema);