'use client'

import dynamic from 'next/dynamic'

// Leaflet touches `window` at import time — must never run during SSR/build.
export const TerritoryThumbnailMapView = dynamic(() => import('./TerritoryThumbnailMap').then((m) => m.TerritoryThumbnailMap), {
  ssr: false,
})
