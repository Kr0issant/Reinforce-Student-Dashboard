"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Pill from "@/components/Pill";
import SiteFooter from "@/components/SiteFooter";
import { api, ApiError, type SocialLinks, type StudentProfile } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import styles from "./profile.module.css";

type LinkKey = "github" | "kaggle" | "linkedin";

const LINK_FIELDS: { key: LinkKey; label: string; placeholder: string; host: string }[] = [
  { key: "github", label: "GitHub", placeholder: "https://github.com/username", host: "github.com" },
  { key: "kaggle", label: "Kaggle", placeholder: "https://kaggle.com/username", host: "kaggle.com" },
  { key: "linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/in/username", host: "linkedin.com" },
];

const MAX_SKILLS = 30;
const MAX_SKILL_LEN = 40;

/** Empty is valid. Otherwise it must parse as a URL on the expected host. */
function linkError(value: string, host: string): string | null {
  const v = value.trim();
  if (!v) return null;
  let url: URL;
  try {
    url = new URL(v.startsWith("http") ? v : `https://${v}`);
  } catch {
    return "That doesn't look like a link.";
  }
  const h = url.hostname.replace(/^www\./, "");
  if (h !== host && !h.endsWith(`.${host}`)) return `Should be a ${host} link.`;
  return null;
}

export default function ProfileClient() {
  const { user, token, loading, configured, degraded, signOut } = useAuth();

  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [skills, setSkills] = useState<string[]>([]);
  const [links, setLinks] = useState<Record<LinkKey, string>>({ github: "", kaggle: "", linkedin: "" });
  const [skillDraft, setSkillDraft] = useState("");

  const [loadError, setLoadError] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState("");
  const [unlinking, setUnlinking] = useState(false);

  const loadedFor = useRef<string | null>(null);

  // Load once per token. `phase`-style state is deliberately not a dependency
  // here — see the note in AuthClient about effects that re-trigger themselves.
  useEffect(() => {
    if (!token || loadedFor.current === token) return;
    loadedFor.current = token;

    let cancelled = false;
    (async () => {
      try {
        const res = await api.me(token);
        if (cancelled) return;
        applyProfile(res.user);
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Could not load your profile.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  function applyProfile(u: StudentProfile) {
    setProfile(u);
    setSkills(u.skills ?? []);
    setLinks({
      github: u.social_links?.github ?? "",
      kaggle: u.social_links?.kaggle ?? "",
      linkedin: u.social_links?.linkedin ?? "",
    });
  }

  const addSkill = useCallback(() => {
    const value = skillDraft.trim().slice(0, MAX_SKILL_LEN);
    if (!value) return;
    setSkills((prev) => {
      // Case-insensitive dedupe, so "PyTorch" and "pytorch" don't both appear.
      if (prev.some((s) => s.toLowerCase() === value.toLowerCase())) return prev;
      if (prev.length >= MAX_SKILLS) return prev;
      return [...prev, value];
    });
    setSkillDraft("");
    setSaveState("idle");
  }, [skillDraft]);

  const errors = LINK_FIELDS.map((f) => linkError(links[f.key], f.host));
  const hasErrors = errors.some(Boolean);

  async function save() {
    if (!token || hasErrors) return;
    setSaveState("saving");
    setSaveError("");
    try {
      // social_links is replaced wholesale by the API, so discord has to be
      // carried through explicitly or saving here would wipe it.
      const social_links: SocialLinks = {
        github: links.github.trim() || null,
        kaggle: links.kaggle.trim() || null,
        linkedin: links.linkedin.trim() || null,
        discord: profile?.social_links?.discord ?? null,
      };
      const res = await api.updateProfile(token, { skills, social_links });
      applyProfile(res.user);
      setSaveState("saved");
    } catch (err) {
      setSaveState("error");
      setSaveError(
        err instanceof ApiError ? err.message : "Could not save. Try again in a moment.",
      );
    }
  }

  async function unlink() {
    if (!token) return;
    setUnlinking(true);
    try {
      const res = await api.unlinkDiscord(token);
      applyProfile(res.user);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Could not unlink.");
    } finally {
      setUnlinking(false);
    }
  }

  /* ------------------------------------------------------------- gates */

  if (!configured) {
    return (
      <main className={styles.centre}>
        <p className={styles.note}>Sign-in isn&rsquo;t configured on this deployment.</p>
      </main>
    );
  }
  if (loading) {
    return (
      <main className={styles.centre} aria-busy="true">
        <p className={styles.note}>Checking your session&hellip;</p>
      </main>
    );
  }
  if (!user) {
    return (
      <main className={styles.centre}>
        <h1 className={`display ${styles.gateTitle}`}>
          Sign in to edit <em>your profile.</em>
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

  return (
    <>
      <main>
        <section className={`section-dark grid-bg ${styles.head}`}>
          <div className={`page ${styles.headInner}`}>
            <div>
              <p className={`mono ${styles.kick}`}>{user.email}</p>
              <h1 className={`display ${styles.title}`}>
                Your <em>profile.</em>
              </h1>
            </div>
            <div className={styles.headActions}>
              <Pill href="/dashboard">Dashboard</Pill>
              <Pill onClick={signOut}>Sign out</Pill>
            </div>
          </div>
        </section>

        <section className={`section-paper on-light ${styles.body}`}>
          <div className="page">
            {loadError ? <p className={styles.error} role="alert">{loadError}</p> : null}

            {/* ---------------------------------------------------- skills */}
            <div className={styles.block}>
              <div className={styles.blockHead}>
                <h2 className={styles.blockTitle}>Skills</h2>
                <p className={`mono ${styles.count}`}>{skills.length}/{MAX_SKILLS}</p>
              </div>
              <p className={styles.help}>
                What you work with. These show on your club record.
              </p>

              <div className={styles.tagRow}>
                {skills.map((skill) => (
                  <span key={skill} className={styles.tag}>
                    {skill}
                    <button
                      type="button"
                      className={styles.tagX}
                      aria-label={`Remove ${skill}`}
                      onClick={() => {
                        setSkills((prev) => prev.filter((s) => s !== skill));
                        setSaveState("idle");
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
                {skills.length === 0 ? (
                  <span className={styles.empty}>Nothing added yet.</span>
                ) : null}
              </div>

              <div className={styles.addRow}>
                <input
                  className={styles.input}
                  value={skillDraft}
                  maxLength={MAX_SKILL_LEN}
                  placeholder="Add a skill — PyTorch, Docker, Next.js"
                  onChange={(e) => setSkillDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSkill();
                    }
                  }}
                />
                <Pill onClick={addSkill} disabled={!skillDraft.trim() || skills.length >= MAX_SKILLS}>
                  Add
                </Pill>
              </div>
            </div>

            {/* ----------------------------------------------------- links */}
            <div className={styles.block}>
              <h2 className={styles.blockTitle}>Links</h2>
              <p className={styles.help}>Optional. Leave blank to remove one.</p>

              <div className={styles.fields}>
                {LINK_FIELDS.map((field, i) => (
                  <label key={field.key} className={styles.field}>
                    <span className={`mono ${styles.fieldLabel}`}>{field.label}</span>
                    <input
                      className={`${styles.input} ${errors[i] ? styles.inputBad : ""}`}
                      value={links[field.key]}
                      placeholder={field.placeholder}
                      inputMode="url"
                      onChange={(e) => {
                        setLinks((prev) => ({ ...prev, [field.key]: e.target.value }));
                        setSaveState("idle");
                      }}
                    />
                    {errors[i] ? <span className={styles.fieldErr}>{errors[i]}</span> : null}
                  </label>
                ))}
              </div>
            </div>

            {/* --------------------------------------------------- discord */}
            <div className={styles.block}>
              <h2 className={styles.blockTitle}>Discord</h2>
              {profile?.discord_id ? (
                <>
                  <p className={styles.help}>
                    Linked as <code>{profile.discord_id}</code>. This is how your project groups
                    and tickets reach your dashboard.
                  </p>
                  <Pill onClick={unlink} disabled={unlinking}>
                    {unlinking ? "Unlinking…" : "Unlink Discord"}
                  </Pill>
                </>
              ) : (
                <>
                  <p className={styles.help}>
                    Not linked. Run <code>/auth</code> in the club Discord and follow the link it
                    sends you.
                  </p>
                  <Pill href="/auth">Link Discord</Pill>
                </>
              )}
            </div>

            {/* ------------------------------------------------------- save */}
            <div className={styles.saveBar}>
              <Pill variant="filled" onClick={save} disabled={saveState === "saving" || hasErrors}>
                {saveState === "saving" ? "Saving…" : "Save changes"}
              </Pill>
              {saveState === "saved" ? <span className={styles.ok}>Saved.</span> : null}
              {hasErrors ? <span className={styles.warnText}>Fix the links above first.</span> : null}
              {saveState === "error" ? <span className={styles.errText}>{saveError}</span> : null}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
