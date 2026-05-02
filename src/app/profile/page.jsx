"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import styles from "./profile.module.css";
import { useUser } from "@clerk/nextjs";
import { isValidUniversityEmail } from "@/lib/universityEmailValidator";
import { universities } from "@/lib/universities";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    university: "",
    phone: "",
    bio: "",
  });
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (isLoaded && user && !initialized) {
      const primaryEmail = user.primaryEmailAddress?.emailAddress || "";
      // validate with your global validator
      if (!isValidUniversityEmail(primaryEmail)) {
        alert("Access denied: only university email addresses are allowed.");
        router.push("/");
        return;
      }

      setFormData({
        university: "",
        phone: user.phoneNumbers?.[0]?.phoneNumber || "",
        bio: "",
      });
      setInitialized(true);
    }
  }, [isLoaded, user, initialized, router]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSave = () => {
    setEditing(false);
    alert("Profile updated successfully!");
  };

  if (!isLoaded) return <div>Loading...</div>;

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
                <input type="text" value={user.fullName || ""} disabled />
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
                  value={universityName || formData.university}
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
                <button className={styles.saveButton} onClick={handleSave}>
                  Save Changes
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
