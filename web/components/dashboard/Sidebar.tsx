"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useClub } from "@/lib/useClubStore";
import styles from "./Sidebar.module.css";

const MAIN_NAV_ITEMS = [
  {
    name: "Dashboard",
    path: "/dashboard",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
      </svg>
    )
  },
  {
    name: "SPG Management",
    path: "/dashboard/spg",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </svg>
    )
  },
  {
    name: "Ticket System",
    path: "/dashboard/tickets",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
        <path d="M13 5v2" />
        <path d="M13 17v2" />
        <path d="M13 11v2" />
      </svg>
    )
  },
  {
    name: "Events Planner",
    path: "/dashboard/events",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    )
  },
  {
    name: "Article Hub",
    path: "/dashboard/articles",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        <line x1="9" y1="7" x2="15" y2="7" />
        <line x1="9" y1="11" x2="15" y2="11" />
      </svg>
    )
  }
];

const RESOURCE_NAV_ITEMS = [
  {
    name: "Idea Jar",
    path: "/dashboard/ideas",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18h6" />
        <path d="M10 22h4" />
        <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
      </svg>
    )
  },
  {
    name: "Leaderboard",
    path: "/dashboard/leaderboard",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
        <path d="M4 22h16" />
        <path d="M10 14.66V17c0 .55-.45 1-1 1H7" />
        <path d="M14 14.66V17c0 .55.45 1 1 1h2" />
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
      </svg>
    )
  }
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useClub();

  const isNavActive = (path: string) => {
    if (path === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(path);
  };

  // Tier progress calculation (e.g. 240 / 300 pts)
  const maxPoints = 300;
  const progressPercent = Math.min(100, Math.round((user.points / maxPoints) * 100));

  return (
    <aside className={styles.sidebar}>
      {/* Brand Header */}
      <div className={styles.logoWrap}>
        <Link href="/" className={styles.logoLink} title="Reinforce Home">
          <Image
            src="/brand/logo_main.png"
            alt="Reinforce Logo"
            width={220}
            height={60}
            priority
            className={styles.logoImage}
          />
        </Link>
      </div>

      {/* Nav Menu */}
      <div className={styles.navContainer}>
        <div className={styles.navSection}>
          <span className={styles.sectionHeader}>MAIN MENU</span>
          <nav className={styles.navList}>
            {MAIN_NAV_ITEMS.map((item) => {
              const active = isNavActive(item.path);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`${styles.navItem} ${active ? styles.active : ""}`}
                >
                  <span className={styles.navIcon}>{item.icon}</span>
                  <span className={styles.navLabel}>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className={styles.navSection}>
          <span className={styles.sectionHeader}>RESOURCES</span>
          <nav className={styles.navList}>
            {RESOURCE_NAV_ITEMS.map((item) => {
              const active = isNavActive(item.path);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`${styles.navItem} ${active ? styles.active : ""}`}
                >
                  <span className={styles.navIcon}>{item.icon}</span>
                  <span className={styles.navLabel}>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Bottom Tier Status Widget */}
      <div className={styles.tierCard}>
        <div className={styles.tierHeader}>
          <span className={styles.tierBadge}>{user.tier.toUpperCase()}</span>
          <span className={styles.tierPoints}>{user.points} Points earned</span>
        </div>

        <div className={styles.progressBarBg}>
          <div
            className={styles.progressBarFill}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Shield watermark background */}
        <div className={styles.shieldWatermark}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>

        <div className={styles.tierFooter}>
          <Link href="/profile" className={styles.userCorner}>
            <div className={styles.avatarMini}>{user.initials}</div>
            <span className={styles.viewProfileText}>View Profile</span>
          </Link>
        </div>
      </div>
    </aside>
  );
}
