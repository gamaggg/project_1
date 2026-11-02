'use client'

import { KIND_LABEL } from '@/lib/data/species'
import type { Territory } from '@/lib/data/types'
import { pluralCatches } from '@/lib/format'
import { currentLocale, tn } from '@/lib/i18n'
import { useNow } from '@/lib/useNow'

// «Мои сектора» / someone else's sectors on the profile: one row
// per sector (no hexagon: the owner found it clutter, 02.11.2026) — the id with
// the water as a tag, how many catches and when the last one was, and the marks
// when the sector has them: shared with clan-mates (how many hold it), under a
// shield (how long it still holds), hot this week (×2).

export function ProfileSectorRow({ t, last, onOpen }: { t: Territory; last: boolean; onOpen: (id: string) => void }) {
  const now = useNow(30_000)
  const shieldLeft = t.shieldUntil ? new Date(t.shieldUntil).getTime() - now : 0
  const hot = !!t.hotUntil && new Date(t.hotUntil).getTime() > now
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
