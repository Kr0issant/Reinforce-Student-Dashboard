"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useClub, TrackType, SPGProject } from "@/lib/useClubStore";
import styles from "./spg.module.css";

export default function SPGBrowsePage() {
  const { spgs, addSPG, searchQuery } = useClub();
  const [trackFilter, setTrackFilter] = useState<string>("All Tracks");
  const [statusFilter, setStatusFilter] = useState<string>("Active Only");
  const [sortBy, setSortBy] = useState<string>("Recent Activity");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [showNewModal, setShowNewModal] = useState<boolean>(false);

  // New SPG form state
  const [newTitle, setNewTitle] = useState("");
  const [newTrack, setNewTrack] = useState<TrackType>("Kaggle");
  const [newDesc, setNewDesc] = useState("");
  const [newLead, setNewLead] = useState("Julian Chen");
  const [newDeadline, setNewDeadline] = useState("15 Nov 2024");

  // Filtering & Sorting
  const filteredSpgs = useMemo(() => {
    return spgs.filter((spg) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          spg.title.toLowerCase().includes(q) ||
          spg.description.toLowerCase().includes(q) ||
          spg.id.toLowerCase().includes(q) ||
          spg.leadMember.toLowerCase().includes(q);
        if (!matches) return false;
      }

      // Track filter
      if (trackFilter !== "All Tracks" && spg.track !== trackFilter) {
        return false;
      }

      // Status filter
      if (statusFilter === "Active Only") {
        return spg.health !== "completed";
      }
      if (statusFilter === "At Risk") {
        return spg.health === "at_risk" || spg.health === "need_progress";
      }
      if (statusFilter === "Completed") {
        return spg.health === "completed";
      }

      return true;
    });
  }, [spgs, trackFilter, statusFilter, searchQuery]);

  const sortedSpgs = useMemo(() => {
    return [...filteredSpgs].sort((a, b) => {
      if (sortBy === "Progress") {
        return b.progress - a.progress;
      }
      return 0; // Default recent activity order
    });
  }, [filteredSpgs, sortBy]);

  const handleCreateSPG = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const num = Math.floor(100 + Math.random() * 900);
    const newProject: Omit<SPGProject, "reports" | "timeline"> = {
      id: `SPG-2024-${num}`,
      title: newTitle,
      track: newTrack,
      health: "on_track",
      progress: 10,
      description: newDesc || "Newly registered student project group initiative.",
      leadMember: newLead,
      nextDeadline: newDeadline,
      lastActivity: "Just now",
      members: [
        { name: newLead, role: "PROJECT LEAD", initials: newLead.split(" ").map((n) => n[0]).join("") }
      ],
      resourceRequests: []
    };

    addSPG(newProject);
    setShowNewModal(false);
    setNewTitle("");
    setNewDesc("");
  };

  // Determine card accent styling from reference image
  const getCardTheme = (spg: SPGProject) => {
    if (spg.health === "at_risk") {
      return {
        themeClass: styles.themeRed,
        tagText: "DEADLINE CRUNCH",
        tagClass: styles.tagRed,
        progressColor: "#EF4444",
        metricLabel: "SPRINT PROGRESS",
        metricValue: `${spg.progress}%`
      };
    }
    if (spg.track === "Research") {
      return {
        themeClass: styles.themeGreen,
        tagText: "SPRINT ACTIVE",
        tagClass: styles.tagGreen,
        progressColor: "#22C55E",
        metricLabel: "SPRINT PROGRESS",
        metricValue: `${spg.progress}%`
      };
    }
    if (spg.track === "Kaggle") {
      return {
        themeClass: styles.themeBlue,
        tagText: "KAGGLE CHALLENGE",
        tagClass: styles.tagBlue,
        progressColor: "#3B82F6",
        metricLabel: "LEADERBOARD POS",
        metricValue: `#14 / 850`
      };
    }
    return {
      themeClass: styles.themeYellow,
      tagText: "PRODUCT SPRINT",
      tagClass: styles.tagYellow,
      progressColor: "#E5B731",
      metricLabel: "SPRINT PROGRESS",
      metricValue: `${spg.progress}%`
    };
  };

  return (
    <div className={styles.spgContainer}>
      {/* Top Header */}
      <div className={styles.pageHeader}>
        <div className={styles.headerText}>
          <div className={styles.breadcrumbBar}>
            <Link href="/dashboard" className={styles.breadcrumb}>DASHBOARD</Link>
            <span className={styles.breadcrumbSep}>›</span>
            <span className={styles.breadcrumbCurrent}>SPG MANAGEMENT</span>
          </div>
          <h1 className={styles.pageTitle}>Student Project Groups</h1>
          <p className={styles.pageSubtitle}>
            Monitor and lead academic initiatives across Reinforce tracks.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button type="button" className={styles.exportBtn}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export List
          </button>
          <button
            type="button"
            className={styles.newSpgBtn}
            onClick={() => setShowNewModal(true)}
          >
            + New SPG Application
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className={styles.filterToolbar}>
        <div className={styles.filterControls}>
          {/* Track Filter */}
          <div className={styles.selectWrap}>
            <span className={styles.selectLabel}>TRACK:</span>
            <select
              value={trackFilter}
              onChange={(e) => setTrackFilter(e.target.value)}
              className={styles.selectDropdown}
            >
              <option value="All Tracks">All Tracks</option>
              <option value="Kaggle">Kaggle Track</option>
              <option value="Research">Research Track</option>
              <option value="Product">Product Track</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className={styles.selectWrap}>
            <span className={styles.selectLabel}>STATUS:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={styles.selectDropdown}
            >
              <option value="Active Only">Active Only</option>
              <option value="All">All Projects</option>
              <option value="At Risk">At Risk / Needs Progress</option>
              <option value="Completed">Completed</option>
            </select>
          </div>

          {/* Sort Filter */}
          <div className={styles.selectWrap}>
            <span className={styles.selectLabel}>SORT BY:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className={styles.selectDropdown}
            >
              <option value="Recent Activity">Recent Activity</option>
              <option value="Progress">Progress %</option>
            </select>
          </div>
        </div>

        <div className={styles.viewAndCount}>
          <span className={styles.showingText}>
            Showing <strong>{sortedSpgs.length}</strong> Projects
          </span>

          <div className={styles.viewToggleGroup}>
            <button
              type="button"
              className={`${styles.viewBtn} ${viewMode === "grid" ? styles.viewBtnActive : ""}`}
              onClick={() => setViewMode("grid")}
              title="Grid View"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            </button>
            <button
              type="button"
              className={`${styles.viewBtn} ${viewMode === "list" ? styles.viewBtnActive : ""}`}
              onClick={() => setViewMode("list")}
              title="List View"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Projects Grid with 24px Rounded Cards & Accent Highlights */}
      <div className={viewMode === "grid" ? styles.spgGrid : styles.spgListMode}>
        {sortedSpgs.map((spg) => {
          const theme = getCardTheme(spg);
          return (
            <div key={spg.id} className={`${styles.spgCard} ${theme.themeClass}`}>
              {/* Header: Tag, ID */}
              <div className={styles.cardTop}>
                <span className={`${styles.trackBadge} ${theme.tagClass}`}>
                  {theme.tagText}
                </span>
                <span className={styles.spgCode}>{spg.id}</span>
              </div>

              {/* Title & Description */}
              <Link href={`/dashboard/spg/${spg.id}`} className={styles.titleLink}>
                <h3 className={styles.spgTitle}>{spg.title}</h3>
              </Link>
              <p className={styles.spgDesc}>{spg.description}</p>

              {/* Progress Section */}
              <div className={styles.progressContainer}>
                <div className={styles.progressLabels}>
                  <span className={styles.progLabel}>{theme.metricLabel}</span>
                  <span className={styles.progVal} style={{ color: theme.progressColor }}>
                    {theme.metricValue}
                  </span>
                </div>
                <div className={styles.progressBarTrack}>
                  <div
                    className={styles.progressBarThumb}
                    style={{
                      width: `${spg.progress}%`,
                      backgroundColor: theme.progressColor
                    }}
                  />
                </div>
              </div>

              {/* Footer: Avatars & Clean Link */}
              <div className={styles.cardBottom}>
                <div className={styles.avatarGroup}>
                  {spg.members.slice(0, 2).map((m, idx) => (
                    <div
                      key={idx}
                      className={styles.avatarCircle}
                      style={{ backgroundColor: idx === 0 ? "#2A2A2A" : "#333333" }}
                    >
                      {m.initials}
                    </div>
                  ))}
                  {spg.members.length > 2 && (
                    <div className={styles.avatarMore}>
                      +{spg.members.length - 2}
                    </div>
                  )}
                </div>

                <Link href={`/dashboard/spg/${spg.id}`} className={styles.detailsLink}>
                  OPEN SUITE →
                </Link>
              </div>
            </div>
          );
        })}

        {/* Propose New SPG Card */}
        <div
          className={styles.proposeCard}
          onClick={() => setShowNewModal(true)}
          role="button"
          tabIndex={0}
        >
          <div className={styles.proposePlusCircle}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
          <h3 className={styles.proposeTitle}>Propose New SPG</h3>
          <p className={styles.proposeSub}>
            Submit a charter for a new Research or Product focused cluster.
          </p>
        </div>
      </div>

      {/* Pagination Bar */}
      <div className={styles.pagination}>
        <button
          type="button"
          className={styles.pageArrow}
          disabled={currentPage === 1}
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
        >
          ‹
        </button>
        <button
          type="button"
          className={`${styles.pageNumber} ${currentPage === 1 ? styles.pageActive : ""}`}
          onClick={() => setCurrentPage(1)}
        >
          1
        </button>
        <button
          type="button"
          className={`${styles.pageNumber} ${currentPage === 2 ? styles.pageActive : ""}`}
          onClick={() => setCurrentPage(2)}
        >
          2
        </button>
        <button
          type="button"
          className={`${styles.pageNumber} ${currentPage === 3 ? styles.pageActive : ""}`}
          onClick={() => setCurrentPage(3)}
        >
          3
        </button>
        <span className={styles.pageEllipsis}>…</span>
        <button
          type="button"
          className={styles.pageNumber}
          onClick={() => setCurrentPage(12)}
        >
          12
        </button>
        <button
          type="button"
          className={styles.pageArrow}
          onClick={() => setCurrentPage((p) => p + 1)}
        >
          ›
        </button>
      </div>

      {/* New SPG Application Modal */}
      {showNewModal && (
        <div className={styles.modalOverlay} onClick={() => setShowNewModal(false)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Register New Student Project Group (SPG)</h3>
              <button type="button" className={styles.closeBtn} onClick={() => setShowNewModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateSPG} className={styles.spgForm}>
              <div className={styles.formGroup}>
                <label>Project Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Diffusion Audio Enhancement Pipeline"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className={styles.inputField}
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Club Track</label>
                  <select
                    value={newTrack}
                    onChange={(e) => setNewTrack(e.target.value as TrackType)}
                    className={styles.inputField}
                  >
                    <option value="Kaggle">Competitive AI (Kaggle)</option>
                    <option value="Research">Research Track</option>
                    <option value="Product">Product Track</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label>Estimated Milestone Deadline</label>
                  <input
                    type="text"
                    value={newDeadline}
                    onChange={(e) => setNewDeadline(e.target.value)}
                    className={styles.inputField}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Designated Project Lead (Must be Club Member)</label>
                <input
                  type="text"
                  value={newLead}
                  onChange={(e) => setNewLead(e.target.value)}
                  className={styles.inputField}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>Project Scope & Core Goal</label>
                <textarea
                  rows={3}
                  placeholder="Describe your technical architecture, milestones, and expected outputs..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className={styles.textareaField}
                  required
                />
              </div>

              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowNewModal(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.submitBtn}>
                  Submit Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
