'use client'

import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { ClanCrest } from '@/components/app-shell/ClanCrest'
import { currentLocale, tn } from '@/lib/i18n/runtime'
import type { ClanRace } from '@/lib/data/types'

const CONFETTI_COLORS = ['#FC5200', '#FFD60A', '#1E8FB5', '#2FA84F', '#A88EF5', '#FF6B6B']
// Fixed, not random: the burst looks the same every time and renders the
// same on server and client.
const CONFETTI = Array.from({ length: 16 }, (_, i) => {
  const angle = (i / 16) * Math.PI * 2
  const dist = 90 + (i % 4) * 22
  return {
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    tx: Math.round(Math.cos(angle) * dist),
    ty: Math.round(Math.sin(angle) * dist * 0.8 - 30),
    rot: (i % 2 ? 1 : -1) * (180 + i * 25),
    delay: 1.15 + (i % 5) * 0.03,
  }
})

function weekRange(weekStartIso: string): string {
  const thisWeek = new Date(weekStartIso)
  const start = new Date(thisWeek.getTime() - 7 * 86_400_000)
  const end = new Date(thisWeek.getTime() - 86_400_000)
  const month = (d: Date) => d.toLocaleDateString(currentLocale(), { month: 'long' })
  return start.getMonth() === end.getMonth()
    ? `${start.getDate()}–${end.getDate()} ${month(end)}`
    : `${start.getDate()} ${month(start)} – ${end.getDate()} ${month(end)}`
}

// Last week's clan battle, told once at the start of the new one: the three
// podium columns rise in turn (3rd, 2nd, 1st), each clan's crest drops onto
// its column, your clan's column lights up, and a win throws confetti.
export function ClanBattleCeremony({ race, clanId, onOpenRace, onClose }: { race: ClanRace; clanId: number; onOpenRace: () => void; onClose: () => void }) {
  const results = race.lastWeek
  const mine = results.find((c) => c.id === clanId)
  if (!mine) return null
  const solo = results.length === 1
  const won = !solo && mine.place === 1
  const pct = Math.min(100, Math.floor((mine.meters / Math.max(1, mine.finish)) * 100))
  // Podium order on screen: 2nd, 1st, 3rd — the classic stand.
  const podium = solo ? [null, results[0], null] : [results.find((c) => c.place === 2), results.find((c) => c.place === 1), results.find((c) => c.place === 3)]
  const headline = solo
    ? mine.finished
      ? tn('battle.soloDone')
      : tn('battle.soloClose')
    : won
      ? tn('battle.won', { name: mine.name })
      : mine.place > 3
        ? tn('battle.placeOf', { name: mine.name, place: tn('race.place', { rank: mine.place }), total: results.length })
        : tn('battle.place', { name: mine.name, place: tn('race.place', { rank: mine.place }) })
  const sub = solo
    ? mine.finished
      ? tn('battle.soloSubDone')
      : tn('battle.soloSubWait', { pct })
    : mine.finished
      ? tn('battle.subDone')
      : tn('battle.subPct', { pct })

  return createPortal(
    <div className="modal-overlay battle-cer-overlay" onClick={onClose}>
      <div className="modal-card battle-cer-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={tn('battle.ariaTitle')}>
        <div className="battle-cer-title">{tn('battle.title')}</div>
        <div className="battle-cer-week">{weekRange(race.weekStart)}</div>

        <div className="battle-cer-stage">
          {won && (
            <div className="battle-cer-confetti" aria-hidden>
              {CONFETTI.map((c, i) => (
                <span
                  key={i}
                  className="battle-cer-confetti-piece"
                  style={{ '--c': c.color, '--tx': `${c.tx}px`, '--ty': `${c.ty}px`, '--rot': `${c.rot}deg`, animationDelay: `${c.delay}s` } as CSSProperties}
                />
              ))}
            </div>
          )}
          <div className="battle-cer-podium">
            {podium.map((c, i) => {
              // Rise order: 3rd, then 2nd, then 1st.
              const order = i === 2 ? 0 : i === 0 ? 1 : 2
              if (!c) return <div key={`empty-${i}`} className="battle-cer-slot" aria-hidden />
              const isMine = c.id === clanId
              return (
                <div key={c.id} className={`battle-cer-slot place-${c.place}${isMine ? ' mine' : ''}`} style={{ '--order': order } as CSSProperties}>
                  <div className="battle-cer-crest">
                    <ClanCrest crest={c.crest} size={c.place === 1 ? 62 : 48} shine={c.place === 1} />
                  </div>
                  <div className="battle-cer-name">{c.name}</div>
                  <div className="battle-cer-column">
                    <span className="battle-cer-place">{c.place}</span>
                    {isMine && <span className="battle-cer-you">{tn('battle.yourClan')}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {!solo && mine.place > 3 && (
          <div className="battle-cer-mine-row">
            <ClanCrest crest={mine.crest} size={34} />
            <span>{mine.name}</span>
            <b>{tn('race.place', { rank: mine.place })}</b>
          </div>
        )}

        <div className="battle-cer-headline">{headline}</div>
        <div className="battle-cer-sub">{sub}</div>

        <button className="btn-primary" style={{ marginTop: 18 }} onClick={onOpenRace}>
          {tn('battle.thisWeek')}
        </button>
        <button className="battle-cer-close" onClick={onClose}>
          {tn('common.close')}
        </button>
      </div>
    </div>,
    document.body
  )
}
