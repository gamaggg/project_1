// Single source of truth for the production domain — layout.tsx (og/twitter/
// canonical URLs), robots.ts, and sitemap.ts all need this in sync, and
// having it hardcoded in three places is exactly how it went stale last time
// (see git history: pointed at the old web-flame-mu-44.vercel.app for a
// while after catchrange.com went live).
export const SITE_URL = 'https://catchrange.com'

// The link preview picture (app/opengraph-image.jpg, 1200×630). Pages that set
// their own openGraph/twitter lose the file's automatic tags, so they name it.
export const OG_IMAGE = {
  url: `${SITE_URL}/opengraph-image.jpg`,
  width: 1200,
  height: 630,
  alt: 'RANGE — твои уловы меняют карту',
}
