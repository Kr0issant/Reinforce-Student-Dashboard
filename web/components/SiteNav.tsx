"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Pill from "./Pill";
import styles from "./SiteNav.module.css";

const LINKS = [
  { href: "/tracks", label: "Tracks" },
  { href: "/writing", label: "Writing" },
  { href: "/projects", label: "Projects" },
  { href: "/events", label: "Events" },
];

export default function SiteNav() {
  const [condensed, setCondensed] = useState(false);

  useEffect(() => {
    // passive: this listener must never block scrolling.
    const onScroll = () => setCondensed(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`${styles.bar} ${condensed ? styles.condensed : ""}`}>
      <nav className={`page ${styles.inner}`} aria-label="Primary">
        <Link href="/" className={styles.brand}>
          Rein<em>force</em>
        </Link>

        <ul className={styles.links}>
          {LINKS.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className={styles.link}>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className={styles.actions}>
          <Pill href="/auth" variant="filled">Sign in</Pill>
        </div>
      </nav>
    </header>
  );
}
