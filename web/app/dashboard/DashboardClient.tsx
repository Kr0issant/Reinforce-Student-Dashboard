"use client";

import { useEffect, useState } from "react";
import Pill from "@/components/Pill";
import SiteFooter from "@/components/SiteFooter";
import {
  api,
  CATEGORY_LABEL,
  STATUS_LABEL,
  type TicketListResponse,
  type TicketSummary,
} from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import styles from "./dashboard.module.css";

function relative(iso?: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export default function DashboardClient() {
  const { user, token, loading, configured, degraded, signOut } = useAuth();
  const [data, setData] = useState<TicketListResponse | null>(null);
  const [error, setError] = useState<string>("");
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    (async () => {
      setFetching(true);
      try {
        const res = await api.myTickets(token);
        if (!cancelled) setData(res);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load your activity.");
        }
      } finally {
        if (!cancelled) setFetching(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!configured) {
    return (
      <main className={styles.centre}>
        <p className={styles.note}>
          This deployment has no Firebase configuration, so sign-in is unavailable.
        </p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className={styles.centre} aria-busy="true">
        <p className={styles.note}>Checking your session…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className={styles.centre}>
        <h1 className={`display ${styles.gateTitle}`}>
          Sign in to see <em>your record.</em>
        </h1>
        <p className={styles.note}>
          {degraded
            ? "We couldn't reach the sign-in service. Check your connection and try again."
            : "Members only. Use your @sst.scaler.com account."}
        </p>
        <Pill href="/auth" variant="filled">Sign in</Pill>
      </main>
    );
  }

  const tickets = data?.tickets ?? [];
  const spgs = tickets.filter((t) => t.category === "spg_registration");
  const active = tickets.filter((t) => t.status === "open" || t.status === "in_progress");
  const ideas = tickets.filter((t) => t.category === "idea_jar");

  return (
    <>
      <main>
        {/* --------------------------------------------------- header (dark) */}
        <section className={`section-dark grid-bg ${styles.head}`}>
          <div className={`page ${styles.headInner}`}>
            <div>
              <p className={`mono ${styles.kick}`}>
                Verified · {user.email}
              </p>
              <h1 className={`display ${styles.title}`}>
                Welcome back,
                <br />
                <em>{user.displayName?.split(" ")[0] ?? "member"}.</em>
              </h1>
            </div>
            <div className={styles.headActions}>
              <Pill href="/">Back to the site</Pill>
              <Pill onClick={signOut}>Sign out</Pill>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------- figures (paper) */}
        <section className={`section-paper on-light ${styles.figuresWrap}`}>
          <div className="page">
            {error ? (
              <p className={styles.error} role="alert">{error}</p>
            ) : null}

            {data && !data.linked ? (
              <div className={styles.linkPrompt}>
                <div>
                  <h2 className={styles.promptTitle}>Your Discord isn&rsquo;t linked yet</h2>
                  <p className={styles.promptBody}>
                    Project groups, resource requests and ideas are filed in Discord. Run{" "}
                    <code>/auth</code> in the club server and follow the link it sends you — this
                    page will fill itself in.
                  </p>
                </div>
              </div>
            ) : null}

            <dl className={styles.figures}>
              <Figure value={spgs.length} label="Project groups" busy={fetching} />
              <Figure value={active.length} label="Active items" busy={fetching} />
              <Figure value={ideas.length} label="Ideas filed" busy={fetching} />
            </dl>
          </div>
        </section>

        {/* ------------------------------------------------------ mirror (paper) */}
        <section className={`section-paper on-light ${styles.listWrap}`}>
          <div className="page">
            <div className={styles.listHead}>
              <h2 className={styles.listTitle}>From your Discord activity</h2>
              <p className={`mono ${styles.listNote}`}>Read-only mirror</p>
            </div>

            {fetching && !data ? (
              <ul className={styles.list} aria-busy="true">
                {[0, 1, 2].map((i) => (
                  <li key={i} className={`${styles.row} ${styles.skeleton}`} />
                ))}
              </ul>
            ) : tickets.length === 0 ? (
              <p className={styles.empty}>
                {data?.linked
                  ? "Nothing filed yet. Register a project group or drop an idea in the Idea Jar from the club Discord, and it will appear here."
                  : "Link your Discord account to see what you've filed."}
              </p>
            ) : (
              <ul className={styles.list}>
                {tickets.map((t) => (
                  <TicketRow key={t.id} ticket={t} />
                ))}
              </ul>
            )}

            <p className={styles.fine}>
              Discord is the only place to file these. This page reflects the same records — it
              never writes to them.
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

function Figure({ value, label, busy }: { value: number; label: string; busy: boolean }) {
  return (
    <div className={styles.figure}>
      {/* Width is reserved by the element, so nothing shifts when the number lands. */}
      <dd className={styles.figureValue} aria-busy={busy}>{busy ? "—" : value}</dd>
      <dt className={`mono ${styles.figureLabel}`}>{label}</dt>
    </div>
  );
}

function TicketRow({ ticket }: { ticket: TicketSummary }) {
  const live = ticket.status === "open" || ticket.status === "in_progress";
  const body = (
    <>
      <span className={`${styles.dot} ${live ? styles.dotLive : ""}`} aria-hidden />
      <span className={styles.rowMain}>
        <span className={styles.rowTitle}>{ticket.title}</span>
        <span className={styles.rowMeta}>
          {CATEGORY_LABEL[ticket.category] ?? ticket.category}
        </span>
      </span>
      <span className={styles.rowStatus}>{STATUS_LABEL[ticket.status] ?? ticket.status}</span>
      <span className={`mono ${styles.rowAge}`}>{relative(ticket.updated_at ?? ticket.created_at)}</span>
    </>
  );

  if (ticket.thread_url) {
    return (
      <li className={styles.row}>
        <a
          className={styles.rowLink}
          href={ticket.thread_url}
          target="_blank"
          rel="noreferrer noopener"
          title="Open the Discord thread"
        >
          {body}
        </a>
      </li>
    );
  }

  return <li className={`${styles.row} ${styles.rowStatic}`}>{body}</li>;
}
