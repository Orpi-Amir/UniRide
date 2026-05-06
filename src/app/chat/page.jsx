"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import Navbar from "@/components/Navbar";
import RideChat from "@/components/RideChat";
import { useToast } from "@/components/ToastProvider";
import { isRideChatParticipant, normalizeEmail } from "@/lib/rideParticipant";
import styles from "./chat.module.css";

export default function ChatPage() {
  const { user, isLoaded } = useUser();
  const { showError } = useToast();
  const [rides, setRides] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [selectedRideId, setSelectedRideId] = useState("");
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsByRideId, setContactsByRideId] = useState({});

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
      setSelectedRideId((prev) => {
        const prevStr = prev ? String(prev) : "";
        const stillThere =
          prevStr && participantRides.some((r) => String(r._id) === prevStr);
        if (stillThere) return prevStr;
        return participantRides[0]?._id ? String(participantRides[0]._id) : "";
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

  useEffect(() => {
    if (!selectedRideId || !currentEmail) return;

    let cancelled = false;
    (async () => {
      setContactsLoading(true);
      try {
        const res = await fetch(`/api/rides/${selectedRideId}/contacts`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!data.success || cancelled) return;
        setContactsByRideId((prev) => ({
          ...prev,
          [String(selectedRideId)]: data,
        }));
      } catch {
        /* optional panel */
      } finally {
        if (!cancelled) setContactsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedRideId, currentEmail]);

  const selectedRide = useMemo(
    () => rides.find((r) => String(r._id) === String(selectedRideId)) || null,
    [rides, selectedRideId]
  );

  const contactsPayload = contactsByRideId[String(selectedRideId)] || null;

  const rideParticipantsSummary = useMemo(() => {
    if (!selectedRide || !currentEmail) return { headline: "", sub: "" };
    const isDriver = normalizeEmail(selectedRide.driver) === currentEmail;

    if (isDriver) {
      const confirmed = (selectedRide.bookedUsers || []).filter(
        (e) => normalizeEmail(e) !== currentEmail
      );
      const pending = (selectedRide.bookingRequests || [])
        .filter((r) => (r.status || "pending").toLowerCase() === "pending")
        .map((r) => r.email)
        .filter((e) => normalizeEmail(e) !== currentEmail);

      const parts = [];
      if (confirmed.length)
        parts.push(`${confirmed.length} confirmed passenger${confirmed.length !== 1 ? "s" : ""}`);
      if (pending.length)
        parts.push(`${pending.length} pending request${pending.length !== 1 ? "s" : ""}`);
      return {
        headline: parts.length ? parts.join(" · ") : "No passengers yet",
        sub: `${selectedRide.from} → ${selectedRide.to}`,
      };
    }

    return {
      headline: normalizeEmail(selectedRide.driver),
      sub: `${selectedRide.from} → ${selectedRide.to}`,
    };
  }, [selectedRide, currentEmail]);

  const renderContactsCard = () => {
    if (!selectedRide) return null;
    if (contactsLoading && !contactsPayload) {
      return <p className={styles.cardMuted}>Loading contacts…</p>;
    }
    if (!contactsPayload?.success) return null;

    if (contactsPayload.contactType === "driver") {
      const c = contactsPayload.contact;
      return (
        <div className={styles.contactCard}>
          <div className={styles.contactTitle}>Your driver</div>
          <div className={styles.contactName}>{c?.name || "Driver"}</div>
          {c?.phone ? (
            <a className={styles.contactLink} href={`tel:${c.phone}`}>
              {c.phone}
            </a>
          ) : (
            <span className={styles.cardMuted}>Phone not on profile</span>
          )}
          {contactsPayload.pickup?.label ? (
            <div className={styles.pickupHint}>
              Pickup: {contactsPayload.pickup.label}
            </div>
          ) : null}
        </div>
      );
    }

    const passengers = contactsPayload.passengers || [];
    return (
      <div className={styles.contactCard}>
        <div className={styles.contactTitle}>People on this ride</div>
        {passengers.length === 0 ? (
          <span className={styles.cardMuted}>No passengers yet.</span>
        ) : (
          <ul className={styles.contactList}>
            {passengers.map((p) => (
              <li key={p.email} className={styles.contactRow}>
                <span className={styles.contactName}>
                  {p.name || p.email}
                  {p.bookingStatus === "pending" ? (
                    <span className={styles.badge}>Pending</span>
                  ) : null}
                </span>
                {p.phone ? (
                  <a className={styles.contactLink} href={`tel:${p.phone}`}>
                    {p.phone}
                  </a>
                ) : (
                  <span className={styles.cardMuted}>No phone</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <>
      <Navbar />
      <div className={styles.page}>
        <div className={styles.container}>
          <aside className={styles.sidebar}>
            <h1 className={styles.title}>Messages</h1>
            <p className={styles.lede}>
              Chat with your driver or passengers for pickup timing and updates — same thread before and after the driver accepts you.
            </p>
            {loading ? (
              <p className={styles.cardMuted}>Loading…</p>
            ) : rides.length === 0 ? (
              <p className={styles.cardMuted}>
                No conversations yet. Request or offer a ride, then open Chat again.
              </p>
            ) : (
              <ul className={styles.threadList}>
                {rides.map((ride) => {
                  const id = String(ride._id);
                  const active = id === String(selectedRideId);
                  const isDrv = normalizeEmail(ride.driver) === currentEmail;
                  const headline = isDrv
                    ? `Your ride · ${ride.from} → ${ride.to}`
                    : `${normalizeEmail(ride.driver)}`;

                  const pendingYou = (ride.bookingRequests || []).some(
                    (r) =>
                      normalizeEmail(r.email) === currentEmail &&
                      (r.status || "pending").toLowerCase() === "pending"
                  );
                  const confirmedYou = (ride.bookedUsers || []).some(
                    (e) => normalizeEmail(e) === currentEmail
                  );

                  return (
                    <li key={id}>
                      <button
                        type="button"
                        className={`${styles.threadBtn} ${active ? styles.threadBtnActive : ""}`}
                        onClick={() => setSelectedRideId(id)}
                      >
                        <span className={styles.threadHeadline}>{headline}</span>
                        <span className={styles.threadMeta}>
                          {ride.date} · {ride.time}
                          {!isDrv ? (
                            <>
                              {" "}
                              ·{" "}
                              {confirmedYou
                                ? "Confirmed"
                                : pendingYou
                                  ? "Request pending"
                                  : "Chat"}
                            </>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>

          <main className={styles.main}>
            {selectedRide ? (
              <>
                <header className={styles.threadHeader}>
                  <div>
                    <h2 className={styles.threadTitle}>{rideParticipantsSummary.headline}</h2>
                    <p className={styles.threadSub}>{rideParticipantsSummary.sub}</p>
                  </div>
                </header>

                {renderContactsCard()}

                <section className={styles.chatSection}>
                  <RideChat
                    rideId={selectedRideId}
                    currentUserEmail={currentEmail}
                    onError={showError}
                  />
                </section>
              </>
            ) : (
              <p className={styles.cardMuted}>Pick a conversation to open the thread.</p>
            )}
          </main>
        </div>
      </div>
    </>
  );
}
