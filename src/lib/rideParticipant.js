/** Normalize email for comparisons across ride docs */
export function normalizeEmail(email) {
  return (email || "").toLowerCase().trim();
}

/** Driver, confirmed passenger, or passenger with a non-rejected booking request may use ride chat & contacts. */
export function isRideChatParticipant(ride, email) {
  const e = normalizeEmail(email);
  if (!e || !ride) return false;
  if (normalizeEmail(ride.driver) === e) return true;
  if ((ride.bookedUsers || []).some((x) => normalizeEmail(x) === e)) return true;
  return (ride.bookingRequests || []).some((r) => {
    if (normalizeEmail(r.email) !== e) return false;
    const status = (r.status || "pending").toLowerCase();
    return status !== "rejected";
  });
}
