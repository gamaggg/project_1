'use client'

import dynamic from 'next/dynamic'

// Fetched only when the clan update is switched on in this browser; a normal player never loads it.
export const Clan2LiveLazy = dynamic(() => import('@/components/clan2/live/Clan2Live').then((m) => m.Clan2Live), { ssr: false })
