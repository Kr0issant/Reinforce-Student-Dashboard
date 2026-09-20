import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next generates its own AGENTS.md/CLAUDE.md here. The repository already
  // has a curated AGENTS.md at the root; a second, generated one in web/
  // would shadow it for anyone working in this directory.
  agentRules: false,

  async rewrites() {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "reinforce-sst-bfda8";
    return [
      {
        source: "/__/auth/:path*",
        destination: `https://${projectId}.firebaseapp.com/__/auth/:path*`,
      },
    ];
  },
};

export default nextConfig;
