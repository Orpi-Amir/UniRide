import Ably from "ably";
import Message from "@/lib/models/Message";
import { parseAblyRootKey } from "@/lib/ablyRootKey";

export function rideChannelName(rideId) {
  return `ride:${String(rideId)}`;
}

export function serializeMessage(doc) {
  if (!doc) return null;
  const obj = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return {
    id: String(obj._id),
    rideId: String(obj.rideId),
    type: obj.type || "message",
    text: obj.text || "",
    coords: Array.isArray(obj.coords) ? obj.coords : [],
    senderEmail: (obj.senderEmail || "").toLowerCase().trim(),
    sender: obj.senderName || obj.senderEmail || "Unknown",
    timestamp: obj.createdAt ? new Date(obj.createdAt).getTime() : Date.now(),
  };
}

export async function publishSystemMessage(rideId, text, { skipAbly = false } = {}) {
  if (!rideId || !text) return null;
  let saved = null;
  try {
    saved = await Message.create({
      rideId,
      type: "system",
      text,
      coords: [],
      senderEmail: "system",
      senderName: "System",
    });
  } catch {
    saved = null;
  }
  if (skipAbly) return saved ? serializeMessage(saved) : null;

  try {
    const parsed = parseAblyRootKey(process.env.ABLY_API_KEY);
    if (parsed.ok && saved) {
      const rest = new Ably.Rest(parsed.key);
      const payload = serializeMessage(saved);
      await rest.channels.get(rideChannelName(rideId)).publish("message", {
        id: payload.id,
        type: "system",
        text: payload.text,
        coords: [],
        sender: "System",
        senderEmail: "system",
        timestamp: payload.timestamp,
      });
    }
  } catch {}

  return saved ? serializeMessage(saved) : null;
}

export async function publishUserMessage({ rideId, text, type, coords, senderEmail, senderName }) {
  if (!rideId || !senderEmail) return null;
  const cleanType = type === "location" ? "location" : "message";
  const cleanCoords =
    cleanType === "location" && Array.isArray(coords) && coords.length === 2 ? coords : [];

  const saved = await Message.create({
    rideId,
    type: cleanType,
    text: typeof text === "string" ? text.trim() : "",
    coords: cleanCoords,
    senderEmail: senderEmail.toLowerCase().trim(),
    senderName: senderName || senderEmail,
  });

  try {
    const parsed = parseAblyRootKey(process.env.ABLY_API_KEY);
    if (parsed.ok) {
      const rest = new Ably.Rest(parsed.key);
      const payload = serializeMessage(saved);
      await rest.channels.get(rideChannelName(rideId)).publish("message", {
        id: payload.id,
        type: payload.type,
        text: payload.text,
        coords: payload.coords,
        sender: payload.sender,
        senderEmail: payload.senderEmail,
        timestamp: payload.timestamp,
      });
    }
  } catch {}

  return serializeMessage(saved);
}
