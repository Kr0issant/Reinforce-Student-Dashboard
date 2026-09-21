"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useClub } from "@/lib/useClubStore";
import styles from "./profile.module.css";

export default function ProfileClient() {
  const { user, updateUser } = useClub();
  const [showEditModal, setShowEditModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // Edit form state
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio);
  const [location, setLocation] = useState(user.location);
  const [newSkill, setNewSkill] = useState("");
  const [skills, setSkills] = useState<string[]>(user.skills);

  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleAddSkill = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && newSkill.trim()) {
      e.preventDefault();
      if (!skills.includes(newSkill.trim())) {
        setSkills([...skills, newSkill.trim()]);
      }
      setNewSkill("");
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills(skills.filter((s) => s !== skillToRemove));
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateUser({
      name,
      bio,
      location,
      skills
    });
    setShowEditModal(false);
  };

  return (
    <div className={styles.profileContainer}>
      {/* Top Profile Banner Hero */}
      <section className={styles.heroCard}>
        <div className={styles.avatarLarge}>
          {user.initials}
        </div>

        <div className={styles.heroDetails}>
          <div className={styles.heroTopRow}>
            <div className={styles.nameWrap}>
              <h1 className={styles.heroName}>{user.name}</h1>
              <span className={styles.tierPill}>{user.tier.toUpperCase()}</span>
            </div>

            <div className={styles.heroActions}>
              <button
                type="button"
                className={styles.editProfileBtn}
                onClick={() => setShowEditModal(true)}
              >
                Edit Profile
              </button>
              <button
                type="button"
                className={styles.shareProfileBtn}
                onClick={handleShare}
              >
                {copied ? "Link Copied! ✓" : "Share Profile"}
              </button>
            </div>
          </div>

          <p className={styles.heroBio}>{user.bio}</p>

          <div className={styles.metaRow}>
            <div className={styles.metaItem}>
              <span className={styles.metaIcon}>📍</span>
              <span>{user.location}</span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaIcon}>✉</span>
              <span>{user.email}</span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaIcon}>📅</span>
              <span>{user.joinedDate}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Grid: Left Column & Right Column */}
      <div className={styles.profileGrid}>
        {/* Left Column (Wide) */}
        <div className={styles.leftCol}>
          {/* Technical Expertise */}
          <div className={styles.sectionCard}>
            <div className={styles.sectionTitleRow}>
              <span className={styles.goldBar} />
              <h2 className={styles.sectionTitle}>Technical Expertise</h2>
            </div>
            <div className={styles.skillsWrap}>
              {user.skills.map((skill) => (
                <span key={skill} className={styles.skillPill}>
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {/* Posted Articles & Papers */}
          <div className={styles.sectionCard}>
            <div className={styles.sectionTitleRow}>
              <div className={styles.titleWithBar}>
                <span className={styles.goldBar} />
                <h2 className={styles.sectionTitle}>Posted Articles & Papers</h2>
              </div>
              <Link href="/dashboard/articles" className={styles.sectionLink}>
                View All Hub
              </Link>
            </div>

            <div className={styles.articlesList}>
              <Link href="/dashboard/articles" className={styles.articleRow}>
                <div className={styles.articleIcon}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
                <div className={styles.articleContent}>
                  <h3 className={styles.articleTitle}>
                    Comparative Analysis of GNN vs LSTM in Seismic Early Warning
                  </h3>
                  <span className={styles.articleMeta}>
                    PUBLISHED OCT 12, 2024 • 1.2K VIEWS
                  </span>
                </div>
                <span className={styles.rowChevron}>›</span>
              </Link>

              <Link href="/dashboard/articles" className={styles.articleRow}>
                <div className={styles.articleIcon}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
                <div className={styles.articleContent}>
                  <h3 className={styles.articleTitle}>
                    Optimizing Batch Processing for High-Frequency Sensor Data
                  </h3>
                  <span className={styles.articleMeta}>
                    PUBLISHED SEPT 28, 2024 • 840 VIEWS
                  </span>
                </div>
                <span className={styles.rowChevron}>›</span>
              </Link>
            </div>
          </div>

          {/* Verified SPG Submissions */}
          <div className={styles.sectionCard}>
            <div className={styles.sectionTitleRow}>
              <div className={styles.titleWithBar}>
                <span className={styles.goldBar} />
                <h2 className={styles.sectionTitle}>Verified SPG Submissions</h2>
              </div>
              <span className={styles.approvalRateBadge}>
                100% Approval Rate
              </span>
            </div>

            <div className={styles.submissionsList}>
              {user.verifiedSubmissions.map((sub) => (
                <div key={sub.id} className={styles.submissionRow}>
                  <div className={styles.checkCircle}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <span className={styles.submissionTitle}>{sub.title}</span>
                  <span className={styles.submissionTime}>{sub.timestamp}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (Narrow) */}
        <div className={styles.rightCol}>
          {/* CONNECT & LINKS */}
          <div className={styles.widgetCard}>
            <h3 className={styles.widgetHeader}>CONNECT & LINKS</h3>
            <div className={styles.linksList}>
              <a
                href={user.links.github}
                target="_blank"
                rel="noreferrer"
                className={styles.linkItem}
              >
                <div className={styles.linkLeft}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
                  </svg>
                  <span>GitHub</span>
                </div>
                <span className={styles.externalIcon}>↗</span>
              </a>

              <a
                href={user.links.kaggle}
                target="_blank"
                rel="noreferrer"
                className={styles.linkItem}
              >
                <div className={styles.linkLeft}>
                  <span className={styles.kaggleIcon}>k</span>
                  <span>Kaggle Profile</span>
                </div>
                <span className={styles.externalIcon}>↗</span>
              </a>

              <div className={styles.linkItem}>
                <div className={styles.linkLeft}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6h-5a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h5l3 3V8a2 2 0 0 0-2-2Z" />
                  </svg>
                  <span>{user.links.discord}</span>
                </div>
                <span className={styles.onlineBadge}>ONLINE</span>
              </div>

              <a
                href={user.links.portfolio}
                target="_blank"
                rel="noreferrer"
                className={styles.linkItem}
              >
                <div className={styles.linkLeft}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                  <span>Portfolio</span>
                </div>
                <span className={styles.externalIcon}>↗</span>
              </a>
            </div>
          </div>

          {/* EVENT WINS */}
          <div className={styles.widgetCard}>
            <h3 className={styles.widgetHeader}>EVENT WINS</h3>
            <div className={styles.winsList}>
              {user.eventWins.map((win) => (
                <div key={win.id} className={styles.winCard}>
                  <div className={styles.trophyIcon}>🏆</div>
                  <div className={styles.winInfo}>
                    <h4 className={styles.winTitle}>{win.title}</h4>
                    <span className={styles.winPlacement}>
                      {win.placement} • {win.track}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CONTRIBUTION STATS */}
          <div className={styles.widgetCard}>
            <h3 className={styles.widgetHeader}>CONTRIBUTION STATS</h3>
            <div className={styles.statsGrid}>
              <div className={styles.statBox}>
                <span className={styles.statNum}>12</span>
                <span className={styles.statLabel}>SPG SUBMISSIONS</span>
              </div>
              <div className={styles.statBox}>
                <span className={styles.statNum}>05</span>
                <span className={styles.statLabel}>HOT ARTICLES</span>
              </div>
            </div>

            <div className={styles.reputationBar}>
              <span className={styles.repLabel}>REPUTATION SCORE</span>
              <span className={styles.repValue}>{user.reputation}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className={styles.modalOverlay} onClick={() => setShowEditModal(false)}>
          <div className={styles.editModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Edit Student Profile</h3>
              <button type="button" className={styles.closeBtn} onClick={() => setShowEditModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveProfile} className={styles.editForm}>
              <div className={styles.formGroup}>
                <label>Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={styles.inputField}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>Bio / Research Interests</label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className={styles.textareaField}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>Campus Location / Lab</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className={styles.inputField}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>Skills & Frameworks (Press Enter to add)</label>
                <input
                  type="text"
                  placeholder="e.g. Transformers, JAX, Triton"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={handleAddSkill}
                  className={styles.inputField}
                />
                <div className={styles.skillsTagList}>
                  {skills.map((s) => (
                    <span key={s} className={styles.editableSkillTag}>
                      {s}
                      <button
                        type="button"
                        className={styles.removeTagBtn}
                        onClick={() => handleRemoveSkill(s)}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowEditModal(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.saveBtn}>
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
