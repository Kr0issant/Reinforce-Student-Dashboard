"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import styles from "./DashboardWidgets.module.css";

interface HeadlineItem {
  id: string;
  tag: string;
  title: string;
  description: string;
  ctaText: string;
  ctaLink: string;
  badgeMeta: string;
  accentIcon: string;
}

const HEADLINES: HeadlineItem[] = [
  {
    id: "hl-1",
    tag: "NEW EVENT",
    title: "Registration Open for Reinforce Datathon 2024",
    description:
      "Campus-wide 48-hour competition tackling multimodal sensor prediction and seismic event forecasting. ₹50,000 prize pool and dedicated A100 compute for podium finishers.",
    ctaText: "Register Your Team →",
    ctaLink: "/dashboard/events",
    badgeMeta: "NOV 15 - 17, 2024",
    accentIcon: "🏆"
  },
  {
    id: "hl-2",
    tag: "MAJOR SPG RECRUITMENT",
    title: "Autonomous Drone Visual Navigation (SPG-2024-055)",
    description:
      "Research Track is recruiting 2 Simulation Engineers experienced with AirSim / ROS 2 to deploy real-time PPO obstacle avoidance on physical quadcopters in Lab 4.",
    ctaText: "Apply to Group →",
    ctaLink: "/dashboard/spg/SPG-2024-055",
    badgeMeta: "DEADLINE: 05 NOV",
    accentIcon: "🚀"
  },
  {
    id: "hl-3",
    tag: "PAPER DISCUSSION",
    title: "RE:Thesis — State Space Models (Mamba vs Transformers)",
    description:
      "Join us this Friday at 6:00 PM on Discord VC 1 as we dissect linear-time sequence models and test selective state space benchmarks on SST cluster hardware.",
    ctaText: "RSVP Discussion →",
    ctaLink: "/dashboard/events",
    badgeMeta: "DISCORD VC 1 • 6 PM",
    accentIcon: "📑"
  },
  {
    id: "hl-4",
    tag: "CLUB ANNOUNCEMENT",
    title: "Discord Bot YUVI v2.4 Released with Slash Commands",
    description:
      "You can now link GPU cluster requests and milestone submissions directly using the /ticket and /spg slash commands inside the Reinforce Discord server.",
    ctaText: "File a Ticket →",
    ctaLink: "/dashboard/tickets",
    badgeMeta: "DEPLOYED TO RENDER",
    accentIcon: "🤖"
  }
];

export function HeadlineCarousel() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HEADLINES.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [isPaused]);

  const slide = HEADLINES[currentSlide];

  const handlePrev = () => {
    setCurrentSlide((prev) => (prev === 0 ? HEADLINES.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentSlide((prev) => (prev + 1) % HEADLINES.length);
  };

  return (
    <div
      className={styles.carouselContainer}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Background Watermark */}
      <div className={styles.carouselWatermark}>{slide.accentIcon}</div>

      <div className={styles.carouselHeaderRow}>
        <div className={styles.tagWrap}>
          <span className={styles.carouselTag}>{slide.tag}</span>
          <span className={styles.carouselMeta}>{slide.badgeMeta}</span>
        </div>

        {/* Carousel Controls */}
        <div className={styles.carouselNavButtons}>
          <button
            type="button"
            className={styles.carouselNavBtn}
            onClick={handlePrev}
            aria-label="Previous headline"
          >
            ‹
          </button>
          <button
            type="button"
            className={styles.carouselNavBtn}
            onClick={handleNext}
            aria-label="Next headline"
          >
            ›
          </button>
        </div>
      </div>

      <div className={styles.carouselContent}>
        <h2 className={styles.carouselTitle}>{slide.title}</h2>
        <p className={styles.carouselDescription}>{slide.description}</p>
      </div>

      <div className={styles.carouselFooter}>
        <Link href={slide.ctaLink} className={styles.carouselCta}>
          {slide.ctaText}
        </Link>

        {/* Dots indicators */}
        <div className={styles.carouselDots}>
          {HEADLINES.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              className={`${styles.carouselDot} ${
                idx === currentSlide ? styles.carouselDotActive : ""
              }`}
              onClick={() => setCurrentSlide(idx)}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function CalendarWidget() {
  const [selectedDay, setSelectedDay] = useState<number>(24);
  const [currentMonth, setCurrentMonth] = useState("October 2024");

  // Event days in October 2024
  const eventDays: Record<number, { title: string; type: string; location: string }> = {
    12: { title: "GPU Allocation Review", type: "SPG", location: "Online" },
    15: { title: "Phase 1 Submission Deadline", type: "Milestone", location: "SPG Hub" },
    24: { title: "24-Hour AI Sprint", type: "Hackathon", location: "Lab 4, Tech Wing" },
    28: { title: "CUDA Optimization Workshop", type: "Workshop", location: "Hall B" },
    31: { title: "Kaggle Checkpoint Review", type: "Kaggle", location: "Discord" }
  };

  // October 2024 starts on Tuesday (offset 1 day in standard Mo-Su grid)
  const totalDays = 31;
  const startOffset = 1; // Tuesday
  const daysArray = Array.from({ length: totalDays }, (_, i) => i + 1);
  const blanks = Array.from({ length: startOffset }, (_, i) => i);

  const selectedEvent = eventDays[selectedDay];

  return (
    <div className={styles.calendarCard}>
      <div className={styles.calendarHeader}>
        <div className={styles.calTitleGroup}>
          <span className={styles.calIcon}>📅</span>
          <h3 className={styles.calMonthName}>{currentMonth}</h3>
        </div>
        <div className={styles.calNav}>
          <button
            type="button"
            className={styles.calNavBtn}
            onClick={() => setCurrentMonth("September 2024")}
          >
            ‹
          </button>
          <button
            type="button"
            className={styles.calNavBtn}
            onClick={() => setCurrentMonth("November 2024")}
          >
            ›
          </button>
        </div>
      </div>

      {/* Weekday Labels */}
      <div className={styles.weekDaysGrid}>
        <span>Mo</span>
        <span>Tu</span>
        <span>We</span>
        <span>Th</span>
        <span>Fr</span>
        <span>Sa</span>
        <span>Su</span>
      </div>

      {/* Days Grid */}
      <div className={styles.daysGrid}>
        {blanks.map((b) => (
          <div key={`blank-${b}`} className={styles.blankDay} />
        ))}

        {daysArray.map((day) => {
          const hasEvent = !!eventDays[day];
          const isSelected = selectedDay === day;
          const isToday = day === 22; // Simulated current day

          return (
            <button
              key={day}
              type="button"
              className={`${styles.dayCell} ${isSelected ? styles.daySelected : ""} ${
                isToday ? styles.dayToday : ""
              }`}
              onClick={() => setSelectedDay(day)}
            >
              <span>{day}</span>
              {hasEvent && <span className={styles.eventDot} />}
            </button>
          );
        })}
      </div>

      {/* Selected Day Event Banner */}
      <div className={styles.calEventSummary}>
        {selectedEvent ? (
          <div className={styles.calEventDetail}>
            <div className={styles.calEventTop}>
              <span className={styles.calEventBadge}>{selectedEvent.type}</span>
              <span className={styles.calEventDate}>Oct {selectedDay}, 2024</span>
            </div>
            <strong className={styles.calEventTitle}>{selectedEvent.title}</strong>
            <span className={styles.calEventLoc}>📍 {selectedEvent.location}</span>
          </div>
        ) : (
          <div className={styles.calNoEvent}>
            <span>No scheduled club events on Oct {selectedDay}.</span>
          </div>
        )}
      </div>
    </div>
  );
}
