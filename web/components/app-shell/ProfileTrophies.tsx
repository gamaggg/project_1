'use client'

import type { Catch } from '@/lib/data/types'
import { formatCatchMeta, formatWhen } from '@/lib/format'
import { currentLocale, tn } from '@/lib/i18n'
import { thumbUrl } from '@/lib/supabase/imageUrl'

// «Трофеи» on both profiles (own and someone else's): up to three biggest sized
// catches (trophies() in lib/data/achievements.ts) as a podium — the first one
// big on its own photo, the second and third as small cards beside each other.
// A tap opens the photo, and the swipe there goes through the trophies only.
export function ProfileTrophies({ catches, onOpenPhoto }: { catches: Catch[]; onOpenPhoto: (id: number, feedIds: number[]) => void }) {
  if (!catches.length) return null
  // The photo pages through these trophies only, not all the player's catches.
  const ids = catches.map((c) => c.id)
  const [first, ...rest] = catches
  const firstMeta = [formatCatchMeta(first.lengthCm, first.weightKg), new Date(first.caughtAt).toLocaleDateString(currentLocale(), { day: 'numeric', month: 'short' })].filter(Boolean).join(' · ')
  return (
    <>
      <div className="section-title-row" style={{ marginTop: 24 }}>
        <div className="section-title">{tn('profile.trophies')}</div>
        <span className="trophy-top">{tn('profile.trophiesTop', { count: catches.length })}</span>
      </div>
      <button className="trophy-hero tap-scale" onClick={() => onOpenPhoto(first.id, ids)}>
        {/* 480, not more: on R2 anything past the 480 copy is the original (1200×1600, ~7.5 MB once decoded), and
            this card on every profile (own tab and each player opened) kept one (13.11.2026). */}
        <img src={thumbUrl(first.photoUrl, 480)} alt={first.speciesName} loading="lazy" decoding="async" />
        <TrophyMedal place={1} />
        <span className="trophy-hero-text">
          <b>{first.speciesName}</b>
          <span>{firstMeta}</span>
        </span>
      </button>
      {rest.length > 0 && (
        <div className="trophy-rest">
          {rest.map((c, i) => (
            <button key={c.id} className="trophy-small tap-scale" onClick={() => onOpenPhoto(c.id, ids)}>
              <span className="trophy-small-thumb">
                <img src={thumbUrl(c.photoUrl, 240)} alt={c.speciesName} loading="lazy" decoding="async" />
                <TrophyMedal place={i + 2} />
              </span>
              <span className="trophy-small-text">
                <b>{c.speciesName}</b>
                <span>{formatCatchMeta(c.lengthCm, c.weightKg)}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </>
  )
}

function TrophyMedal({ place }: { place: number }) {
  return <span className={`trophy-medal trophy-medal-${place}`}>{place}</span>
}

// One row of «Последние уловы» (both profiles): the size beside the species,
// and when and in which sector underneath — every catch has those two, so a row
// without a size is no longer half empty.
export function ProfileCatchRow({ c, last, onOpenPhoto }: { c: Catch; last: boolean; onOpenPhoto: (id: number) => void }) {
  const meta = formatCatchMeta(c.lengthCm, c.weightKg)
  return (
    <button className="profile-row tap-scale" style={{ borderBottom: last ? 'none' : '1px solid var(--line)' }} onClick={() => onOpenPhoto(c.id)}>
      <span className="fish-thumb" style={{ width: 46, height: 46 }}>
        <img src={thumbUrl(c.photoUrl, 240)} alt={c.speciesName} loading="lazy" decoding="async" />
      </span>
      <span className="profile-row-text">
        <b>
          {c.speciesName}
          {meta && <em> · {meta}</em>}
        </b>
        <span>
          {formatWhen(c.caughtAt)} · {c.territoryId}
        </span>
      </span>
    </button>
  )
}
