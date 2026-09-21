"use client";

import React from "react";
import Link from "next/link";
import { useClub, TrackType } from "@/lib/useClubStore";
import { HeadlineCarousel, CalendarWidget } from "@/components/dashboard/DashboardWidgets";
import styles from "./dashboard.module.css";

export default function DashboardClient() {
  const { spgs, events } = useClub();

  const getTrackTagClass = (track: TrackType) => {
    switch (track) {
      case "Kaggle":
        return styles.trackKaggle;
      case "Product":
        return styles.trackProduct;
      case "Research":
        return styles.trackResearch;
      default:
        return styles.trackGeneral;
    }
  };

  const getHealthBadgeClass = (health: string) => {
    switch (health) {
      case "on_track":
        return styles.badgeOnTrack;
      case "need_progress":
        return styles.badgeNeedProgress;
      case "at_risk":
        return styles.badgeAtRisk;
      default:
        return styles.badgeNeutral;
    }
  };

  return (
    <div className={styles.dashboardContainer}>
      {/* Top Section: Big Yellow Headline Carousel (Left) & Upcoming Events (Right) */}
      <section className={styles.topHeroGrid}>
        {/* Big Yellow Headline Carousel */}
        <div className={styles.carouselCol}>
          <HeadlineCarousel />
        </div>

        {/* Upcoming Events Box (Pushed up to the top right) */}
        <div className={styles.eventsCol}>
          <div className={styles.widgetCard}>
            <div className={styles.widgetCardHeader}>
              <div className={styles.widgetTitleGroup}>
                <span className={styles.eventsHeaderIcon}>⚡</span>
                <h3 className={styles.widgetTitle}>Upcoming Events</h3>
              </div>
              <Link href="/dashboard/events" className={styles.smallGoldLink}>
                View All →
              </Link>
            </div>

            <div className={styles.eventsList}>
              {events.slice(0, 2).map((ev) => (
                <div key={ev.id} className={styles.eventItem}>
                  <div className={styles.eventDateBadge}>
                    <span className={styles.dateMonth}>{ev.monthDay.month}</span>
                    <span className={styles.dateDay}>{ev.monthDay.day}</span>
                  </div>
                  <div className={styles.eventInfo}>
                    <h4 className={styles.eventTitle}>{ev.title}</h4>
                    <span className={styles.eventLocation}>
                      {ev.location.includes("Lab") ? "📍 " : "👥 "}
                      {ev.location}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <Link href="/dashboard/events" className={styles.calendarLink}>
              View Event Calendar
            </Link>
          </div>
        </div>
      </section>

      {/* Main Body Grid: Current Projects (Left) & Interactive Calendar (Right) */}
      <div className={styles.mainLayoutGrid}>
        {/* Left Column: Current Projects (SPG) */}
        <div className={styles.projectsSection}>
          <div className={styles.sectionHeaderBar}>
            <div className={styles.sectionTitleWithBar}>
              <span className={styles.yellowBar} />
              <h2 className={styles.sectionHeading}>Current Projects (SPG)</h2>
            </div>
            <Link href="/dashboard/spg" className={styles.viewAllLink}>
              View All Management
            </Link>
          </div>

          <div className={styles.spgList}>
            {spgs.slice(0, 3).map((spg) => (
              <div key={spg.id} className={styles.projectCard}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardTags}>
                    <span className={`${styles.trackTag} ${getTrackTagClass(spg.track)}`}>
                      {spg.track.toUpperCase()} TRACK
                    </span>
                    <span className={styles.projectCode}>ID: {spg.id}</span>
                  </div>
                  <span className={`${styles.healthBadge} ${getHealthBadgeClass(spg.health)}`}>
                    {spg.health === "on_track"
                      ? "On Track"
                      : spg.health === "need_progress"
                      ? "Need Progress"
                      : "At Risk"}
                  </span>
                </div>

                <Link href={`/dashboard/spg/${spg.id}`} className={styles.projectTitleLink}>
                  <h3 className={styles.projectTitle}>{spg.title}</h3>
                </Link>
                <p className={styles.projectDesc}>{spg.description}</p>

                <div className={styles.cardFooter}>
                  <div className={styles.avatarStack}>
                    {spg.members.slice(0, 2).map((m, idx) => (
                      <div key={idx} className={styles.memberAvatar}>
                        {m.initials}
                      </div>
                    ))}
                    {spg.members.length > 2 && (
                      <div className={styles.avatarMore}>
                        +{spg.members.length - 2}
                      </div>
                    )}
                  </div>

                  <div className={styles.cardActionsRight}>
                    <div className={styles.metaSubtext}>
                      {spg.id === "SPG-2024-089" ? (
                        <>
                          <span className={styles.metaLabel}>NEXT REPORT</span>
                          <span className={styles.metaVal}>In 2 days</span>
                        </>
                      ) : (
                        <>
                          <span className={styles.metaLabel}>RESOURCES</span>
                          <span className={styles.metaVal}>Pending Review</span>
                        </>
                      )}
                    </div>

                    {spg.id === "SPG-2024-089" ? (
                      <Link
                        href={`/dashboard/spg/${spg.id}/report`}
                        className={styles.submitReportBtn}
                      >
                        Submit Report
                      </Link>
                    ) : (
                      <Link
                        href={`/dashboard/spg/${spg.id}`}
                        className={styles.manageResourcesBtn}
                      >
                        Manage Resources
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Calendar Widget & Quick Resources */}
        <div className={styles.sidebarWidgets}>
          {/* Interactive Calendar Widget (Directly below Upcoming Events) */}
          <CalendarWidget />

          {/* Quick Idea Jar Preview */}
          <div className={styles.widgetCard}>
            <div className={styles.widgetCardHeader}>
              <div className={styles.widgetTitleGroup}>
                <span className={styles.eventsHeaderIcon}>💡</span>
                <h3 className={styles.widgetTitle}>Idea Jar</h3>
              </div>
              <Link href="/dashboard/ideas" className={styles.smallGoldLink}>
                Browse All →
              </Link>
            </div>
            <p className={styles.ideaJarPrompt}>
              Need inspiration for your next SPG? Grab a curated AI/ML research proposal or product idea from core.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
