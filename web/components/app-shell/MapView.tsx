'use client'

import dynamic from 'next/dynamic'

// Leaflet touches `window` at import time — must never run during SSR/build.
export const MapView = dynamic(() => import('./LeafletMap').then((m) => m.LeafletMap), {
  ssr: false,
})
