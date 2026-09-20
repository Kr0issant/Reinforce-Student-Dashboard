/**
 * Client for the Reinforce API.
 *
 * Every call is authenticated with the caller's Firebase ID token. The browser
 * never talks to Firestore directly — the Admin SDK is server-side only.
 */

const BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api/v1";

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    let detail = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {
      // Non-JSON error body. Keep the status-based message.
    }
    throw new ApiError(detail, res.status);
  }

  return res.json() as Promise<T>;
}

/* ------------------------------------------------------------------ types */
/* These mirror server/app/schemas/. See docs/DATA_CONTRACT.md. */

export type SocialLinks = {
  github?: string | null;
  kaggle?: string | null;
  discord?: string | null;
  linkedin?: string | null;
};

export type StudentProfile = {
  email: string;
  full_name: string;
  avatar_url?: string | null;
  discord_id?: string | null;
  is_verified: boolean;
  verified_at?: string | null;
  skills: string[];
  social_links: SocialLinks;
};

export type TicketCategory =
  | "spg_registration"
  | "resource_request"
  | "support"
  | "idea_jar"
  | "misc";

export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

export type TicketAuthor = {
  discord_id?: string | null;
  username: string;
  avatar_url?: string | null;
};

export type TicketSummary = {
  id: string;
  category: TicketCategory;
  title: string;
  status: TicketStatus;
  created_by?: TicketAuthor | null;
  assigned_to?: TicketAuthor | null;
  created_at?: string | null;
  updated_at?: string | null;
  thread_url?: string | null;
};

export type TicketListResponse = {
  /** False when the member has not linked Discord — an empty list by definition, not by accident. */
  linked: boolean;
  tickets: TicketSummary[];
};

/* --------------------------------------------------------------- requests */

export const api = {
  syncUser: (token: string) =>
    request<{ success: boolean; user: StudentProfile }>("/auth/sync-user", token, {
      method: "POST",
    }),

  me: (token: string) =>
    request<{ success: boolean; user: StudentProfile }>("/auth/me", token),

  verifyDiscord: (token: string, discordId: string) =>
    request<{ success: boolean; role_granted?: string; user: StudentProfile }>(
      "/auth/verify-discord",
      token,
      { method: "POST", body: JSON.stringify({ discord_id: discordId }) },
    ),

  myTickets: (token: string) => request<TicketListResponse>("/tickets", token),
};

/* ---------------------------------------------------------------- display */

export const CATEGORY_LABEL: Record<TicketCategory, string> = {
  spg_registration: "Project group",
  resource_request: "Resource request",
  support: "Support",
  idea_jar: "Idea Jar",
  misc: "General",
};

export const STATUS_LABEL: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
};
