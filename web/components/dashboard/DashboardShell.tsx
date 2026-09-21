"use client";

import React, { useState } from "react";
import Link from "next/link";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { ClubProvider } from "@/lib/useClubStore";
import styles from "./DashboardShell.module.css";

interface DashboardShellProps {
  children: React.ReactNode;
}

export default function DashboardShell({ children }: DashboardShellProps) {
  const [showQuickModal, setShowQuickModal] = useState(false);

  return (
    <ClubProvider>
      <div className={styles.shellLayout}>
        <Sidebar />
        <div className={styles.mainWrapper}>
          <Header />
          <div className={styles.contentArea}>{children}</div>
        </div>

        {/* Floating Action Button (+) */}
        <button
          type="button"
          className={styles.fabButton}
          onClick={() => setShowQuickModal(!showQuickModal)}
          title="Quick Actions"
          aria-label="Quick Actions"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>

        {/* Quick Action Modal */}
        {showQuickModal && (
          <div className={styles.modalOverlay} onClick={() => setShowQuickModal(false)}>
            <div className={styles.quickModal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3>Quick Actions</h3>
                <button
                  type="button"
                  className={styles.closeBtn}
                  onClick={() => setShowQuickModal(false)}
                >
                  ✕
                </button>
              </div>
              <div className={styles.actionGrid}>
                <Link
                  href="/dashboard/spg"
                  className={styles.actionCard}
                  onClick={() => setShowQuickModal(false)}
                >
                  <div className={styles.actionIcon}>🚀</div>
                  <div className={styles.actionMeta}>
                    <strong>New SPG Application</strong>
                    <span>Register a student project group</span>
                  </div>
                </Link>

                <Link
                  href="/dashboard/tickets"
                  className={styles.actionCard}
                  onClick={() => setShowQuickModal(false)}
                >
                  <div className={styles.actionIcon}>🎫</div>
                  <div className={styles.actionMeta}>
                    <strong>Create Support Ticket</strong>
                    <span>Resource requests, inquiry, or reports</span>
                  </div>
                </Link>

                <Link
                  href="/dashboard/spg/SPG-2024-089/report"
                  className={styles.actionCard}
                  onClick={() => setShowQuickModal(false)}
                >
                  <div className={styles.actionIcon}>📝</div>
                  <div className={styles.actionMeta}>
                    <strong>Submit Progress Report</strong>
                    <span>File milestone update for active SPG</span>
                  </div>
                </Link>

                <Link
                  href="/dashboard/ideas"
                  className={styles.actionCard}
                  onClick={() => setShowQuickModal(false)}
                >
                  <div className={styles.actionIcon}>💡</div>
                  <div className={styles.actionMeta}>
                    <strong>Submit Idea to Jar</strong>
                    <span>Pitch a project idea for club members</span>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </ClubProvider>
  );
}
