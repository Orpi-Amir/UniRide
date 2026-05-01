import mongoose from "mongoose";

const rideSchema = new mongoose.Schema(
  {
    driver: {
      type: String,
      required: true,
    },
    from: {
      type: String,
      required: true,
    },
    to: {
      type: String,
      required: true,
    },
    date: {
      type: String,
      required: true,
    },
    time: {
      type: String,
      required: true,
    },
    seats: {
      type: Number,
      required: true,
    },
    price: {
      type: String,
      default: "Free",
    },

    // 🚀 NEW: Track who booked this ride
    bookedUsers: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

export default mongoose.models.Ride || mongoose.model("Ride", rideSchema);