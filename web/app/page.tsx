import Eyebrow from "@/components/Eyebrow";
import MetricCard from "@/components/MetricCard";
import Pill from "@/components/Pill";
import Reveal from "@/components/Reveal";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import styles from "./page.module.css";

/**
 * Landing page — "Ledger": a dark hero that opens into paper, sections
 * announced by numbered mono eyebrows, and the club's claims set as serif
 * figures.
 *
 * Every figure below is either definitionally true (three tracks, all repos
 * public) or a rhetorical zero. None of them is an invented count. If you add
 * a card here, it must be countable from Firestore or GitHub — otherwise cut
 * it rather than estimate it. See AGENTS.md.
 */

const TRACKS = [
  {
    index: "01",
    name: "Competitive AI",
    kicker: "Kaggle",
    body:
      "Real competitions with real leaderboards and real deadlines. You learn by being scored against thousands of other people, every day, on a problem nobody has solved for you.",
  },
  {
    index: "02",
    name: "Product",
    kicker: "Build and ship",
    body:
      "Take something from an idea to deployed. Users, bugs, feedback — the parts of engineering that only show up once real people touch your work.",
  },
  {
    index: "03",
    name: "Research",
    kicker: "Read, reproduce, extend",
    body:
      "Pick a paper. Reproduce it. Find where it breaks. Write up what you learned. The skill that separates using a model from understanding one.",
  },
];

export default function Home() {
  return (
    <>
      <SiteNav />

      <main>
        {/* ---------------------------------------------------- hero (dark) */}
        <section className={`section-dark grid-bg ${styles.hero}`}>
          <div className={`page ${styles.heroInner}`}>
            <p className={`mono ${styles.heroKick} rise`} style={{ "--delay": "0ms" } as React.CSSProperties}>
              For students who would rather <span className={styles.kickAccent}>build</span> than watch
            </p>

            <h1 className={`display ${styles.heroTitle} rise`} style={{ "--delay": "60ms" } as React.CSSProperties}>
              We learn in public,
              <br />
              and we <em>write it down.</em>
            </h1>

            <p className={`${styles.heroBody} rise`} style={{ "--delay": "120ms" } as React.CSSProperties}>
              Reinforce is the AI/ML club at Scaler School of Technology. Competitions, papers and
              products — plus the notes from everything that didn&rsquo;t work, which is usually the
              more useful half.
            </p>

            <div className={`${styles.heroCtas} rise`} style={{ "--delay": "180ms" } as React.CSSProperties}>
              <Pill href="/auth" variant="filled">Join the club</Pill>
              <Pill href="/projects">See what we&rsquo;ve built</Pill>
            </div>
          </div>
        </section>

        {/* ------------------------------------------- what you get (paper) */}
        <section className={`section-paper on-light ${styles.paper}`}>
          <div className="page">
            <Reveal>
              <Eyebrow index="01">What a year here looks like</Eyebrow>
              <h2 className={styles.paperTitle}>
                Not a syllabus. <span className={styles.paperAccent}>A track record.</span>
              </h2>
              <p className={styles.paperSub}>
                What members actually accumulate, rather than what a brochure promises.
              </p>
            </Reveal>

            <Reveal delay={80}>
              <div className={styles.metrics}>
                <MetricCard label="Tracks" tag="Pick one" value="3" unit="lanes">
                  Competitive AI, Product and Research. You are not locked in, and you can be in
                  more than one.
                </MetricCard>
                <MetricCard label="Entry bar" tag="Any year" value="0" unit="prereqs">
                  No prior experience, no portfolio, no interview. Nobody here began knowing this
                  stuff.
                </MetricCard>
                <MetricCard label="Source" tag="Public" value="100" unit="% open">
                  Every repository the club owns is public. Your contributions are visible to
                  anyone who looks.
                </MetricCard>
                <MetricCard label="Identity" tag="One login" value="1" unit="account">
                  Your SST email, your Discord and your project record, linked once and shared
                  across both.
                </MetricCard>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ------------------------------------------------- rhetoric strip */}
        <section className={`section-paper-2 on-light ${styles.strike}`}>
          <div className="page">
            <Reveal>
              <p className={styles.strikeLine}>
                <del>You need a background.</del> <strong>You need a terminal.</strong>
              </p>
            </Reveal>
          </div>
        </section>

        {/* ---------------------------------------------------- tracks (dark) */}
        <section className={`section-dark ${styles.tracks}`}>
          <div className="page">
            <Reveal>
              <Eyebrow index="02">Three ways in</Eyebrow>
              <h2 className={`display ${styles.tracksTitle}`}>
                Pick the one that sounds <em>hardest.</em>
              </h2>
            </Reveal>

            <ul className={styles.trackList}>
              {TRACKS.map((track, i) => (
                <Reveal as="li" key={track.index} delay={i * 80} className={styles.trackItem}>
                  <p className={`mono ${styles.trackIndex}`}>
                    {track.index} — {track.kicker}
                  </p>
                  <h3 className={`display ${styles.trackName}`}>{track.name}</h3>
                  <p className={styles.trackBody}>{track.body}</p>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>

        {/* -------------------------------------------------- how it works */}
        <section className={`section-paper on-light ${styles.paper}`}>
          <div className="page">
            <Reveal>
              <Eyebrow index="03">How the club actually runs</Eyebrow>
              <h2 className={styles.paperTitle}>
                File it in Discord. <span className={styles.paperAccent}>See it on the web.</span>
              </h2>
              <p className={styles.paperSub}>
                Project groups, resource requests and ideas are filed through the club&rsquo;s Discord
                bot. This site reads the same records — one source of truth, two front doors.
              </p>
            </Reveal>

            <Reveal delay={80}>
              <ol className={styles.steps}>
                <li className={styles.step}>
                  <span className={`mono ${styles.stepNum}`}>01</span>
                  <div>
                    <h3 className={styles.stepTitle}>Verify with your SST email</h3>
                    <p className={styles.stepBody}>
                      Sign in with your @sst.scaler.com Google account. That links your Discord
                      identity to your club record, once.
                    </p>
                  </div>
                </li>
                <li className={styles.step}>
                  <span className={`mono ${styles.stepNum}`}>02</span>
                  <div>
                    <h3 className={styles.stepTitle}>Register a project group</h3>
                    <p className={styles.stepBody}>
                      An SPG is a small team around one concrete goal. Registering gets you a
                      working space and the right to request club resources.
                    </p>
                  </div>
                </li>
                <li className={styles.step}>
                  <span className={`mono ${styles.stepNum}`}>03</span>
                  <div>
                    <h3 className={styles.stepTitle}>Ship something small</h3>
                    <p className={styles.stepBody}>
                      A fixed typo in one of the club repositories is a real contribution and a real
                      commit under your name. The first one is the hard one.
                    </p>
                  </div>
                </li>
              </ol>
            </Reveal>
          </div>
        </section>

        {/* ------------------------------------------------------- cta (dark) */}
        <section className={`section-dark grid-bg ${styles.cta}`}>
          <div className={`page ${styles.ctaInner}`}>
            <Reveal>
              <h2 className={`display ${styles.ctaTitle}`}>
                You do not need permission,
                <br />
                a background, or <em>a plan.</em>
              </h2>
              <div className={styles.ctaRow}>
                <Pill href="/auth" variant="filled">Verify with your SST email</Pill>
                <Pill
                  href="https://github.com/Reinforce-SST"
                  external
                >
                  Browse the code
                </Pill>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
