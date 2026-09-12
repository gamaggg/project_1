import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

// Just the one real route — this is a single-page app-shell (see
// DECISIONS.md: every screen is a client-side view, not a Next.js route).
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
  ]
}
