"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useClub } from "@/lib/useClubStore";
import styles from "./report.module.css";

export default function SPGReportPage() {
  const params = useParams();
  const router = useRouter();
  const spgId = typeof params?.id === "string" ? params.id : "";
  const { spgs, submitWeeklyReport } = useClub();

  const spg = spgs.find((s) => s.id.toLowerCase() === spgId.toLowerCase());

  // Form states
  // Every field below renders its own placeholder. Seeding these with sample
  // text meant a member could submit a report claiming work they never did,
  // down to an accuracy figure and an attachment name, without typing anything.
  const [summary, setSummary] = useState("");
  const [milestones, setMilestones] = useState<string[]>([]);
  const [newMilestone, setNewMilestone] = useState("");
  const [blockers, setBlockers] = useState("");
  const [nextSteps, setNextSteps] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  // Declared after every hook so the hook order stays stable across renders.
  if (!spg) {
    return (
      <div className={styles.notFound}>
        <h1>No such project group</h1>
        <p>
          Nothing matches <code>{spgId || "that id"}</code>, so there is no report
          to file against it.
        </p>
        <Link href="/dashboard/spg">Back to all project groups</Link>
      </div>
    );
  }

  const handleAddMilestone = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && newMilestone.trim()) {
      e.preventDefault();
      setMilestones([...milestones, newMilestone.trim()]);
      setNewMilestone("");
    }
  };

  const handleRemoveMilestone = (idx: number) => {
    setMilestones(milestones.filter((_, i) => i !== idx));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const fileName = e.target.files[0].name;
      setFiles((prev) => [...prev, fileName]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitWeeklyReport(spg.id, {
      summary,
      milestones,
      blockers,
      nextSteps
    });
    setSubmitted(true);
    setTimeout(() => {
      router.push(`/dashboard/spg/${spg.id}`);
    }, 1200);
  };

  return (
    <div className={styles.reportContainer}>
      {/* Back Navigation Link */}
      <Link href={`/dashboard/spg/${spg.id}`} className={styles.backLink}>
        ← Back to Project Details
      </Link>

      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.tagPill}>PROGRESS REPORT</div>
          <h1 className={styles.pageTitle}>Weekly Milestone Update</h1>
          <p className={styles.pageSubtitle}>
            {spg.id}: {spg.title}
          </p>
        </div>

        <div className={styles.reportingPeriod}>
          <span className={styles.periodLabel}>REPORTING PERIOD</span>
          <span className={styles.periodDates}>Oct 17 - Oct 24, 2024</span>
        </div>
      </div>

      {submitted ? (
        <div className={styles.successBanner}>
          <div className={styles.successCheck}>✓</div>
          <div className={styles.successMeta}>
            <h3>Weekly Report Submitted Successfully! (+20 Points)</h3>
            <p>Your track lead has been notified and milestone verified. Redirecting...</p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className={styles.reportGrid}>
          {/* Form Content (Left) */}
          <div className={styles.formCol}>
            {/* Progress Summary */}
            <div className={styles.sectionBlock}>
              <div className={styles.sectionHeading}>
                <span className={styles.goldBar} />
                <h2>Progress Summary</h2>
              </div>
              <textarea
                rows={4}
                required
                placeholder="Provide a brief overview of what the team worked on this week..."
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className={styles.textareaField}
              />
            </div>

            {/* Milestones Achieved */}
            <div className={styles.sectionBlock}>
              <div className={styles.sectionHeading}>
                <span className={styles.goldBar} />
                <h2>Milestones Achieved</h2>
              </div>

              <div className={styles.milestoneBoxList}>
                {milestones.map((m, idx) => (
                  <div key={idx} className={styles.milestoneRow}>
                    <div className={styles.milestoneCheckboxChecked}>✓</div>
                    <span className={styles.milestoneText}>{m}</span>
                    <button
                      type="button"
                      className={styles.removeMilestoneBtn}
                      onClick={() => handleRemoveMilestone(idx)}
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                ))}

                <div className={styles.addMilestoneRow}>
                  <div className={styles.milestoneCheckboxEmpty} />
                  <input
                    type="text"
                    placeholder="Add another achievement... (Press Enter)"
                    value={newMilestone}
                    onChange={(e) => setNewMilestone(e.target.value)}
                    onKeyDown={handleAddMilestone}
                    className={styles.addMilestoneInput}
                  />
                </div>
              </div>
            </div>

            {/* Blockers & Next Steps Side by Side */}
            <div className={styles.twoColBlock}>
              <div className={styles.fieldWrap}>
                <div className={styles.subHeading}>
                  <span className={styles.redDot}>!</span>
                  <h3>Current Blockers</h3>
                </div>
                <textarea
                  rows={4}
                  placeholder="Mention any hurdles or resource needs..."
                  value={blockers}
                  onChange={(e) => setBlockers(e.target.value)}
                  className={styles.textareaField}
                />
              </div>

              <div className={styles.fieldWrap}>
                <div className={styles.subHeading}>
                  <span className={styles.greenArrow}>→</span>
                  <h3>Next Steps</h3>
                </div>
                <textarea
                  rows={4}
                  placeholder="What are the goals for next week?"
                  value={nextSteps}
                  onChange={(e) => setNextSteps(e.target.value)}
                  className={styles.textareaField}
                />
              </div>
            </div>

            {/* Supporting Documents Dropzone */}
            <div className={styles.sectionBlock}>
              <div className={styles.sectionHeading}>
                <span className={styles.goldBar} />
                <h2>Supporting Documents</h2>
              </div>

              <label className={styles.dropZone}>
                <input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className={styles.hiddenFileInput}
                />
                <div className={styles.cloudIconWrap}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
                    <path d="M12 12v9" />
                    <path d="m16 16-4-4-4 4" />
                  </svg>
                </div>
                <strong className={styles.dropTitle}>Drag and drop files</strong>
                <span className={styles.dropSub}>
                  Upload screenshots, charts, or PDFs (Max 10MB)
                </span>
              </label>

              {files.length > 0 && (
                <div className={styles.attachedFilesList}>
                  {files.map((f, i) => (
                    <div key={i} className={styles.fileTag}>
                      <span>📄 {f}</span>
                      <button
                        type="button"
                        onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                        className={styles.removeFileBtn}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar Widgets */}
          <div className={styles.sidebarCol}>
            {/* Deadline Status Card (Yellow) */}
            <div className={styles.deadlineCard}>
              <div className={styles.deadlineTop}>
                <div className={styles.clockIconWrap}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div>
                  <span className={styles.deadlineSub}>DEADLINE STATUS</span>
                  <h3 className={styles.deadlineHeading}>Due in 2 Days</h3>
                </div>
              </div>

              <div className={styles.progressStatus}>
                <div className={styles.progLabels}>
                  <span>Report Progress</span>
                  <span>65%</span>
                </div>
                <div className={styles.progTrack}>
                  <div className={styles.progFill} style={{ width: "65%" }} />
                </div>
              </div>

              <p className={styles.deadlineNote}>
                Please complete all required fields to submit. Resource requests can be managed separately.
              </p>

              <button type="submit" className={styles.submitReportBtn}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
                Submit Weekly Report
              </button>

              <button
                type="button"
                className={styles.saveDraftBtn}
                onClick={() => alert("Report saved as draft locally.")}
              >
                Save as Draft
              </button>
            </div>

            {/* Guidelines */}
            <div className={styles.guidelinesCard}>
              <div className={styles.guideHeading}>
                <span>?</span>
                <h4>Guidelines</h4>
              </div>
              <ul className={styles.guideList}>
                <li>
                  <span className={styles.guideCheck}>✓</span>
                  <div>
                    <strong>Frequency:</strong> Weekly reports are required to maintain resource allocation priority.
                  </div>
                </li>
                <li>
                  <span className={styles.guideCheck}>✓</span>
                  <div>
                    <strong>Details:</strong> Mention specific technical milestones or library implementations.
                  </div>
                </li>
                <li>
                  <span className={styles.guideCheck}>✓</span>
                  <div>
                    <strong>Blockers:</strong> Use the blockers section to flag needed mentor sessions early.
                  </div>
                </li>
              </ul>
            </div>

            {/* Track Lead Card */}
            <div className={styles.leadCard}>
              <div className={styles.leadAvatar}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div className={styles.leadMeta}>
                <span className={styles.leadRole}>KAGGLE TRACK LEAD</span>
                <strong className={styles.leadName}>Sarah Varghese</strong>
              </div>
              <button
                type="button"
                className={styles.messageLeadBtn}
                title="Message Track Lead"
                onClick={() => alert("Opening Discord DM with Sarah Varghese...")}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
