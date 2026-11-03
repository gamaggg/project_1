'use client'

import { useMemo } from 'react'
import { AWARD_ICONS, AWARD_COLOR, awardMedalStyle } from '@/components/app-shell/awardIcons'
import { medalName, type AwardGroup } from '@/components/app-shell/AwardsRing'
import { seededRandom, seedFrom } from '@/lib/seededRandom'
import { useWeeklyLeaderboard } from '@/lib/supabase/queries'
import { thumbUrl } from '@/lib/supabase/imageUrl'
import { CITIES, type CityId } from '@/lib/data/city'
import { tn } from '@/lib/i18n/runtime'

const CONFETTI_EXTRA = '#FC5200'

// Shown when tapping any medal in an AwardsRing — same overlay-at-app-level
// idea as AchievementUnlockedModal, but this one's purely a viewer (any
// visitor can open it, not just the owner, and it doesn't track "seen").
// One medal of a kind: its own card, as before. Several (1st, 2nd and 3rd
// place of the week): the kind's name and a line for each. None (a locked
// medal on the owner's profile): grey, no confetti, and how to earn it.
// The locked «Дуэлянт»: who to take a sector from — last week's top 3 of the
// city the player is in (the same rating as «Итоги недели»). Nothing is drawn
// while it loads or when nobody caught anything last week.
function DuelistTop({ city }: { city: CityId }) {
  const cityInfo = CITIES[city]
  const { data: entries = [] } = useWeeklyLeaderboard(false, -1, cityInfo.idPrefix, cityInfo.timezone, 3)
  if (entries.length === 0) return null
  return (
    <div className="award-top3">
      <div className="award-top3-title">{tn('medals.duelistTop', { city: cityInfo.name })}</div>
      {entries.slice(0, 3).map((e) => (
        <div key={e.userId} className="award-top3-row">
          <span className={`award-top3-rank rank-${e.rank}`}>{e.rank}</span>
          <span className="avatar award-top3-avatar">{e.avatarUrl ? <img src={thumbUrl(e.avatarUrl, 96)} alt="" loading="lazy" decoding="async" /> : e.displayName.slice(0, 2).toUpperCase()}</span>
          <span className="award-top3-name">{e.displayName}</span>
        </div>
      ))}
    </div>
  )
}

export function AwardDetailModal({ group, city, onClose }: { group: AwardGroup; city: CityId; onClose: () => void }) {
  const { kind, awards } = group
  const award = awards.length === 1 ? awards[0] : null
  const locked = awards.length === 0
  const { color, colorHi } = AWARD_COLOR[kind] ?? AWARD_COLOR.weekly_rank

  const confetti = useMemo(() => {
    if (locked) return []
    const rand = seededRandom(seedFrom(awards[0].id))
    return Array.from({ length: 14 }, (_, i) => {
      const angle = rand() * Math.PI * 2
      const dist = 60 + rand() * 70
      return {
        color: i % 3 === 0 ? color : i % 3 === 1 ? colorHi : CONFETTI_EXTRA,
        tx: Math.cos(angle) * dist,
        ty: Math.sin(angle) * dist - 10,
        rot: rand() * 400 - 200,
        delay: rand() * 0.15,
      }
    })
  }, [locked, awards, color, colorHi])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="award-detail-card" onClick={(e) => e.stopPropagation()}>
        <div className="award-detail-confetti">
          {confetti.map((c, i) => (
            <span
              key={i}
              className="award-detail-confetti-piece"
              style={{ '--c': c.color, '--tx': `${c.tx}px`, '--ty': `${c.ty}px`, '--rot': `${c.rot}deg`, animationDelay: `${c.delay}s` } as React.CSSProperties}
            />
          ))}
        </div>
        <div className="award-detail-icon-wrap">
          {!locked && <div className="award-detail-icon-glow" style={{ background: `radial-gradient(circle, ${color}, transparent 70%)` }} />}
          <div className={`award-medal award-detail-icon${locked ? ' award-medal-locked' : ' award-medal-shine'}`} style={locked ? undefined : awardMedalStyle(kind in AWARD_COLOR ? kind : 'weekly_rank')}>
            {AWARD_ICONS[kind]}
          </div>
        </div>
        {award ? (
          <>
            <div className="award-detail-title">{award.title}</div>
            <div className="award-detail-subtitle">{award.subtitle}</div>
            <div className="award-detail-desc">{award.description}</div>
          </>
        ) : locked ? (
          <>
            <div className="award-detail-title">{medalName(kind)}</div>
            <div className="award-detail-subtitle">{tn('medals.locked')}</div>
            <div className="award-detail-how">{tn('medals.howTitle')}</div>
            <div className="award-detail-desc">{tn(`medals.how_${kind}`)}</div>
            {kind === 'duelist' && <DuelistTop city={city} />}
          </>
        ) : (
          <>
            <div className="award-detail-title">{medalName(kind)}</div>
            <div className="award-detail-subtitle">{tn('medals.times', { count: awards.length })}</div>
            <div className="award-detail-list">
              {/* The week's places best first (titles «1 место»…), the rest newest first. */}
              {[...awards].sort((x, y) => (kind === 'weekly_rank' ? x.title.localeCompare(y.title, 'ru', { numeric: true }) : 0)).map((a) => (
                <div key={a.id} className="award-detail-row">
                  <b>{a.title}</b> {a.subtitle}
                </div>
              ))}
            </div>
          </>
        )}
        <button className="unlock-modal-close tap-scale" onClick={onClose}>
          {tn('common.close')}
        </button>
      </div>
    </div>
  )
}
