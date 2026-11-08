'use client'

import dynamic from 'next/dynamic'

// Fetched only when the clan update is switched on in this browser; a normal player never loads it.
export const Clan2LiveLazy = dynamic(() => import('@/components/clan2/live/Clan2Live').then((m) => m.Clan2Live), { ssr: false })
export const Clan2SectorHqRibbonLazy = dynamic(() => import('@/components/clan2/live/SectorHq').then((m) => m.Clan2SectorHqRibbon), { ssr: false })
export const Clan2SectorHqCardLazy = dynamic(() => import('@/components/clan2/live/SectorHq').then((m) => m.Clan2SectorHqCard), { ssr: false })
export const Clan2SoloHintLazy = dynamic(() => import('@/components/clan2/live/SoloHint').then((m) => m.Clan2SoloHint), { ssr: false })
export const EconomyAdminLazy = dynamic(() => import('@/components/clan2/live/EconomyAdmin').then((m) => m.EconomyAdmin), { ssr: false })
