"use client";

import React, { useState } from "react";
import { useClub, TrackType, DifficultyLevel } from "@/lib/useClubStore";
import styles from "./ideas.module.css";

export default function IdeaJarPage() {
  const { ideas, addIdea, claimIdea } = useClub();
  const [filterTrack, setFilterTrack] = useState<string>("All");
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [claimModalIdea, setClaimModalIdea] = useState<string | null>(null);
  const [spgNameInput, setSpgNameInput] = useState("");

  // New Idea form
  const [newTitle, setNewTitle] = useState("");
  const [newTrack, setNewTrack] = useState<TrackType>("Research");
  const [newDifficulty, setNewDifficulty] = useState<DifficultyLevel>("Intermediate");
  const [newSkills, setNewSkills] = useState("PyTorch, Transformers");
  const [newDesc, setNewDesc] = useState("");

  const filteredIdeas = ideas.filter((item) => {
    if (filterTrack === "All") return true;
    return item.track === filterTrack;
  });

  const handleClaim = (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimModalIdea || !spgNameInput.trim()) return;

    claimIdea(claimModalIdea, spgNameInput);
    setClaimModalIdea(null);
    setSpgNameInput("");
  };

  const handleSubmitIdea = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    addIdea({
      title: newTitle,
      track: newTrack,
      difficulty: newDifficulty,
      skillsRequired: newSkills.split(",").map((s) => s.trim()).filter(Boolean),
      learningObjectives: ["Reproduce benchmark pipeline", "Deploy working demo"],
      description: newDesc,
      author: "Julian Chen"
    });

    setShowSubmitModal(false);
    setNewTitle("");
    setNewDesc("");
  };

  return (
    <div className={styles.ideasPage}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Idea Jar</h1>
          <p className={styles.pageSubtitle}>
            Clueless on what to build? Grab a curated AI/ML project proposal from core or submit ideas for other club members.
          </p>
        </div>

        <button
          type="button"
          className={styles.submitIdeaBtn}
          onClick={() => setShowSubmitModal(true)}
        >
          + Submit an Idea
        </button>
      </div>

      {/* Filter Tabs */}
      <div className={styles.filterTabs}>
        {["All", "Kaggle", "Research", "Product"].map((tr) => (
          <button
            key={tr}
            type="button"
            className={`${styles.tabBtn} ${filterTrack === tr ? styles.tabActive : ""}`}
            onClick={() => setFilterTrack(tr)}
          >
            {tr === "All" ? "All Tracks" : `${tr} Track`}
          </button>
        ))}
      </div>

      {/* Idea Cards Grid */}
      <div className={styles.ideasGrid}>
        {filteredIdeas.map((idea) => (
          <div key={idea.id} className={styles.ideaCard}>
            <div className={styles.cardTop}>
              <span className={styles.trackPill}>{idea.track.toUpperCase()} TRACK</span>
              <span className={styles.difficultyBadge}>{idea.difficulty}</span>
            </div>

            <h3 className={styles.ideaTitle}>{idea.title}</h3>
            <p className={styles.ideaDesc}>{idea.description}</p>

            <div className={styles.skillsSection}>
              <span className={styles.skillsLabel}>SKILLS & TOOLS</span>
              <div className={styles.skillsTags}>
                {idea.skillsRequired.map((s) => (
                  <span key={s} className={styles.skillTag}>
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div className={styles.cardFooter}>
              <span className={styles.authorTag}>By {idea.author}</span>

              {idea.claimedBySPG ? (
                <span className={styles.claimedBadge}>
                  Claimed by {idea.claimedBySPG}
                </span>
              ) : (
                <button
                  type="button"
                  className={styles.claimBtn}
                  onClick={() => setClaimModalIdea(idea.id)}
                >
                  Grab Idea & Start SPG →
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Claim Idea Modal */}
      {claimModalIdea && (
        <div className={styles.modalOverlay} onClick={() => setClaimModalIdea(null)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Start SPG from Idea Jar</h3>
              <button type="button" className={styles.closeBtn} onClick={() => setClaimModalIdea(null)}>✕</button>
            </div>
            <form onSubmit={handleClaim} className={styles.formContent}>
              <p className={styles.modalNote}>
                Claiming this idea registers your intent to form a Student Project Group. You will be designated project lead.
              </p>
              <div className={styles.formGroup}>
                <label>Proposed SPG Project Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SPG: Audio Denoising Team"
                  value={spgNameInput}
                  onChange={(e) => setSpgNameInput(e.target.value)}
                  className={styles.inputField}
                />
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setClaimModalIdea(null)}>
                  Cancel
                </button>
                <button type="submit" className={styles.submitBtn}>
                  Claim Idea & Form SPG
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Submit Idea Modal */}
      {showSubmitModal && (
        <div className={styles.modalOverlay} onClick={() => setShowSubmitModal(false)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Pitch an Idea to the Jar</h3>
              <button type="button" className={styles.closeBtn} onClick={() => setShowSubmitModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmitIdea} className={styles.formContent}>
              <div className={styles.formGroup}>
                <label>Project Idea Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. LLM Code Reviewer for SST Campus Repos"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className={styles.inputField}
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Track</label>
                  <select
                    value={newTrack}
                    onChange={(e) => setNewTrack(e.target.value as TrackType)}
                    className={styles.inputField}
                  >
                    <option value="Research">Research Track</option>
                    <option value="Kaggle">Kaggle Track</option>
                    <option value="Product">Product Track</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label>Difficulty</label>
                  <select
                    value={newDifficulty}
                    onChange={(e) => setNewDifficulty(e.target.value as DifficultyLevel)}
                    className={styles.inputField}
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Skills & Frameworks (Comma separated)</label>
                <input
                  type="text"
                  placeholder="PyTorch, FastAPI, Next.js"
                  value={newSkills}
                  onChange={(e) => setNewSkills(e.target.value)}
                  className={styles.inputField}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Problem Statement & Objectives</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Explain the concept and why it would be a valuable SPG for members to build..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className={styles.textareaField}
                />
              </div>

              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowSubmitModal(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.submitBtn}>
                  Drop into Jar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
