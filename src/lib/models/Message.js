import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    rideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ride",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["message", "location", "system"],
      default: "message",
    },
    text: {
      type: String,
      default: "",
      trim: true,
    },
    coords: {
      type: [Number],
      default: [],
      validate: {
        validator: (value) => value.length === 0 || value.length === 2,
        message: "coords must be empty or [lat, lng]",
      },
    },
    senderEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    senderName: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

messageSchema.index({ rideId: 1, createdAt: 1 });

export default mongoose.models.Message || mongoose.model("Message", messageSchema);
