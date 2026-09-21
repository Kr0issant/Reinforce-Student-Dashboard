"use client";

import React, { useState } from "react";
import { useClub, ClubEvent } from "@/lib/useClubStore";
import styles from "./events.module.css";

type CategoryFilter = "ALL EVENTS" | "WORKSHOPS" | "HACKATHONS" | "MEETUPS";

export default function EventsPage() {
  const { events, toggleEventRSVP } = useClub();
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("ALL EVENTS");
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [currentMonth, setCurrentMonth] = useState("September 2025");

  // Calendar event days mapping for dots
  const eventDaysMap: Record<number, { dotColor: string; title: string }> = {
    9: { dotColor: "#E5B731", title: "Mentor Office Prep" },
    10: { dotColor: "#38BDF8", title: "Reinforce HackSprint v3.0" },
    12: { dotColor: "#22C55E", title: "Multi-Agent RL Deep Dive" },
    15: { dotColor: "#C084FC", title: "Founders Office Hours" },
    18: { dotColor: "#E5B731", title: "Kaggle Fireside Chat" },
    21: { dotColor: "#22C55E", title: "Deploying LLMs with vLLM" }
  };

  // Filter events based on active category & selected calendar day
  const filteredEvents = events.filter((ev) => {
    // Category match
    if (activeCategory === "WORKSHOPS" && ev.category !== "Workshop") return false;
    if (activeCategory === "HACKATHONS" && ev.category !== "Hackathon" && ev.category !== "Sprint" && ev.category !== "Datathon") return false;
    if (activeCategory === "MEETUPS" && ev.category !== "Meetup" && ev.category !== "Discussion") return false;

    // Day match (if day is clicked)
    if (selectedDay !== null && ev.dayNumber && ev.dayNumber !== selectedDay) {
      return false;
    }

    return true;
  });

  const getCategoryColor = (cat: ClubEvent["category"]) => {
    switch (cat) {
      case "Hackathon":
      case "Sprint":
      case "Datathon":
        return styles.catHackathon;
      case "Workshop":
        return styles.catWorkshop;
      case "Meetup":
      case "Discussion":
        return styles.catMeetup;
      default:
        return styles.catDefault;
    }
  };

  const getStatusClass = (statusType?: string) => {
    switch (statusType) {
      case "registered":
        return styles.statusRegistered;
      case "available":
        return styles.statusAvailable;
      case "limited":
        return styles.statusLimited;
      case "full":
        return styles.statusFull;
      default:
        return styles.statusAvailable;
    }
  };

  // Calendar dates layout for September (30 days, starting on Monday)
  const calendarDays = [
    { day: 31, isPrevMonth: true },
    { day: 1 }, { day: 2 }, { day: 3 }, { day: 4 }, { day: 5 }, { day: 6 },
    { day: 7 }, { day: 8 }, { day: 9 }, { day: 10 }, { day: 11 }, { day: 12 }, { day: 13 },
    { day: 14 }, { day: 15 }, { day: 16 }, { day: 17 }, { day: 18 }, { day: 19 }, { day: 20 },
    { day: 21 }, { day: 22 }, { day: 23 }, { day: 24 }, { day: 25 }, { day: 26 }, { day: 27 },
    { day: 28 }, { day: 29 }, { day: 30 }
  ];

  return (
    <div className={styles.eventsPage}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>EVENTS CALENDAR</h1>
        <p className={styles.pageSubtitle}>
          Sync your schedule with the guild&apos;s core milestones and workshops.
        </p>
      </div>

      {/* Main 2-Column Layout */}
      <div className={styles.mainLayout}>
        {/* Left Column: Category Filters & Event List */}
        <div className={styles.leftColumn}>
          {/* Category Filter Pills */}
          <div className={styles.filterPills}>
            {(["ALL EVENTS", "WORKSHOPS", "HACKATHONS", "MEETUPS"] as CategoryFilter[]).map((cat) => (
              <button
                key={cat}
                type="button"
                className={`${styles.filterPill} ${activeCategory === cat ? styles.filterPillActive : ""}`}
                onClick={() => {
                  setActiveCategory(cat);
                  setSelectedDay(null);
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Active Filter Note if Day is filtered */}
          {selectedDay !== null && (
            <div className={styles.dayFilterBanner}>
              <span>Showing events for <strong>September {selectedDay}</strong></span>
              <button
                type="button"
                className={styles.clearDayBtn}
                onClick={() => setSelectedDay(null)}
              >
                Clear Day Filter ✕
              </button>
            </div>
          )}

          {/* Event Cards List */}
          <div className={styles.eventsList}>
            {filteredEvents.length === 0 ? (
              <div className={styles.emptyState}>
                <p>No events scheduled for the selected filter.</p>
                <button
                  type="button"
                  className={styles.resetBtn}
                  onClick={() => {
                    setActiveCategory("ALL EVENTS");
                    setSelectedDay(null);
                  }}
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              filteredEvents.map((ev) => {
                const isRegistered = ev.userRsvp || ev.statusType === "registered";
                const isClosed = ev.statusType === "full";

                return (
                  <div key={ev.id} className={styles.eventCard}>
                    {/* Left Date Block */}
                    <div className={styles.dateBlock}>
                      <span className={styles.dateMonth}>{ev.monthDay.month}</span>
                      <span className={styles.dateDay}>{ev.monthDay.day}</span>
                    </div>

                    {/* Middle Info */}
                    <div className={styles.eventContent}>
                      <span className={`${styles.categoryTag} ${getCategoryColor(ev.category)}`}>
                        {ev.category.toUpperCase()}
                      </span>
                      <h3 className={styles.eventTitle}>{ev.title}</h3>
                      <div className={styles.eventMeta}>
                        <span className={styles.metaItem}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                          {ev.time}
                        </span>
                        <span className={styles.metaItem}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                          {ev.location}
                        </span>
                      </div>
                    </div>

                    {/* Right Action & Status */}
                    <div className={styles.actionCol}>
                      <div className={styles.statusSection}>
                        <span className={styles.statusHeading}>STATUS</span>
                        <span className={`${styles.statusValue} ${getStatusClass(ev.statusType)}`}>
                          {isRegistered ? "REGISTERED" : ev.statusLabel || "AVAILABLE"}
                        </span>
                      </div>

                      {isClosed ? (
                        <button type="button" className={styles.closedBtn} disabled>
                          CLOSED
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={`${styles.rsvpBtn} ${isRegistered ? styles.joinedBtn : ""}`}
                          onClick={() => toggleEventRSVP(ev.id)}
                        >
                          {isRegistered ? "JOINED" : "RSVP NOW"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Calendar, Stats & Sync Card */}
        <div className={styles.rightColumn}>
          {/* Calendar Widget */}
          <div className={styles.calendarCard}>
            <div className={styles.calendarHeader}>
              <div>
                <h3 className={styles.calendarMonth}>{currentMonth}</h3>
                <span className={styles.calendarSub}>SCHEDULE VIEW</span>
              </div>
              <div className={styles.calendarNav}>
                <button
                  type="button"
                  className={styles.navArrowBtn}
                  aria-label="Previous Month"
                  onClick={() => setCurrentMonth("August 2025")}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <button
                  type="button"
                  className={styles.navArrowBtn}
                  aria-label="Next Month"
                  onClick={() => setCurrentMonth("October 2025")}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Days of Week Header */}
            <div className={styles.weekDaysGrid}>
              <span>SUN</span>
              <span>MON</span>
              <span>TUE</span>
              <span>WED</span>
              <span>THU</span>
              <span>FRI</span>
              <span>SAT</span>
            </div>

            {/* Calendar Dates Grid */}
            <div className={styles.datesGrid}>
              {calendarDays.map((item, idx) => {
                const hasEvent = !item.isPrevMonth && eventDaysMap[item.day];
                const isSelected = selectedDay === item.day || (!selectedDay && item.day === 10 && !item.isPrevMonth);

                return (
                  <button
                    key={idx}
                    type="button"
                    className={`${styles.dateCell} ${item.isPrevMonth ? styles.dimmedCell : ""} ${
                      isSelected ? styles.selectedCell : ""
                    }`}
                    onClick={() => {
                      if (!item.isPrevMonth) {
                        setSelectedDay(selectedDay === item.day ? null : item.day);
                      }
                    }}
                  >
                    <span className={styles.cellNumber}>{item.day}</span>
                    {hasEvent && !item.isPrevMonth && (
                      <span
                        className={styles.eventDot}
                        style={{ backgroundColor: hasEvent.dotColor }}
                        title={hasEvent.title}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Event Statistics */}
          <div className={styles.statsCard}>
            <h3 className={styles.statsTitle}>EVENT STATISTICS</h3>
            <div className={styles.statsRows}>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Total Events (Sep)</span>
                <span className={styles.statGold}>14</span>
              </div>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Workshops Completed</span>
                <span className={styles.statGreen}>4</span>
              </div>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Merit Points Earned</span>
                <span className={styles.statBlue}>+450</span>
              </div>
            </div>

            <div className={styles.progressContainer}>
              <div className={styles.progressBarTrack}>
                <div className={styles.progressBarFill} style={{ width: "65%" }} />
              </div>
              <span className={styles.progressLabel}>65% MONTHLY PARTICIPATION TARGET</span>
            </div>
          </div>

          {/* Sync Calendar CTA Banner */}
          <button
            type="button"
            className={styles.syncCard}
            onClick={() => alert("Calendar subscribed! Real-time Discord & Google Calendar events synced.")}
          >
            <div className={styles.syncIconWrap}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <path d="m9 16 2 2 4-4" />
              </svg>
            </div>
            <div className={styles.syncText}>
              <span className={styles.syncHeading}>SYNC GUILD CALENDAR</span>
              <span className={styles.syncSub}>Auto-import workshops & sprints to Google Calendar</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
