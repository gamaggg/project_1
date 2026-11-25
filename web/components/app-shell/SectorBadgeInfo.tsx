'use client'

import { createPortal } from 'react-dom'
import { tn, currentLocale } from '@/lib/i18n'
import type { Territory } from '@/lib/data/types'

// What a badge in the sector screen's header means (24.11.2026): tapping «Занята», «Щит · 12 ч» or
// «🔥 Популярный» opens this small card instead of leaving players to guess.
export type SectorBadgeKind = 'status' | 'shield' | 'popular'

export function SectorBadgeInfo({
  kind,
  territory,
  myShare,
  onClose,
}: {
  kind: SectorBadgeKind
  territory: Territory
  myShare: boolean
  onClose: () => void
}) {
  let title: string
  let body: string
  if (kind === 'shield') {
    const when = territory.shieldUntil
      ? new Date(territory.shieldUntil).toLocaleString(currentLocale(), { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
      : ''
    title = tn('sector.badgeInfo.shieldTitle', { when })
    body = tn('sector.badgeInfo.shieldText')
  } else if (kind === 'popular') {
    title = tn('sector.badgeInfo.popularTitle')
    body = tn('sector.badgeInfo.popularText', { count: territory.catchCount })
  } else {
    const s = territory.status === 'mine' ? 'mine' : myShare ? 'share' : territory.status === 'other' ? 'taken' : 'free'
    title = tn(`sector.badgeInfo.${s}Title`)
    body = tn(`sector.badgeInfo.${s}Text`)
  }
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{title}</div>
        <div className="modal-body">{body}</div>
        <button className="btn-primary" onClick={onClose}>
          {tn('sector.badgeInfo.ok')}
        </button>
      </div>
    </div>,
    document.body
  )
}
