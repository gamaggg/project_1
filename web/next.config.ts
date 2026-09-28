import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // Which deploy a page was built from, inlined into both the client and
    // /api/version — an open page that differs from the live one reloads
    // itself (lib/appUpdate.ts). Vercel sets the commit; locally it's 'dev'.
    APP_VERSION: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev",
  },
};

export default nextConfig;
