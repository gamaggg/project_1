'use client'

import dynamic from 'next/dynamic'

// Leaflet touches `window` at import time — must never run during SSR/build.
// Same pattern as MapView.tsx.
export const GlobeView = dynamic(() => import('./LeafletGlobe').then((m) => m.LeafletGlobe), {
  ssr: false,
})
