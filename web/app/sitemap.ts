import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

// The app itself is one route — a single-page app-shell (see DECISIONS.md:
// every screen is a client-side view, not a Next.js route) — plus the
// standalone pages a search engine can actually read: the landing page and
// the privacy policy, each in three languages.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    ...['/about', '/about/en', '/about/ka'].map((path) => ({
      url: `${SITE_URL}${path}`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.9,
    })),
    ...['/privacy', '/privacy/en', '/privacy/ka'].map((path) => ({
      url: `${SITE_URL}${path}`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.3,
    })),
  ]
}
