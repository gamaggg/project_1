'use client'

import type { CSSProperties, ReactNode } from 'react'
import { ClanCrest } from '@/components/app-shell/ClanCrest'
import { HeroBgLive } from '@/components/app-shell/HeroBgLive'
import { isLightClanBackground, resolveClanBackground } from '@/lib/data/clanBackgrounds'

// The clan's banner: its chosen background, the big crest (with the shine)
// and name/motto. Shared by the clan screen and the constructor's live
// preview so both always look identical.
export function ClanHero({
  crest,
  name,
  motto,
  background,
  golden,
  compact,
  children,
  top,
  hideName,
}: {
  crest: unknown
  name: string
  motto: string | null
  background: string
  golden?: boolean
  compact?: boolean
  children?: ReactNode
  top?: ReactNode
  hideName?: boolean
}) {
  const bg = resolveClanBackground(background)
  return (
    <div
      className={`clan-hero${compact ? ' clan-hero-compact' : ''}${isLightClanBackground(bg) ? ' clan-hero-light' : ''}`}
      style={{ background: bg.animated ? bg.base : bg.css, '--clan-accent-rgb': bg.accentRgb, '--hero-text-rgb': bg.textRgb ?? '255,255,255' } as CSSProperties}
    >
      <HeroBgLive bg={bg} variant={compact ? 'preview' : 'hero'} />
      {top}
      <div className="clan-hero-body">
        <div className="clan-hero-crest">
          <ClanCrest crest={crest} size={compact ? 84 : 104} shine golden={golden} title={name} />
        </div>
        {!hideName && <div className="clan-hero-name">{name || 'Название клана'}</div>}
        {motto ? <div className="clan-hero-motto">«{motto}»</div> : null}
        {children}
      </div>
    </div>
  )
}
