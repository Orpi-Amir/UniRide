"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import styles from "./profile.module.css";

const ProfilePage = () => {
  const [user, setUser] = useState({
    name: " ",
    email: " ",
    university: " ",
    phone: " ",
    bio: " ",
  });

  const [editing, setEditing] = useState(false);

  const handleChange = (e) => {
    setUser({
      ...user,
      [e.target.name]: e.target.value,
    });
  };

  const handleSave = () => {
    setEditing(false);

    
    alert("Profile updated successfully!");
  };

  return (
    <>
      <Navbar />

      <div className={styles.page}>
        <div className={styles.container}>
          <h1 className={styles.title}>My Profile</h1>
          <p className={styles.desc}>Manage your UniRide profile details</p>

          <div className={styles.profileCard}>
            <div className={styles.avatar}>
              {user.name.charAt(0)}
            </div>

            <div className={styles.form}>
              <div className={styles.field}>
                <label>Full Name</label>
                <input
                  type="text"
                  name="name"
                  value={user.name}
                  onChange={handleChange}
                  disabled={!editing}
                />
              </div>

              <div className={styles.field}>
                <label>Email</label>
                <input
                  type="email"
                  name="email"
                  value={user.email}
                  onChange={handleChange}
                  disabled={!editing}
                />
              </div>

              <div className={styles.field}>
                <label>University</label>
                <input
                  type="text"
                  name="university"
                  value={user.university}
                  onChange={handleChange}
                  disabled={!editing}
                />
              </div>

              <div className={styles.field}>
                <label>Phone Number</label>
                <input
                  type="text"
                  name="phone"
                  value={user.phone}
                  onChange={handleChange}
                  disabled={!editing}
                />
              </div>

              <div className={styles.field}>
                <label>Bio</label>
                <textarea
                  name="bio"
                  value={user.bio}
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
                <button
                  className={styles.saveButton}
                  onClick={handleSave}
                >
                  Save Changes
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ProfilePage;