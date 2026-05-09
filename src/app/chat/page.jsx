"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import Navbar from "@/components/Navbar";
import RideChat from "@/components/RideChat";
import { useToast } from "@/components/ToastProvider";
import { isRideChatParticipant, normalizeEmail } from "@/lib/rideParticipant";
import styles from "./chat.module.css";

function rideStatusForUser(ride, currentEmail) {
  const isDriver = normalizeEmail(ride.driver) === currentEmail;
  if (isDriver) {
    const pending = (ride.bookingRequests || []).filter(
      (r) => (r.status || "pending").toLowerCase() === "pending"
    );
    const confirmed = (ride.bookedUsers || []).filter(
      (e) => normalizeEmail(e) !== currentEmail
    );
    return { role: "driver", pending: pending.length, confirmed: confirmed.length };
  }
  const isConfirmed = (ride.bookedUsers || []).some(
    (e) => normalizeEmail(e) === currentEmail
  );
  if (isConfirmed) return { role: "passenger", state: "confirmed" };
  const myRequest = (ride.bookingRequests || []).find(
    (r) => normalizeEmail(r.email) === currentEmail
  );
  const status = (myRequest?.status || "").toLowerCase();
  return {
    role: "passenger",
    state: status === "pending" ? "pending" : status || "unknown",
  };
}

export default function ChatPage() {
  const { user, isLoaded } = useUser();
  const { showError, showSuccess } = useToast();
  const [rides, setRides] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [selectedRideId, setSelectedRideId] = useState("");
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsByRideId, setContactsByRideId] = useState({});
  const [pendingActionEmail, setPendingActionEmail] = useState("");

  const currentEmail = normalizeEmail(
    user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || ""
  );

  const loadRides = useCallback(async () => {
    if (!isLoaded || !currentEmail) return;
    try {
      const res = await fetch("/api/rides", { cache: "no-store" });
      const data = await res.json();
      if (!data.success) {
        showError(data.message || "Failed to load rides for chat");
        return;
      }

      const participantRides = (data.rides || []).filter((ride) =>
        isRideChatParticipant(ride, currentEmail)
      );

      setRides(participantRides);
      // Important: do NOT auto-select. Let the user pick the conversation.
      setSelectedRideId((prev) => {
        if (!prev) return "";
        const stillThere = participantRides.some((r) => String(r._id) === String(prev));
        return stillThere ? String(prev) : "";
      });
    } catch {
      showError("Network error while loading chats");
    }
  }, [isLoaded, currentEmail, showError]);

  useEffect(() => {
    if (!isLoaded || !currentEmail) return;

    let cancelled = false;
    queueMicrotask(() => {
      setListLoading(true);
      void loadRides().finally(() => {
        if (!cancelled) setListLoading(false);
      });
    });

    const interval = setInterval(() => {
      void loadRides();
    }, 20000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isLoaded, currentEmail, loadRides]);

  const loading = !isLoaded || listLoading;

  const fetchContacts = useCallback(
    async (rideId) => {
      if (!rideId || !currentEmail) return;
      try {
        const res = await fetch(`/api/rides/${rideId}/contacts`, { cache: "no-store" });
        const data = await res.json();
        if (!data.success) return;
        setContactsByRideId((prev) => ({ ...prev, [String(rideId)]: data }));
      } catch {
        /* optional panel */
      }
    },
    [currentEmail]
  );

  useEffect(() => {
    if (!selectedRideId || !currentEmail) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setContactsLoading(true);
      void fetchContacts(selectedRideId).finally(() => {
        if (!cancelled) setContactsLoading(false);
      });
    });

    return () => {
      cancelled = true;
    };
  }, [selectedRideId, currentEmail, fetchContacts]);

  const selectedRide = useMemo(
    () => rides.find((r) => String(r._id) === String(selectedRideId)) || null,
    [rides, selectedRideId]
  );

  const contactsPayload = contactsByRideId[String(selectedRideId)] || null;

  const { drivingRides, passengerRides } = useMemo(() => {
    const driving = [];
    const passenger = [];
    for (const ride of rides) {
      if (normalizeEmail(ride.driver) === currentEmail) driving.push(ride);
      else passenger.push(ride);
    }
    return { drivingRides: driving, passengerRides: passenger };
  }, [rides, currentEmail]);

  const selectedStatus = useMemo(() => {
    if (!selectedRide) return null;
    return rideStatusForUser(selectedRide, currentEmail);
  }, [selectedRide, currentEmail]);

  const handleAccept = async (passengerEmail) => {
    if (!selectedRide) return;
    try {
      setPendingActionEmail(passengerEmail);
      const res = await fetch("/api/bookings/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rideId: selectedRideId, passengerEmail }),
      });
      const data = await res.json();
      if (!data.success) {
        showError(data.message || "Failed to accept booking");
        return;
      }
      showSuccess("Booking accepted. Passenger is now confirmed.");
      await Promise.all([loadRides(), fetchContacts(selectedRideId)]);
    } catch {
      showError("Network error while accepting booking");
    } finally {
      setPendingActionEmail("");
    }
  };

  const handleDecline = async (passengerEmail) => {
    if (!selectedRide) return;
    if (!window.confirm("Decline this booking request?")) return;
    try {
      setPendingActionEmail(passengerEmail);
      const res = await fetch("/api/bookings/decline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rideId: selectedRideId, passengerEmail }),
      });
      const data = await res.json();
      if (!data.success) {
        showError(data.message || "Failed to decline booking");
        return;
      }
      showSuccess("Booking request declined.");
      await Promise.all([loadRides(), fetchContacts(selectedRideId)]);
    } catch {
      showError("Network error while declining booking");
    } finally {
      setPendingActionEmail("");
    }
  };

  const renderDriverContactCard = () => {
    if (!contactsPayload?.success) return null;
    if (contactsPayload.contactType !== "driver") return null;
    const { contact, pickup, passengerStatus } = contactsPayload;

    if (passengerStatus === "pending") {
      return (
        <div className={`${styles.contactCard} ${styles.pendingCard}`}>
          <div className={styles.contactTitle}>Waiting for driver</div>
          <p className={styles.cardMuted}>
            Your request to join this ride is pending. Driver{" "}
            <strong>{contact?.name || "Driver"}</strong> hasn’t accepted yet — full contact and live
            tracking will unlock once they do.
          </p>
          {pickup?.label ? (
            <div className={styles.pickupHint}>
              Your pickup: {pickup.label}
            </div>
          ) : null}
        </div>
      );
    }

    if (passengerStatus !== "confirmed") {
      return (
        <div className={styles.contactCard}>
          <div className={styles.contactTitle}>Driver</div>
          <div className={styles.contactName}>{contact?.name || "Driver"}</div>
          <p className={styles.cardMuted}>You aren’t confirmed on this ride yet.</p>
        </div>
      );
    }

    return (
      <div className={styles.contactCard}>
        <div className={styles.contactTitle}>Your driver</div>
        <div className={styles.contactName}>{contact?.name || "Driver"}</div>
        {contact?.phone ? (
          <a className={styles.contactLink} href={`tel:${contact.phone}`}>
            {contact.phone}
          </a>
        ) : (
          <span className={styles.cardMuted}>Phone not on profile</span>
        )}
        {pickup?.label ? (
          <div className={styles.pickupHint}>Pickup: {pickup.label}</div>
        ) : null}
      </div>
    );
  };

  const renderDriverPassengerCard = () => {
    if (!contactsPayload?.success) return null;
    if (contactsPayload.contactType !== "passengers") return null;
    const passengers = contactsPayload.passengers || [];
    const confirmed = passengers.filter((p) => p.bookingStatus === "confirmed");
    const pending = passengers.filter((p) => p.bookingStatus === "pending");

    return (
      <div className={styles.contactCard}>
        <div className={styles.contactTitle}>People on this ride</div>
        {pending.length > 0 ? (
          <div className={styles.pendingSection}>
            <div className={styles.pendingHeader}>
              {pending.length} pending request{pending.length !== 1 ? "s" : ""}
            </div>
            <ul className={styles.contactList}>
              {pending.map((p) => (
                <li key={p.email} className={styles.contactRow}>
                  <div className={styles.passengerLine}>
                    <span className={styles.contactName}>
                      {p.name || p.email}
                      <span className={`${styles.badge} ${styles.badgePending}`}>Pending</span>
                    </span>
                    <span className={styles.cardMuted}>
                      Phone hidden until you accept
                    </span>
                  </div>
                  {p.pickupLabel ? (
                    <div className={styles.pickupHint}>Pickup: {p.pickupLabel}</div>
                  ) : null}
                  <div className={styles.actionRow}>
                    <button
                      type="button"
                      className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                      onClick={() => handleAccept(p.email)}
                      disabled={pendingActionEmail === p.email}
                    >
                      {pendingActionEmail === p.email ? "Accepting…" : "Accept"}
                    </button>
                    <button
                      type="button"
                      className={`${styles.actionBtn} ${styles.actionBtnGhost}`}
                      onClick={() => handleDecline(p.email)}
                      disabled={pendingActionEmail === p.email}
                    >
                      Decline
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {confirmed.length > 0 ? (
          <ul className={styles.contactList}>
            {confirmed.map((p) => (
              <li key={p.email} className={styles.contactRow}>
                <div className={styles.passengerLine}>
                  <span className={styles.contactName}>
                    {p.name || p.email}
                    <span className={`${styles.badge} ${styles.badgeConfirmed}`}>
                      Confirmed
                    </span>
                  </span>
                  {p.phone ? (
                    <a className={styles.contactLink} href={`tel:${p.phone}`}>
                      {p.phone}
                    </a>
                  ) : (
                    <span className={styles.cardMuted}>No phone on profile</span>
                  )}
                </div>
                {p.pickupLabel ? (
                  <div className={styles.pickupHint}>Pickup: {p.pickupLabel}</div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        {confirmed.length === 0 && pending.length === 0 ? (
          <span className={styles.cardMuted}>No passengers yet.</span>
        ) : null}
      </div>
    );
  };

  const renderContactsCard = () => {
    if (!selectedRide) return null;
    if (contactsLoading && !contactsPayload) {
      return <p className={styles.cardMuted}>Loading details…</p>;
    }
    if (contactsPayload?.contactType === "driver") return renderDriverContactCard();
    if (contactsPayload?.contactType === "passengers") return renderDriverPassengerCard();
    return null;
  };

  const renderThreadItems = (list, emptyHint) => {
    if (list.length === 0) {
      return <p className={styles.sectionEmpty}>{emptyHint}</p>;
    }
    return (
      <ul className={styles.threadList}>
        {list.map((ride) => {
          const id = String(ride._id);
          const active = id === String(selectedRideId);
          const status = rideStatusForUser(ride, currentEmail);
          const headline =
            status.role === "driver"
              ? `${ride.from} → ${ride.to}`
              : normalizeEmail(ride.driver);

          return (
            <li key={id}>
              <button
                type="button"
                className={`${styles.threadBtn} ${active ? styles.threadBtnActive : ""}`}
                onClick={() => setSelectedRideId(id)}
              >
                <span className={styles.threadRole}>
                  {status.role === "driver" ? "You drive" : "You’re a passenger"}
                </span>
                <span className={styles.threadHeadline}>{headline}</span>
                <span className={styles.threadMeta}>
                  {ride.date} · {ride.time}
                </span>
                {status.role === "driver" && status.pending > 0 ? (
                  <span className={styles.threadBadge}>
                    {status.pending} pending request{status.pending !== 1 ? "s" : ""}
                  </span>
                ) : null}
                {status.role === "passenger" ? (
                  <span
                    className={`${styles.threadBadge} ${
                      status.state === "confirmed"
                        ? styles.threadBadgeOk
                        : status.state === "pending"
                          ? styles.threadBadgeWait
                          : styles.threadBadgeMuted
                    }`}
                  >
                    {status.state === "confirmed"
                      ? "Confirmed"
                      : status.state === "pending"
                        ? "Awaiting acceptance"
                        : "Inactive"}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    );
  };

  const isPendingPassenger =
    selectedStatus?.role === "passenger" && selectedStatus.state === "pending";
  const lockedMessage = isPendingPassenger
    ? "Chat opens once the driver accepts your booking. We'll notify you."
    : "";
  const isThreadOpen = Boolean(selectedRide);

  return (
    <>
      <Navbar />
      <div className={styles.page}>
        <div className={`${styles.container} ${isThreadOpen ? styles.containerWithThread : ""}`}>
          <aside
            className={`${styles.sidebar} ${isThreadOpen ? styles.sidebarHiddenMobile : ""}`}
          >
            <h1 className={styles.title}>Messages</h1>
            <p className={styles.lede}>
              Pick a conversation to open it. Drivers can accept or decline pending requests right here.
            </p>
            {loading ? (
              <p className={styles.cardMuted}>Loading…</p>
            ) : rides.length === 0 ? (
              <p className={styles.cardMuted}>
                No conversations yet. Request or offer a ride, then open Chat again.
              </p>
            ) : (
              <>
                <div className={styles.sectionLabel}>Rides you offer</div>
                {renderThreadItems(drivingRides, "No chats for rides you host yet.")}
                <div className={`${styles.sectionLabel} ${styles.sectionLabelSpaced}`}>
                  Rides you joined
                </div>
                {renderThreadItems(passengerRides, "No chats as a passenger yet.")}
              </>
            )}
          </aside>

          <main
            className={`${styles.main} ${isThreadOpen ? "" : styles.mainHiddenMobile}`}
          >
            {selectedRide ? (
              <>
                <header className={styles.threadHeader}>
                  <button
                    type="button"
                    className={styles.backBtn}
                    onClick={() => setSelectedRideId("")}
                    aria-label="Back to conversations"
                  >
                    ← Conversations
                  </button>
                  <div>
                    <h2 className={styles.threadTitle}>
                      {selectedRide.from} → {selectedRide.to}
                    </h2>
                    <p className={styles.threadSub}>
                      {selectedRide.date} · {selectedRide.time} ·{" "}
                      {selectedStatus?.role === "driver" ? "You are the driver" : "You are a passenger"}
                    </p>
                  </div>
                </header>

                {renderContactsCard()}

                <section className={styles.chatSection}>
                  <RideChat
                    rideId={selectedRideId}
                    currentUserEmail={currentEmail}
                    onError={showError}
                    locked={isPendingPassenger}
                    lockedMessage={lockedMessage}
                  />
                </section>
              </>
            ) : (
              <div className={styles.emptyState}>
                <h2 className={styles.emptyTitle}>Select a conversation</h2>
                <p className={styles.cardMuted}>
                  Click a ride on the left to open the thread. Your chats stay private to the driver and
                  passengers of that ride.
                </p>
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  );
}
