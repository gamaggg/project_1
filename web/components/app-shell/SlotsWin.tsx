'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { CoinIcon } from '@/components/app-shell/CoinIcon'
import { SlotSymbol } from '@/components/app-shell/SlotSymbol'
import type { SlotPrize, SlotSymbol as SymbolId } from '@/lib/supabase/queries'
import type { CityId } from '@/lib/data/city'
import { hapticBuildUp } from '@/lib/telegram/haptics'
import { useT } from '@/lib/i18n'
import { downloadImage, shareImageToStory } from '@/lib/story'

// A win on the slots, said with the screen: a fountain of what was won out of
// the payline — coins for coins, the symbol itself for a shield, a «×2» or a
// free spin — bigger for a bigger prize. The jackpot takes the whole screen
// (JackpotCelebration below).

type Piece = 'coin' | SymbolId
const BURST: Partial<Record<SlotPrize, { count: number; piece: Piece }>> = {
  pair: { count: 9, piece: 'coin' },
  triple: { count: 15, piece: 'coin' },
  lufar: { count: 24, piece: 'coin' },
  free_spin: { count: 12, piece: 'skorpena' },
  double: { count: 12, piece: 'hook' },
  shield: { count: 12, piece: 'hex' },
}

// Deterministic spread per piece (a seeded jitter, not Math.random in
// render), so a re-render mid-flight doesn't scatter them anew.
function jitter(i: number, salt: number) {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x)
}

export function WinBurst({ prize, coins, city }: { prize: SlotPrize; coins: number; city: CityId }) {
  // A shield on a full reserve comes back as coins.
  const plan = prize === 'shield' && coins > 0 ? { count: 14, piece: 'coin' as Piece } : BURST[prize]
  const pieces = useMemo(
    () =>
      Array.from({ length: plan?.count ?? 0 }, (_, i) => {
        const side = i % 2 === 0 ? 1 : -1
        return {
          // The machine sits at the top of the screen: a low, wide arc, and
          // the fall carries the pieces down over the screen.
          dx: side * (40 + jitter(i, 1) * 130),
          dy: -(40 + jitter(i, 2) * 100),
          rot: (jitter(i, 3) - 0.5) * 720,
          delay: jitter(i, 4) * 0.18,
          scale: 0.75 + jitter(i, 5) * 0.5,
        }
      }),
    [plan?.count]
  )
  if (!plan) return null
  return (
    <div className="win-burst" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="win-piece"
          style={{ '--dx': `${p.dx}px`, '--dy': `${p.dy}px`, '--rot': `${p.rot}deg`, '--s': p.scale, animationDelay: `${p.delay}s` } as CSSProperties}
        >
          <i className={plan.piece === 'coin' ? undefined : 'symbol'} style={{ animationDelay: `${p.delay}s` }}>
            {plan.piece === 'coin' ? <CoinIcon size={28} /> : <SlotSymbol symbol={plan.piece} city={city} size={36} />}
          </i>
        </span>
      ))}
    </div>
  )
}

// The jackpot: the screen goes dark gold, rays turn behind, «ДЖЕКПОТ!» slams
// in over the three jackpot fish, coins rain the whole time, and the prize is
// named — the frame, or the coins when the frame is already owned. «В историю»
// and «Скачать» send out the jackpot card (/api/jackpot-card).
export function JackpotCelebration({
  city,
  title,
  prize,
  take,
  cardUrl,
  link,
  onClose,
}: {
  city: CityId
  title: string
  prize: string
  take: string
  cardUrl: string
  link: string
  onClose: () => void
}) {
  const t = useT()
  const [busy, setBusy] = useState<'story' | 'download' | null>(null)
  const [note, setNote] = useState<string | null>(null)
  async function toStory() {
    setBusy('story')
    setNote(null)
    const res = await shareImageToStory(cardUrl, t('slots.jackpot.caption'), link, 'range-jackpot.png')
    setBusy(null)
    if (res === 'downloaded') setNote(t('slots.jackpot.saved'))
    if (res === 'failed') setNote(t('slots.jackpot.failed'))
  }
  async function download() {
    setBusy('download')
    setNote(null)
    const res = await downloadImage(cardUrl, 'range-jackpot.png')
    setBusy(null)
    if (res === 'downloaded') setNote(t('slots.jackpot.saved'))
    if (res === 'failed') setNote(t('slots.jackpot.failed'))
  }
  useEffect(() => {
    hapticBuildUp()
    const id = window.setTimeout(hapticBuildUp, 700)
    return () => window.clearTimeout(id)
  }, [])
  const rain = useMemo(
    () =>
      Array.from({ length: 34 }, (_, i) => ({
        x: jitter(i, 7) * 100,
        delay: jitter(i, 8) * 2.4,
        dur: 2.2 + jitter(i, 9) * 1.6,
        rot: (jitter(i, 10) - 0.5) * 900,
        size: jitter(i, 11) > 0.6 ? 28 : 20,
      })),
    []
  )
  return createPortal(
    <div className="jackpot-overlay" role="dialog" aria-label={title}>
      <div className="jackpot-rays" aria-hidden />
      <div className="jackpot-rain" aria-hidden>
        {rain.map((c, i) => (
          <span key={i} style={{ left: `${c.x}%`, animationDelay: `${c.delay}s`, animationDuration: `${c.dur}s`, '--rot': `${c.rot}deg` } as CSSProperties}>
            <CoinIcon size={c.size as 20 | 28} />
          </span>
        ))}
      </div>
      <div className="jackpot-card">
        <div className="jackpot-symbols" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ animationDelay: `${0.15 + i * 0.12}s` }}>
              <SlotSymbol symbol="katran" city={city} size={52} />
            </span>
          ))}
        </div>
        <div className="jackpot-title">{title}</div>
        <div className="jackpot-prize">{prize}</div>
        <button className="btn-primary jackpot-take" onClick={onClose}>
          {take}
        </button>
      </div>
      <div className="jackpot-bottom">
        <div className="jackpot-share">
          <button type="button" disabled={busy !== null} onClick={() => void toStory()}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
              <circle cx="12" cy="12" r="9" strokeDasharray="4 2.6" />
              <path d="M12 8v8M8 12h8" />
            </svg>
            {busy === 'story' ? t('slots.jackpot.preparing') : t('slots.jackpot.story')}
          </button>
          <button type="button" disabled={busy !== null} onClick={() => void download()}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 4v11M7 10.5 12 15.5l5-5M5 19.5h14" />
            </svg>
            {busy === 'download' ? t('slots.jackpot.preparing') : t('slots.jackpot.download')}
          </button>
        </div>
        {note && <div className="jackpot-note">{note}</div>}
      </div>
    </div>,
    document.body
  )
}
