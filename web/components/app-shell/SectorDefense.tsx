'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
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

// The right-hand half of the sector screen's legend card (see
// SectorLegendRow's aside): how strong the defense is and, in a few words,
// what it means for whoever is looking — the holder (and their clan) keep it
// up by fishing here; anyone else sees how many catches it would take.
// Tapping it opens the rules (DefenseSheet). Nothing for a free sector.
export function SectorDefenseAside({ territory, myClanId }: { territory: Territory; myClanId: number | null }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  if (!territory.ownerId) return null
  const value = territory.defense
  const holds = territory.status === 'mine' || territory.coHolders.some((h) => h.isMe)
  const clan = !holds && myClanId !== null && territory.ownerClanId === myClanId
  const text = holds
    ? t('defense.shortHolder')
    : clan
      ? t('defense.shortClan')
      : value > 0
        ? t('defense.shortLeft', { count: value + 1 })
        : t('defense.shortOpen')
  return (
    <>
      <button className={`standing-col standing-col-defense tap-scale${value === 0 ? ' empty' : ''}`} onClick={() => setOpen(true)}>
        <span className="standing-head">{t('defense.head')}</span>
        <span className="standing-main">
          <DefenseShields value={value} size={20} />
          <b>{t('defense.value', { value })}</b>
        </span>
        <span className="standing-hint">{text}</span>
      </button>
      {open && <DefenseSheet value={value} status={text} onClose={() => setOpen(false)} />}
    </>
  )
}

const RULES = ['reinforce', 'attack', 'capture', 'decay', 'shield', 'coins'] as const

// The rules, same sheet as the Казна's explanation: this sector's defense
// now and what it means for the viewer on top, then how it all works.
function DefenseSheet({ value, status, onClose }: { value: number; status: string; onClose: () => void }) {
  const { t } = useI18n()
  return createPortal(
    <div className="move-sheet-overlay" onClick={onClose}>
      <div className="move-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t('defense.sheetTitle')}>
        <div className="move-sheet-handle" />
        <div className="move-head">
          <div>
            <div className="move-kicker">{t('defense.sheetKicker')}</div>
            <div className="move-title">{t('defense.sheetTitle')}</div>
          </div>
        </div>
        <div className="move-body">
          <div className={`defense-sheet-now${value === 0 ? ' empty' : ''}`}>
            <DefenseShields value={value} size={30} />
            <div>
              <b>{t('defense.value', { value })}</b>
              <span>{status}</span>
            </div>
          </div>
          <ul className="defense-sheet-rules">
            {RULES.map((r) => (
              <li key={r}>{t(`defense.rules.${r}`)}</li>
            ))}
          </ul>
          <button className="btn-primary" style={{ margin: '16px 0 18px' }} onClick={onClose}>
            {t('defense.ok')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
