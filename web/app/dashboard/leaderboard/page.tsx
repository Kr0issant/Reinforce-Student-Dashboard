"use client";

import React, { useState } from "react";
import { useClub, TrackType } from "@/lib/useClubStore";
import styles from "./leaderboard.module.css";

export default function LeaderboardPage() {
  const { leaderboard, user } = useClub();
  const [selectedTrack, setSelectedTrack] = useState<string>("All");

  const filteredLeaderboard = leaderboard.filter((entry) => {
    if (selectedTrack === "All") return true;
    return entry.track === selectedTrack;
  });

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <span className={styles.rankGold}>🥇 1</span>;
    if (rank === 2) return <span className={styles.rankSilver}>🥈 2</span>;
    if (rank === 3) return <span className={styles.rankBronze}>🥉 3</span>;
    return <span className={styles.rankRegular}>{rank}</span>;
  };

  return (
    <div className={styles.leaderboardPage}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Track Record & Points Leaderboard</h1>
          <p className={styles.pageSubtitle}>
            Accumulated points from verified SPG milestone submissions, research papers, and competition podiums.
          </p>
        </div>
      </div>

      {/* Track Filter Tabs */}
      <div className={styles.filterTabs}>
        {["All", "Kaggle", "Research", "Product"].map((tr) => (
          <button
            key={tr}
            type="button"
            className={`${styles.tabBtn} ${selectedTrack === tr ? styles.tabActive : ""}`}
            onClick={() => setSelectedTrack(tr)}
          >
            {tr === "All" ? "Overall Ranking" : `${tr} Track`}
          </button>
        ))}
      </div>

      {/* Top 3 Podium Cards */}
      <div className={styles.podiumGrid}>
        {filteredLeaderboard.slice(0, 3).map((entry, idx) => (
          <div
            key={entry.name}
            className={`${styles.podiumCard} ${
              idx === 0 ? styles.podiumFirst : idx === 1 ? styles.podiumSecond : styles.podiumThird
            }`}
          >
            <div className={styles.podiumRank}>
              {idx === 0 ? "🥇 #1" : idx === 1 ? "🥈 #2" : "🥉 #3"}
            </div>
            <div className={styles.podiumAvatar}>{entry.initials}</div>
            <h3 className={styles.podiumName}>{entry.name}</h3>
            <span className={styles.podiumTrack}>{entry.track.toUpperCase()} TRACK</span>

            <div className={styles.podiumPoints}>
              <strong>{entry.points}</strong>
              <span>POINTS</span>
            </div>

            <div className={styles.podiumStats}>
              <span>{entry.spgCount} SPGs</span>
              <span>•</span>
              <span>{entry.articlesCount} Articles</span>
              <span>•</span>
              <span>{entry.eventWinsCount} Wins</span>
            </div>
          </div>
        ))}
      </div>

      {/* Full Leaderboard Table */}
      <div className={styles.tableContainer}>
        <div className={styles.tableHeader}>
          <span className={styles.thRank}>RANK</span>
          <span className={styles.thMember}>MEMBER</span>
          <span className={styles.thTrack}>TRACK</span>
          <span className={styles.thTier}>TIER</span>
          <span className={styles.thStats}>CONTRIBUTIONS</span>
          <span className={styles.thPoints}>POINTS</span>
        </div>

        <div className={styles.tableBody}>
          {filteredLeaderboard.map((entry, idx) => {
            const isCurrentUser = entry.name === user.name;
            return (
              <div
                key={entry.name}
                className={`${styles.tableRow} ${isCurrentUser ? styles.highlightUserRow : ""}`}
              >
                <div className={styles.colRank}>{getRankBadge(idx + 1)}</div>

                <div className={styles.colMember}>
                  <div className={styles.rowAvatar}>{entry.initials}</div>
                  <div className={styles.memberMeta}>
                    <span className={styles.rowName}>
                      {entry.name} {isCurrentUser && <span className={styles.youBadge}>YOU</span>}
                    </span>
                  </div>
                </div>

                <span className={styles.colTrack}>{entry.track}</span>

                <div>
                  <span
                    className={
                      entry.tier === "Core Team"
                        ? styles.tierCore
                        : entry.tier === "Advanced Member"
                        ? styles.tierAdvanced
                        : styles.tierBeginner
                    }
                  >
                    {entry.tier}
                  </span>
                </div>

                <div className={styles.colContrib}>
                  <span>{entry.spgCount} SPGs</span>
                  <span>•</span>
                  <span>{entry.articlesCount} Papers</span>
                  <span>•</span>
                  <span>{entry.eventWinsCount} Wins</span>
                </div>

                <div className={styles.colPoints}>
                  <strong>{isCurrentUser ? user.points : entry.points}</strong>
                  <span>pts</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
