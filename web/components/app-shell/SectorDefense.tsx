'use client'

import { useI18n } from '@/lib/i18n'
import type { Territory } from '@/lib/data/types'

const SHIELD = 'M12 2.5l7.5 2.8v5.6c0 4.7-3.2 8.3-7.5 10.6-4.3-2.3-7.5-5.9-7.5-10.6V5.3z'

// «Защита сектора»: three shields, as many filled as the sector's defense
// right now (0–3). Same teal as the «Под щитом» badge — both mean "this
// sector is protected", just two different ways.
export function DefenseShields({ value, size = 14 }: { value: number; size?: number }) {
  const { t } = useI18n()
  return (
    <span className="defense-shields" role="img" aria-label={t('defense.label', { value })}>
      {[0, 1, 2].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" className={i < value ? 'on' : ''} aria-hidden>
          <path d={SHIELD} />
        </svg>
      ))}
    </span>
  )
}

// The sector screen's line about it: how strong, and what that means for
// whoever is looking — the holder (and their clan) keep it up by fishing
// here; anyone else sees how many catches it would take.
export function SectorDefenseRow({ territory, myClanId }: { territory: Territory; myClanId: number | null }) {
  const { t } = useI18n()
  if (!territory.ownerId) return null
  const value = territory.defense
  const holds = territory.status === 'mine' || territory.coHolders.some((h) => h.isMe)
  const clan = !holds && myClanId !== null && territory.ownerClanId === myClanId
  const text = holds
    ? t('defense.holder')
    : clan
      ? t('defense.clan')
      : value > 0
        ? t('defense.attackLeft', { count: value + 1 })
        : t('defense.open')
  return (
    <div className={`sector-defense${value === 0 ? ' open' : ''}`}>
      <DefenseShields value={value} size={18} />
      <div className="sector-defense-text">
        <b>{t('defense.title', { value })}</b>
        <span>{text}</span>
      </div>
    </div>
  )
}
