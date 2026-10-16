import type { MetadataRoute } from 'next'

// Controls the icon/name/colors used when someone adds RANGE to their phone's
// home screen (Android "Add to Home screen", iOS uses app/apple-icon.png).
// With the service worker (public/sw.js) a browser also offers to install it
// as an app, and it opens with no network.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'RANGE',
    short_name: 'RANGE',
    description: 'Каждый улов меняет карту. Захватывай территории, собирай награды, обгоняй соперников.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FFFFFF',
    theme_color: '#FFFFFF',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
