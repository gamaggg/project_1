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
  // The «Powered by Next.js» header tells a scanner which framework to try exploits for.
  poweredByHeader: false,
  // The production build answers on catchrange.com and on Vercel's own addresses
  // (web-flame-mu-44.vercel.app and one per deploy). Those were a copy of the site
  // for search engines; they now move people to catchrange.com for good (308).
  // Preview builds keep their addresses, and /api/ is left alone so a webhook or a
  // scheduled call still pointing at an old address keeps working.
  async redirects() {
    if (process.env.VERCEL_ENV !== "production") return [];
    return [
      {
        source: "/:path((?!api/).*)",
        has: [{ type: "host", value: "(?<host>.+)\\.vercel\\.app" }],
        destination: "https://catchrange.com/:path",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        // Everywhere: files are read as the type we send (an uploaded image can't be
        // run as a script), and the address of the page isn't passed on to other sites.
        // Deliberately no X-Frame-Options / frame-ancestors: Telegram Web opens the
        // Mini App inside a frame, and a ban on framing would blank it there.
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
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
