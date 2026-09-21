"use client";

import React, { createContext, useContext, useState } from "react";
import {
  UserProfile,
  SPGProject,
  TicketItem,
  ClubEvent,
  ArticleItem,
  IdeaItem,
  LeaderboardEntry,
  INITIAL_USER,
  INITIAL_SPGS,
  INITIAL_TICKETS,
  INITIAL_EVENTS,
  INITIAL_ARTICLES,
  INITIAL_IDEAS,
  INITIAL_LEADERBOARD
} from "./clubData";

// Pages consume the store and its types from one place, so surface the types the
// store already builds on. `export type` keeps these erased at build time, which
// isolatedModules requires.
export type {
  TrackType,
  HealthStatus,
  TicketStatus,
  PriorityType,
  DifficultyLevel,
  UserProfile,
  SPGMember,
  ResourceRequest,
  MilestoneReport,
  SPGProject,
  TicketItem,
  ClubEvent,
  ArticleItem,
  IdeaItem,
  LeaderboardEntry,
} from "./clubData";

interface ClubContextType {
  user: UserProfile;
  spgs: SPGProject[];
  tickets: TicketItem[];
  events: ClubEvent[];
  articles: ArticleItem[];
  ideas: IdeaItem[];
  leaderboard: LeaderboardEntry[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  updateUser: (updated: Partial<UserProfile>) => void;
  addSPG: (spg: Omit<SPGProject, "reports" | "timeline">) => void;
  submitWeeklyReport: (spgId: string, report: {
    summary: string;
    milestones: string[];
    blockers: string;
    nextSteps: string;
  }) => void;
  addTicket: (ticket: Omit<TicketItem, "id" | "createdAt" | "createdRelative">) => void;
  toggleEventRSVP: (eventId: string) => void;
  claimIdea: (ideaId: string, spgTitle: string) => void;
  addIdea: (idea: Omit<IdeaItem, "id">) => void;
  addArticle: (article: Omit<ArticleItem, "id" | "views">) => void;
}

const ClubContext = createContext<ClubContextType | null>(null);

export function ClubProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile>(INITIAL_USER);
  const [spgs, setSpgs] = useState<SPGProject[]>(INITIAL_SPGS);
  const [tickets, setTickets] = useState<TicketItem[]>(INITIAL_TICKETS);
  const [events, setEvents] = useState<ClubEvent[]>(INITIAL_EVENTS);
  const [articles, setArticles] = useState<ArticleItem[]>(INITIAL_ARTICLES);
  const [ideas, setIdeas] = useState<IdeaItem[]>(INITIAL_IDEAS);
  const [leaderboard] = useState<LeaderboardEntry[]>(INITIAL_LEADERBOARD);
  const [searchQuery, setSearchQuery] = useState("");

  const updateUser = (updated: Partial<UserProfile>) => {
    setUser((prev) => ({ ...prev, ...updated }));
  };

  const addSPG = (newSpg: Omit<SPGProject, "reports" | "timeline">) => {
    const fullSpg: SPGProject = {
      ...newSpg,
      timeline: [
        { title: "Project Registered", date: "TODAY", completed: true },
        { title: "Milestone 1 Benchmark", date: "IN 3 WEEKS", completed: false }
      ],
      reports: []
    };
    setSpgs((prev) => [fullSpg, ...prev]);
    // Also reward 10 points
    setUser((u) => ({ ...u, points: u.points + 10, reputation: u.reputation + 25 }));
  };

  const submitWeeklyReport = (spgId: string, reportData: {
    summary: string;
    milestones: string[];
    blockers: string;
    nextSteps: string;
  }) => {
    setSpgs((prev) =>
      prev.map((spg) => {
        if (spg.id !== spgId) return spg;
        const newReport = {
          id: `rep-${Date.now()}`,
          period: "Current Week",
          submittedAt: "Just now",
          summary: reportData.summary,
          milestones: reportData.milestones,
          blockers: reportData.blockers,
          nextSteps: reportData.nextSteps,
          approved: true
        };
        return {
          ...spg,
          health: "on_track",
          progress: Math.min(100, spg.progress + 15),
          lastActivity: "Just now",
          latestReport: {
            period: "Current Week",
            milestones: reportData.milestones,
            blockers: reportData.blockers,
            nextSteps: reportData.nextSteps
          },
          reports: [newReport, ...spg.reports]
        };
      })
    );

    // Update user profile verified submissions and points
    const submissionId = `sub-${Date.now()}`;
    const spg = spgs.find((s) => s.id === spgId);
    const subTitle = `${spg?.title || "SPG Project"} – Weekly Report`;
    setUser((prev) => ({
      ...prev,
      points: prev.points + 20,
      reputation: prev.reputation + 40,
      verifiedSubmissions: [
        { id: submissionId, title: subTitle, timestamp: "Just now", spgId },
        ...prev.verifiedSubmissions
      ]
    }));
  };

  const addTicket = (ticketData: Omit<TicketItem, "id" | "createdAt" | "createdRelative">) => {
    const num = Math.floor(1000 + Math.random() * 9000);
    const newTicket: TicketItem = {
      ...ticketData,
      id: `#TK-${num}`,
      createdAt: new Date().toISOString(),
      createdRelative: "Just now"
    };
    setTickets((prev) => [newTicket, ...prev]);
  };

  const toggleEventRSVP = (eventId: string) => {
    setEvents((prev) =>
      prev.map((ev) => {
        if (ev.id !== eventId) return ev;
        const nextStatus = !ev.userRsvp;
        return {
          ...ev,
          userRsvp: nextStatus,
          rsvpCount: nextStatus ? ev.rsvpCount + 1 : ev.rsvpCount - 1
        };
      })
    );
  };

  const claimIdea = (ideaId: string, spgTitle: string) => {
    setIdeas((prev) =>
      prev.map((idea) => {
        if (idea.id !== ideaId) return idea;
        return { ...idea, claimedBySPG: spgTitle };
      })
    );
  };

  const addIdea = (ideaData: Omit<IdeaItem, "id">) => {
    const newIdea: IdeaItem = {
      ...ideaData,
      id: `idea-${Date.now()}`
    };
    setIdeas((prev) => [newIdea, ...prev]);
  };

  const addArticle = (articleData: Omit<ArticleItem, "id" | "views">) => {
    const newArt: ArticleItem = {
      ...articleData,
      id: `art-${Date.now()}`,
      views: "1 view"
    };
    setArticles((prev) => [newArt, ...prev]);
  };

  return (
    <ClubContext.Provider
      value={{
        user,
        spgs,
        tickets,
        events,
        articles,
        ideas,
        leaderboard,
        searchQuery,
        setSearchQuery,
        updateUser,
        addSPG,
        submitWeeklyReport,
        addTicket,
        toggleEventRSVP,
        claimIdea,
        addIdea,
        addArticle
      }}
    >
      {children}
    </ClubContext.Provider>
  );
}

export function useClub() {
  const context = useContext(ClubContext);
  if (!context) {
    throw new Error("useClub must be used within a ClubProvider");
  }
  return context;
}
