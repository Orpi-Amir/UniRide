"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import styles from "./profile.module.css";
import { useUser } from "@clerk/nextjs";
import { isValidUniversityEmail } from "@/lib/universityEmailValidator";
import { universities } from "@/lib/universities";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";

export default function ProfilePage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const { showSuccess, showError } = useToast();

  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    university: "",
    phone: "",
    bio: "",
  });
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isLoaded && user && !initialized) {
      const primaryEmail = user.primaryEmailAddress?.emailAddress || "";
      // validate with your global validator
      if (!isValidUniversityEmail(primaryEmail)) {
        router.push("/auth/not-university");
        return;
      }

      const bootstrapProfile = async () => {
        try {
          const res = await fetch("/api/users/me");
          const data = await res.json();
          if (data.success) {
            setFormData({
              fullName: data.user.name || user.fullName || "",
              university: data.user.university || "",
              phone: data.user.phone || user.phoneNumbers?.[0]?.phoneNumber || "",
              bio: data.user.bio || "",
            });
          }
        } finally {
          setInitialized(true);
        }
      };

      bootstrapProfile();
    }
  }, [isLoaded, user, initialized, router]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      if (user?.update && formData.fullName.trim()) {
        const nameParts = formData.fullName.trim().split(/\s+/);
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(" ");
        await user.update({
          firstName,
          lastName: lastName || null,
        });
      }

      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();

      if (!data.success) {
        const msg = data.message || "Failed to update profile";
        showError(msg);
        return;
      }

      setEditing(false);
      showSuccess("Profile updated successfully.");
    } catch {
      showError("Network error while saving your profile.");
    } finally {
      setSaving(false);
    }
  };

  if (!isLoaded) {
    return (
      <>
        <Navbar />
        <div className={styles.page}>
          <div className={styles.loading}>Loading profile…</div>
        </div>
      </>
    );
  }

  if (!user) {
    router.push("/auth/login");
    return null;
  }

  const primaryEmail = user.primaryEmailAddress?.emailAddress || "";
  const emailDomain = primaryEmail.split("@")[1];
  const universityName =
    universities.find((uni) => uni.domains.includes(emailDomain))?.name || "";

  return (
    <>
      <Navbar />

      <div className={styles.page}>
        <div className={styles.container}>
          <h1 className={styles.title}>My Profile</h1>
          <p className={styles.desc}>Manage your UniRide profile details</p>

          <div className={styles.profileCard}>
            <div className={styles.avatar}>
              {user.fullName?.charAt(0).toUpperCase() || "U"}
            </div>

            <div className={styles.form}>
              <div className={styles.field}>
                <label>Full Name</label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  disabled={!editing}
                />
              </div>

              <div className={styles.field}>
                <label>Email</label>
                <input type="email" value={primaryEmail} disabled />
              </div>

              <div className={styles.field}>
                <label>University</label>
                <input
                  type="text"
                  name="university"
                  value={formData.university || universityName}
                  onChange={handleChange}
                  disabled={!editing}
                />
              </div>

              <div className={styles.field}>
                <label>Phone Number</label>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  disabled={!editing}
                />
              </div>

              <div className={styles.field}>
                <label>Bio</label>
                <textarea
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  disabled={!editing}
                />
              </div>

              {!editing ? (
                <button
                  className={styles.editButton}
                  onClick={() => setEditing(true)}
                >
                  Edit Profile
                </button>
              ) : (
                <button className={styles.saveButton} onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
