import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// Self-hosted by next/font at build time. No CDN request, no layout shift,
// and no dependency on Google being reachable from campus wifi.
const display = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

const sans = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  // Env-driven so this does not go stale when the site is renamed. Vercel
  // provides VERCEL_URL automatically for preview deployments.
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Reinforce — the AI/ML club at SST",
    template: "%s · Reinforce",
  },
  description:
    "Reinforce is the AI/ML club at Scaler School of Technology. Three tracks — competitions, product and research — and a public record of everything members build.",
  openGraph: {
    type: "website",
    siteName: "Reinforce",
    title: "Reinforce — the AI/ML club at SST",
    description:
      "Competitions, product and research. Everything we build is open source and carries your name on the commits.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0C0C0C",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
