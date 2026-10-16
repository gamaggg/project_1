import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A second build folder for trying a production build next to `next dev`
  // (NEXT_DIST_DIR=.next-prod): the offline mode is only switched on in a
  // production build. Unset, it is the usual .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  env: {
    // Which deploy a page was built from, inlined into both the client and
    // /api/version — an open page that differs from the live one reloads
    // itself (lib/appUpdate.ts). Vercel sets the commit; locally it's 'dev'.
    APP_VERSION: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev",
  },
  async headers() {
    return [
      {
        // The service worker (public/sw.js) must never be served from a stale
        // cache, or a fix to it would not reach phones for days.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
