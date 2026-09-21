"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useClub, TrackType } from "@/lib/useClubStore";
import styles from "./details.module.css";

export default function SPGDetailsPage() {
  const params = useParams();
  const spgId = (params?.id as string) || "SPG-2024-089";
  const { spgs, user } = useClub();

  const [activeTab, setActiveTab] = useState<"overview" | "reports" | "resources" | "team">("overview");
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Find project or fallback to default
  const spg = spgs.find((s) => s.id.toLowerCase() === spgId.toLowerCase()) || spgs[0];

  const getTrackClass = (track: TrackType) => {
    switch (track) {
      case "Kaggle":
        return styles.trackKaggle;
      case "Research":
        return styles.trackResearch;
      case "Product":
        return styles.trackProduct;
      default:
        return styles.trackGeneral;
    }
  };

  const handleCopyKey = (key: string) => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(key);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  return (
    <div className={styles.detailsContainer}>
      {/* Header Banner */}
      <div className={styles.headerBanner}>
        <div className={styles.headerTop}>
          <Link href="/dashboard/spg" className={styles.backButton} title="Back to Projects">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>

          <div className={styles.tagRow}>
            <span className={`${styles.trackBadge} ${getTrackClass(spg.track)}`}>
              {spg.track.toUpperCase()} TRACK
            </span>
            <span className={styles.spgCode}>ID: {spg.id}</span>
          </div>

          <div className={styles.headerRight}>
            <span className={styles.healthBadge}>
              {spg.health === "on_track" ? "On Track" : spg.health === "need_progress" ? "Need Progress" : "At Risk"}
            </span>
            <button type="button" className={styles.editIconBtn} title="Edit Project">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          </div>
        </div>

        <h1 className={styles.projectTitle}>{spg.title}</h1>
        <p className={styles.projectDesc}>{spg.description}</p>
      </div>

      {/* Navigation Tabs */}
      <div className={styles.tabBar}>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === "overview" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          Overview
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === "reports" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("reports")}
        >
          Progress Updates
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === "resources" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("resources")}
        >
          Resources
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === "team" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("team")}
        >
          Team Members
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className={styles.overviewGrid}>
          {/* Left Column (Wide) */}
          <div className={styles.leftCol}>
            {/* Latest Progress Report */}
            <div className={styles.sectionCard}>
              <div className={styles.sectionTitleBar}>
                <div className={styles.titleWithBar}>
                  <span className={styles.goldBar} />
                  <h2 className={styles.sectionHeading}>Latest Progress Report</h2>
                </div>
                <Link
                  href={`/dashboard/spg/${spg.id}/report`}
                  className={styles.submitNewLink}
                >
                  + Submit New Report
                </Link>
              </div>

              {spg.latestReport ? (
                <div className={styles.reportBreakdown}>
                  {/* Milestones Achieved */}
                  <div className={styles.reportCol}>
                    <span className={styles.colLabel}>MILESTONES ACHIEVED</span>
                    <div className={styles.milestoneList}>
                      {spg.latestReport.milestones.map((m, idx) => (
                        <div key={idx} className={styles.milestoneItem}>
                          <span className={styles.checkIcon}>✓</span>
                          <span>{m}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Current Blockers */}
                  <div className={styles.reportCol}>
                    <span className={styles.colLabel}>CURRENT BLOCKERS</span>
                    <div className={styles.blockerItem}>
                      <span className={styles.alertIcon}>!</span>
                      <span>{spg.latestReport.blockers}</span>
                    </div>
                  </div>

                  {/* Next Steps */}
                  <div className={styles.reportCol}>
                    <span className={styles.colLabel}>NEXT STEPS</span>
                    <div className={styles.nextStepItem}>
                      <span className={styles.arrowIcon}>→</span>
                      <span>{spg.latestReport.nextSteps}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className={styles.emptyNote}>
                  No progress reports filed yet for this reporting period.
                </p>
              )}
            </div>

            {/* Resource Requests */}
            <div className={styles.sectionCard}>
              <div className={styles.sectionTitleBar}>
                <div className={styles.titleWithBar}>
                  <span className={styles.goldBar} />
                  <h2 className={styles.sectionHeading}>Resource Requests</h2>
                </div>
                <Link href="/dashboard/tickets" className={styles.requestMoreLink}>
                  + Request Resource
                </Link>
              </div>

              <div className={styles.resourceTable}>
                <div className={styles.tableHeader}>
                  <span className={styles.thCol}>RESOURCE</span>
                  <span className={styles.thCol}>STATUS</span>
                  <span className={styles.thCol}>ALLOCATION</span>
                  <span className={`${styles.thCol} ${styles.thColRight}`}>ACTIONS</span>
                </div>

                <div className={styles.tableBody}>
                  {spg.resourceRequests.map((res) => (
                    <div key={res.id} className={styles.tableRow}>
                      <div className={styles.resInfo}>
                        <span className={styles.resName}>{res.name}</span>
                        <span className={styles.resDetail}>{res.detail}</span>
                      </div>

                      <div>
                        {res.status === "approved" ? (
                          <span className={styles.statusApproved}>APPROVED</span>
                        ) : (
                          <span className={styles.statusPending}>PENDING REVIEW</span>
                        )}
                      </div>

                      <div>
                        <span className={styles.allocCode}>{res.allocationId || "--"}</span>
                      </div>

                      <div className={styles.actionColRight}>
                        {res.allocationId && res.allocationId !== "--" ? (
                          <button
                            type="button"
                            className={styles.viewKeyBtn}
                            onClick={() => handleCopyKey(res.allocationId!)}
                          >
                            {copiedKey === res.allocationId ? "Copied! ✓" : "View Key"}
                          </button>
                        ) : (
                          <button type="button" className={styles.detailsBtn}>
                            Details
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (Narrow) */}
          <div className={styles.rightCol}>
            {/* Team Members Card */}
            <div className={styles.widgetCard}>
              <div className={styles.widgetHeaderRow}>
                <h3 className={styles.widgetTitle}>Team Members</h3>
                <button
                  type="button"
                  className={styles.addMemberIconBtn}
                  onClick={() => setShowAddMemberModal(true)}
                  title="Add Member"
                >
                  +
                </button>
              </div>

              <div className={styles.membersList}>
                {spg.members.map((member, idx) => (
                  <div key={idx} className={styles.memberRow}>
                    <div
                      className={styles.memberAvatar}
                      style={{
                        backgroundColor:
                          idx === 0 ? "#E5B731" : idx === 1 ? "#3B82F6" : "#A855F7",
                        color: idx === 0 ? "#0E0E0E" : "#FFFFFF"
                      }}
                    >
                      {member.initials}
                    </div>
                    <div className={styles.memberDetails}>
                      <span className={styles.memberName}>{member.name}</span>
                      <span className={styles.memberRole}>{member.role}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Project Timeline Card */}
            <div className={styles.widgetCard}>
              <h3 className={styles.widgetTitle}>Project Timeline</h3>
              <div className={styles.timelineList}>
                {spg.timeline.map((item, idx) => (
                  <div key={idx} className={styles.timelineItem}>
                    <div
                      className={`${styles.timelineDot} ${
                        item.completed ? styles.dotDone : styles.dotPending
                      }`}
                    />
                    <div className={styles.timelineContent}>
                      <span className={styles.timelineDate}>{item.date}</span>
                      <span className={styles.timelineTitle}>{item.title}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Progress Updates Tab */}
      {activeTab === "reports" && (
        <div className={styles.sectionCard}>
          <div className={styles.sectionTitleBar}>
            <h2 className={styles.sectionHeading}>Weekly Progress Reports History</h2>
            <Link href={`/dashboard/spg/${spg.id}/report`} className={styles.submitNewLink}>
              + Submit Weekly Report
            </Link>
          </div>
          <div className={styles.historyList}>
            {spg.reports.length > 0 ? (
              spg.reports.map((rep) => (
                <div key={rep.id} className={styles.historyItem}>
                  <div className={styles.historyHeader}>
                    <strong>Reporting Period: {rep.period}</strong>
                    <span className={styles.statusApproved}>VERIFIED</span>
                  </div>
                  <p className={styles.historySummary}>{rep.summary}</p>
                  <div className={styles.historyMeta}>Submitted {rep.submittedAt}</div>
                </div>
              ))
            ) : (
              <p className={styles.emptyNote}>
                No past archived reports. Click &quot;Submit Weekly Report&quot; to file this week&apos;s milestone.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Resources Tab */}
      {activeTab === "resources" && (
        <div className={styles.sectionCard}>
          <div className={styles.sectionTitleBar}>
            <h2 className={styles.sectionHeading}>Allocated Resources & Infrastructure</h2>
            <Link href="/dashboard/tickets" className={styles.requestMoreLink}>
              + New Resource Ticket
            </Link>
          </div>
          <div className={styles.resourceListLarge}>
            {spg.resourceRequests.map((res) => (
              <div key={res.id} className={styles.resourceCardLarge}>
                <div className={styles.resCardHeader}>
                  <h4 className={styles.resCardTitle}>{res.name}</h4>
                  <span className={res.status === "approved" ? styles.statusApproved : styles.statusPending}>
                    {res.status.toUpperCase()}
                  </span>
                </div>
                <p className={styles.resCardDetail}>{res.detail}</p>
                <div className={styles.resCardFooter}>
                  <span>Allocation ID: <code>{res.allocationId || "PENDING"}</code></span>
                  {res.allocationId && res.allocationId !== "--" && (
                    <button
                      type="button"
                      className={styles.viewKeyBtn}
                      onClick={() => handleCopyKey(res.allocationId!)}
                    >
                      Copy Credential Key
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Team Tab */}
      {activeTab === "team" && (
        <div className={styles.sectionCard}>
          <div className={styles.sectionTitleBar}>
            <h2 className={styles.sectionHeading}>SPG Collaborators & Track Mentors</h2>
            <button
              type="button"
              className={styles.submitNewLink}
              onClick={() => setShowAddMemberModal(true)}
            >
              + Add Teammate
            </button>
          </div>
          <div className={styles.teamGridLarge}>
            {spg.members.map((m, idx) => (
              <div key={idx} className={styles.teamMemberCard}>
                <div className={styles.avatarLargeBox}>{m.initials}</div>
                <div className={styles.teamMeta}>
                  <strong>{m.name}</strong>
                  <span>{m.role}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div className={styles.modalOverlay} onClick={() => setShowAddMemberModal(false)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Add Team Member to {spg.id}</h3>
              <button type="button" className={styles.closeBtn} onClick={() => setShowAddMemberModal(false)}>✕</button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (newMemberName.trim()) {
                  spg.members.push({
                    name: newMemberName,
                    role: newMemberRole || "CONTRIBUTOR",
                    initials: newMemberName.split(" ").map((n) => n[0]).join("")
                  });
                  setShowAddMemberModal(false);
                  setNewMemberName("");
                  setNewMemberRole("");
                }
              }}
              className={styles.modalForm}
            >
              <div className={styles.formGroup}>
                <label>Member Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Elena Rostova"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  className={styles.inputField}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Designated Role in Project</label>
                <input
                  type="text"
                  placeholder="e.g. ML RESEARCHER / DATA SCIENTIST"
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value)}
                  className={styles.inputField}
                />
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowAddMemberModal(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.submitBtn}>
                  Add to Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
