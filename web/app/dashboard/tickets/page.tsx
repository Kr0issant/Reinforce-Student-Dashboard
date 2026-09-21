"use client";

import React, { useState, useMemo } from "react";
import { useClub, TicketItem, PriorityType, TrackType } from "@/lib/useClubStore";
import styles from "./tickets.module.css";

export default function TicketSystemPage() {
  const { tickets, addTicket, searchQuery } = useClub();

  const [typeFilter, setTypeFilter] = useState<string>("All Types");
  const [priorityFilter, setPriorityFilter] = useState<string>("All Priority");
  const [tabMode, setTabMode] = useState<"active" | "archived">("active");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [showNewModal, setShowNewModal] = useState<boolean>(false);

  // New ticket form state
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<TicketItem["category"]>("resource_request");
  const [newPriority, setNewPriority] = useState<PriorityType>("high");
  const [newTrack, setNewTrack] = useState<TrackType>("Kaggle");
  const [newDesc, setNewDesc] = useState("");

  const totalCount = tickets.length;
  const openCount = tickets.filter((t) => t.status === "open" || t.status === "pending_approval").length;
  const inProgressCount = tickets.filter((t) => t.status === "in_progress").length;
  const resolvedCount = tickets.filter((t) => t.status === "resolved").length;

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      // Tab mode
      if (tabMode === "active" && t.archived) return false;
      if (tabMode === "archived" && !t.archived) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          t.title.toLowerCase().includes(q) ||
          t.id.toLowerCase().includes(q) ||
          t.categoryLabel.toLowerCase().includes(q) ||
          t.track.toLowerCase().includes(q);
        if (!matches) return false;
      }

      // Type filter
      if (typeFilter !== "All Types") {
        if (typeFilter === "Resource Request" && t.category !== "resource_request") return false;
        if (typeFilter === "Registration" && t.category !== "spg_registration") return false;
        if (typeFilter === "Misconduct Report" && t.category !== "misconduct") return false;
        if (typeFilter === "Support Inquiry" && t.category !== "support_inquiry") return false;
      }

      // Priority filter
      if (priorityFilter !== "All Priority") {
        if (priorityFilter.toLowerCase() !== t.priority) return false;
      }

      return true;
    });
  }, [tickets, tabMode, searchQuery, typeFilter, priorityFilter]);

  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const categoryLabels: Record<string, string> = {
      resource_request: "RESOURCE REQUEST",
      spg_registration: "REGISTRATION",
      misconduct: "REPORT",
      support_inquiry: "SUPPORT INQUIRY",
      feedback: "FEEDBACK",
      misc: "MISC"
    };

    addTicket({
      title: newTitle,
      category: newCategory,
      categoryLabel: categoryLabels[newCategory] || "TICKET",
      status: newCategory === "spg_registration" ? "pending_approval" : "in_progress",
      priority: newPriority,
      track: newTrack,
      author: "Julian Chen",
      description: newDesc
    });

    setShowNewModal(false);
    setNewTitle("");
    setNewDesc("");
  };

  const getPriorityDot = (p: PriorityType) => {
    switch (p) {
      case "high":
        return <span className={styles.dotHigh}>● High</span>;
      case "medium":
        return <span className={styles.dotMedium}>● Medium</span>;
      case "low":
        return <span className={styles.dotLow}>● Low</span>;
    }
  };

  const getStatusBadge = (s: TicketItem["status"]) => {
    switch (s) {
      case "in_progress":
        return <span className={styles.badgeProgress}>In Progress</span>;
      case "pending_approval":
        return <span className={styles.badgePending}>Pending Approval</span>;
      case "resolved":
        return <span className={styles.badgeResolved}>Resolved</span>;
      default:
        return <span className={styles.badgeOpen}>Open</span>;
    }
  };

  return (
    <div className={styles.ticketPage}>
      {/* Top Header */}
      <div className={styles.pageHeader}>
        <div className={styles.headerMeta}>
          <h1 className={styles.pageTitle}>Ticket System</h1>
          <p className={styles.pageSubtitle}>
            Manage project inquiries, resource requests, and support tickets.
          </p>
        </div>

        <button
          type="button"
          className={styles.newTicketBtn}
          onClick={() => setShowNewModal(true)}
        >
          + New Ticket
        </button>
      </div>

      {/* 4 Stat Metric Cards */}
      <div className={styles.metricsRow}>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>TOTAL TICKETS</span>
          <span className={styles.metricVal}>{totalCount.toString().padStart(2, "0")}</span>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>OPEN</span>
          <span className={styles.metricVal}>{openCount.toString().padStart(2, "0")}</span>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>IN PROGRESS</span>
          <span className={styles.metricVal}>{inProgressCount.toString().padStart(2, "0")}</span>
        </div>
        <div className={styles.metricCard}>
          <span className={`${styles.metricLabel} ${styles.metricLabelGreen}`}>RESOLVED</span>
          <span className={styles.metricVal}>{resolvedCount.toString().padStart(2, "0")}</span>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className={styles.filterBar}>
        <div className={styles.filterInputs}>
          <div className={styles.filterTitle}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            <span>Filters</span>
          </div>

          <div className={styles.selectWrap}>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className={styles.selectDropdown}
            >
              <option value="All Types">All Types</option>
              <option value="Resource Request">Resource Request</option>
              <option value="Registration">SPG Registration</option>
              <option value="Support Inquiry">Support Inquiry</option>
              <option value="Misconduct Report">Misconduct Report</option>
            </select>
          </div>

          <div className={styles.selectWrap}>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className={styles.selectDropdown}
            >
              <option value="All Priority">All Priority</option>
              <option value="High">High Priority</option>
              <option value="Medium">Medium Priority</option>
              <option value="Low">Low Priority</option>
            </select>
          </div>
        </div>

        <div className={styles.tabsToggle}>
          <button
            type="button"
            className={`${styles.tabToggleBtn} ${tabMode === "active" ? styles.tabToggleActive : ""}`}
            onClick={() => setTabMode("active")}
          >
            Active
          </button>
          <button
            type="button"
            className={`${styles.tabToggleBtn} ${tabMode === "archived" ? styles.tabToggleActive : ""}`}
            onClick={() => setTabMode("archived")}
          >
            Archived
          </button>
        </div>
      </div>

      {/* Ticket Table */}
      <div className={styles.tableContainer}>
        <div className={styles.tableHeader}>
          <span className={styles.thId}>TICKET ID</span>
          <span className={styles.thTitle}>TITLE / TYPE</span>
          <span className={styles.thStatus}>STATUS</span>
          <span className={styles.thPriority}>PRIORITY</span>
          <span className={styles.thTrack}>TRACK</span>
          <span className={styles.thCreated}>CREATED</span>
          <span className={styles.thAction}>ACTION</span>
        </div>

        <div className={styles.tableBody}>
          {filteredTickets.map((t) => (
            <div key={t.id} className={styles.tableRow}>
              <span className={styles.colId}>{t.id}</span>

              <div className={styles.colTitle}>
                <span className={styles.ticketMainTitle}>{t.title}</span>
                <span className={styles.ticketTypeSubtitle}>{t.categoryLabel}</span>
              </div>

              <div className={styles.colStatus}>{getStatusBadge(t.status)}</div>

              <div className={styles.colPriority}>{getPriorityDot(t.priority)}</div>

              <span className={styles.colTrack}>{t.track}</span>

              <div className={styles.colCreated}>
                <span className={styles.createdDate}>
                  {new Date(t.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric"
                  })}
                </span>
                <span className={styles.createdRel}>{t.createdRelative}</span>
              </div>

              <div className={styles.colAction}>
                <button
                  type="button"
                  className={styles.actionMenuBtn}
                  onClick={() => alert(`Ticket ${t.id}: ${t.description || t.title}`)}
                >
                  ⋮
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pagination */}
      <div className={styles.paginationBar}>
        <span className={styles.paginationShowing}>
          Showing 1 to {filteredTickets.length} of {totalCount} tickets
        </span>

        <div className={styles.pageButtons}>
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
            className={`${styles.pageNum} ${currentPage === 1 ? styles.pageNumActive : ""}`}
            onClick={() => setCurrentPage(1)}
          >
            1
          </button>
          <button
            type="button"
            className={`${styles.pageNum} ${currentPage === 2 ? styles.pageNumActive : ""}`}
            onClick={() => setCurrentPage(2)}
          >
            2
          </button>
          <button
            type="button"
            className={`${styles.pageNum} ${currentPage === 3 ? styles.pageNumActive : ""}`}
            onClick={() => setCurrentPage(3)}
          >
            3
          </button>
          <button
            type="button"
            className={styles.pageArrow}
            onClick={() => setCurrentPage((p) => p + 1)}
          >
            ›
          </button>
        </div>
      </div>

      {/* New Ticket Modal */}
      {showNewModal && (
        <div className={styles.modalOverlay} onClick={() => setShowNewModal(false)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Create Support or Resource Ticket</h3>
              <button type="button" className={styles.closeBtn} onClick={() => setShowNewModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateTicket} className={styles.ticketForm}>
              <div className={styles.formGroup}>
                <label>Ticket Summary / Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. GPU Cluster Allocation for Ensemble Training"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className={styles.inputField}
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Ticket Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as TicketItem["category"])}
                    className={styles.inputField}
                  >
                    <option value="resource_request">Resource Request (SPG Compute/API)</option>
                    <option value="spg_registration">SPG Registration / Modification</option>
                    <option value="support_inquiry">Mentorship & Support Inquiry</option>
                    <option value="feedback">Idea Jar / General Feedback</option>
                    <option value="misconduct">Misconduct / Spam Report</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label>Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as PriorityType)}
                    className={styles.inputField}
                  >
                    <option value="high">High Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="low">Low Priority</option>
                  </select>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Affiliated Club Track</label>
                <select
                  value={newTrack}
                  onChange={(e) => setNewTrack(e.target.value as TrackType)}
                  className={styles.inputField}
                >
                  <option value="Kaggle">Kaggle Track</option>
                  <option value="Research">Research Track</option>
                  <option value="Product">Product Track</option>
                  <option value="General">General / Cross-Track</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label>Detailed Description & Justification</label>
                <textarea
                  rows={4}
                  placeholder="Provide complete context, links to previous SPG progress, or issue specifics..."
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
                  File Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
