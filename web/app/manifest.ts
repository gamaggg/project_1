import type { MetadataRoute } from 'next'

// Controls the icon/name/colors used when someone adds RANGE to their phone's
// home screen (Android "Add to Home screen", iOS uses app/apple-icon.png).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'RANGE — рыболовные территории',
    short_name: 'RANGE',
    description: 'Каждый улов меняет карту. Захватывай территории, собирай награды, обгоняй соперников.',
    start_url: '/',
    display: 'standalone',
    background_color: '#FFFFFF',
    theme_color: '#FFFFFF',
    icons: [{ src: '/icon-512.png', sizes: '512x512', type: 'image/png' }],
  }
}
