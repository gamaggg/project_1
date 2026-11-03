'use client'

import { useRef, useState } from 'react'
import { KIND_LABEL } from '@/lib/data/species'
import type { Territory } from '@/lib/data/types'
import { pluralCatches } from '@/lib/format'
import { currentLocale, tn } from '@/lib/i18n'
import { useNow } from '@/lib/useNow'
import { LaurelIcon } from '@/components/app-shell/SectorInsights'
import { hapticSelect } from '@/lib/telegram/haptics'

// «Мои сектора» / someone else's sectors on the profile: one row
// per sector (no hexagon: the owner found it clutter, 02.11.2026) — the id with
// the water as a tag, how many catches and when the last one was, and the marks
// when the sector has them: shared with clan-mates (how many hold it), under a
// shield (how long it still holds), hot this week (×2), and the viewer being
// the sector's legend (legendUserId = whose sectors these are; left out on
// someone else's profile).

export function ProfileSectorRow({ t, last, onOpen, legendUserId }: { t: Territory; last: boolean; onOpen: (id: string) => void; legendUserId?: string }) {
  const now = useNow(30_000)
  const shieldLeft = t.shieldUntil ? new Date(t.shieldUntil).getTime() - now : 0
  const hot = !!t.hotUntil && new Date(t.hotUntil).getTime() > now
  const isLegend = !!legendUserId && t.legendId === legendUserId
  const parts = [`${t.catchCount} ${pluralCatches(t.catchCount)}`]
  if (t.lastCatchAt) parts.push(lastCatchLabel(t.lastCatchAt, now))
  return (
    <button className="profile-row tap-scale" style={{ borderBottom: last ? 'none' : '1px solid var(--line)' }} onClick={() => onOpen(t.id)}>
      <span className="profile-row-text">
        <b className="has-tag">
          {t.id}
          <span className={`kind-tag kind-tag-${t.kind}`}>{KIND_LABEL[t.kind]}</span>
        </b>
        <span>{parts.join(' · ')}</span>
      </span>
      {isLegend && (
        <span className="sector-mark sector-mark-legend" title={tn('profile.legendSector')}>
          <LaurelIcon size={13} color="currentColor" />
          {tn('profile.legendMark')}
        </span>
      )}
      {t.coHolders.length > 0 && (
        <span className="sector-mark sector-mark-shared" title={tn('profile.sectorShared')}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7M22 21v-1a6 6 0 0 0-4-5.6" />
          </svg>
          {t.coHolders.length + 1}
        </span>
      )}
      {shieldLeft > 0 && (
        <span className="sector-mark sector-mark-shield" title={tn('profile.shielded')}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 2l8 3v6c0 5-3.4 8.7-8 11-4.6-2.3-8-6-8-11V5l8-3z" />
          </svg>
          {shortLeft(shieldLeft)}
        </span>
      )}
      {hot && (
        <span className="sector-mark sector-mark-hot" title={tn('profile.hotSector')}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 2c1 4 5 5.5 5 11a5 5 0 0 1-10 0c0-2.5 1.2-4 2.5-5 .2 2 1 3 2 3.5C11 9 10.5 5.5 12 2z" />
          </svg>
          ×2
        </span>
      )}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A8A9AE" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: '0 0 auto' }}>
        <path d="M9 6l6 6-6 6" />
      </svg>
    </button>
  )
}

// The Sectors tab's row: swiped left it shows «Маршрут» and «На карте»
// behind it (the map one only for a sector of the city on the map). One row
// open at a time — the list holds which; a tap on an open row closes it
// instead of opening the sector. Vertical scrolling stays the browser's
// (touch-action: pan-y), the row only takes a drag that starts sideways.
const SWIPE_ACTION_W = 76
export function SwipeSectorRow({
  t,
  last,
  open,
  onSwipe,
  onOpen,
  onRoute,
  onShowOnMap,
  style,
  legendUserId,
}: {
  t: Territory
  last: boolean
  open: boolean
  onSwipe: (id: string | null) => void
  onOpen: (id: string) => void
  onRoute: (t: Territory) => void
  onShowOnMap?: (id: string) => void
  style?: React.CSSProperties
  legendUserId?: string
}) {
  const width = SWIPE_ACTION_W * (onShowOnMap ? 2 : 1)
  const [drag, setDrag] = useState<number | null>(null)
  const start = useRef<{ x: number; y: number; base: number; sideways: boolean | null } | null>(null)
  const dragged = useRef(false)
  const x = drag ?? (open ? -width : 0)
  return (
    <div className="swipe-row" style={{ ...style, borderBottom: last ? 'none' : '1px solid var(--line)' }}>
      <div className="swipe-row-actions" style={{ width }}>
        <button type="button" className="swipe-act route" tabIndex={open ? 0 : -1} onClick={() => { onSwipe(null); onRoute(t) }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 11l18-8-8 18-2-8-8-2z" />
          </svg>
          {tn('sector.route')}
        </button>
        {onShowOnMap && (
          <button type="button" className="swipe-act map" tabIndex={open ? 0 : -1} onClick={() => { onSwipe(null); onShowOnMap(t.id) }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4z" />
              <path d="M9 4v13M15 6.5v13" />
            </svg>
            {tn('sector.onMap')}
          </button>
        )}
      </div>
      <div
        className={`swipe-row-front${drag === null ? ' settle' : ''}`}
        style={{ transform: x ? `translateX(${x}px)` : undefined }}
        onPointerDown={(e) => {
          start.current = { x: e.clientX, y: e.clientY, base: open ? -width : 0, sideways: null }
          dragged.current = false
        }}
        onPointerMove={(e) => {
          const s = start.current
          if (!s) return
          const dx = e.clientX - s.x
          const dy = e.clientY - s.y
          if (s.sideways === null) {
            if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
            s.sideways = Math.abs(dx) > Math.abs(dy)
            if (s.sideways) e.currentTarget.setPointerCapture(e.pointerId)
          }
          if (!s.sideways) return
          dragged.current = true
          let next = s.base + dx
          // Past either end it only gives a little, like a rubber band.
          if (next > 0) next /= 4
          if (next < -width) next = -width + (next + width) / 4
          setDrag(next)
        }}
        onPointerUp={() => {
          start.current = null
          if (drag === null) return
          const willOpen = drag < -width / 2
          if (willOpen !== open) hapticSelect()
          onSwipe(willOpen ? t.id : null)
          setDrag(null)
        }}
        onPointerCancel={() => {
          start.current = null
          setDrag(null)
        }}
        onClickCapture={(e) => {
          if (dragged.current) {
            dragged.current = false
            e.stopPropagation()
          } else if (open) {
            e.stopPropagation()
            onSwipe(null)
          }
        }}
      >
        <ProfileSectorRow t={t} last onOpen={onOpen} legendUserId={legendUserId} />
      </div>
    </div>
  )
}

// «5 ч», «2 д», «40 мин» — how long the shield still holds, short enough for a tag.
function shortLeft(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60_000))
  if (minutes < 60) return tn('fmt.minShort', { count: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return tn('fmt.hourShort', { count: hours })
  return tn('fmt.dayShort', { count: Math.floor(hours / 24) })
}

// When the last catch was, after the catch count: «сегодня», «3 дня назад», «12 окт.».
function lastCatchLabel(iso: string, now: number): string {
  const d = new Date(iso)
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((day(new Date(now)) - day(d)) / 86_400_000)
  if (days <= 0) return tn('profile.lastToday')
  if (days === 1) return tn('profile.lastYesterday')
  if (days < 7) return tn('profile.lastDaysAgo', { count: days })
  return d.toLocaleDateString(currentLocale(), { day: 'numeric', month: 'short' })
}
