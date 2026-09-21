"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useClub } from "@/lib/useClubStore";
import styles from "./Header.module.css";

export default function Header() {
  const pathname = usePathname();
  const { user, searchQuery, setSearchQuery } = useClub();
  const [showNotifications, setShowNotifications] = useState(false);

  // Compute breadcrumbs and title
  const getPageTitle = () => {
    if (pathname === "/dashboard") return "Dashboard Overview";
    if (pathname.startsWith("/dashboard/spg/")) {
      if (pathname.includes("/report")) return "Submit Progress Report";
      return "SPG Project Details";
    }
    if (pathname === "/dashboard/spg") return "SPG Management";
    if (pathname === "/dashboard/tickets") return "Ticket System";
    if (pathname === "/dashboard/events") return "Events Planner";
    if (pathname === "/dashboard/articles") return "Article Hub";
    if (pathname === "/dashboard/ideas") return "Idea Jar";
    if (pathname === "/dashboard/leaderboard") return "Track Leaderboard";
    if (pathname === "/profile") return "Student Profile";
    return "Reinforce Dashboard";
  };

  const isSubPage = pathname.startsWith("/dashboard/spg") && pathname !== "/dashboard/spg";

  return (
    <header className={styles.header}>
      {/* Page Title / Breadcrumbs */}
      <div className={styles.titleWrap}>
        {isSubPage ? (
          <div className={styles.breadcrumbs}>
            <Link href="/dashboard" className={styles.breadcrumbLink}>DASHBOARD</Link>
            <span className={styles.breadcrumbSep}>›</span>
            <Link href="/dashboard/spg" className={styles.breadcrumbLink}>SPG MANAGEMENT</Link>
          </div>
        ) : null}
        <h1 className={styles.title}>{getPageTitle()}</h1>
      </div>

      {/* Right Header Actions */}
      <div className={styles.actionsWrap}>
        {/* Search Bar */}
        <div className={styles.searchBar}>
          <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search projects, tickets, ideas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        {/* Notifications Icon */}
        <div className={styles.popoverWrap}>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => setShowNotifications(!showNotifications)}
            aria-label="Notifications"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span className={styles.notifDot} />
          </button>

          {showNotifications && (
            <div className={styles.dropdownMenu}>
              <div className={styles.dropdownHeader}>
                <span>Notifications</span>
                <span className={styles.unreadCount}>2 new</span>
              </div>
              <div className={styles.notifList}>
                <div className={styles.notifItem}>
                  <div className={styles.notifBadge}>SPG</div>
                  <div className={styles.notifContent}>
                    <p className={styles.notifText}><strong>Sarah Varghese</strong> reviewed your milestone report #08.</p>
                    <span className={styles.notifTime}>2 hours ago</span>
                  </div>
                </div>
                <div className={styles.notifItem}>
                  <div className={styles.notifBadge}>TICKET</div>
                  <div className={styles.notifContent}>
                    <p className={styles.notifText}>Ticket <strong>#TK-8842</strong> assigned to Track Lead.</p>
                    <span className={styles.notifTime}>Yesterday</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Chip */}
        <div className={styles.popoverWrap}>
          <Link href="/profile" className={styles.userProfileChip} title="View your profile">
            <div className={styles.userInfo}>
              <span className={styles.userName}>{user.name}</span>
              <span className={styles.userTrack}>{user.track.toUpperCase()} TRACK</span>
            </div>
            <div className={styles.userAvatar}>
              {user.initials}
            </div>
          </Link>
        </div>
      </div>
    </header>
  );
}
