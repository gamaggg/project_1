// Single source of truth for the production domain — layout.tsx (og/twitter/
// canonical URLs), robots.ts, and sitemap.ts all need this in sync, and
// having it hardcoded in three places is exactly how it went stale last time
// (see git history: pointed at the old web-flame-mu-44.vercel.app for a
// while after catchrange.com went live).
export const SITE_URL = 'https://catchrange.com'
