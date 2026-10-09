'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { CoinIcon } from '@/components/app-shell/CoinIcon'
import { useMyActiveBuffs } from '@/lib/supabase/queries'
import { useNow } from '@/lib/useNow'
import { hapticTap } from '@/lib/telegram/haptics'

// What coin_multiplier doubles, and what it leaves alone — the same lists as
// the FAQ («Что дают бафы?»).
const DOUBLED = ['Уловы', 'Захваты', 'Челленджи', 'Достижения', 'Награды клана']
const NOT_DOUBLED = 'Казна, ежедневная награда и слоты — без удвоения'
// A hot sector's ×2 and this ×2 add up to ×3 for a catch, not ×4 (confirm_catch).
const ON_HOT = 'На горячем секторе улов — ×3'

// The running «Двойные монеты» (bought in the shop or won as «3 крючка» in the
// slots): when it started and when it ends, or null if it isn't on.
function useDoubleCoins(): { from: number; until: number } | null {
  const { data: buffs = [] } = useMyActiveBuffs()
  const now = useNow(60_000)
  let best: { from: number; until: number } | null = null
  for (const b of buffs) {
    if (b.buffId !== 'double_coins') continue
    const until = new Date(b.expiresAt).getTime()
    if (until > now && (!best || until > best.until)) best = { from: new Date(b.activatedAt).getTime(), until }
  }
  return best
}

export function useDoubleCoinsUntil(): number | null {
  return useDoubleCoins()?.until ?? null
}

function left(ms: number) {
  const min = Math.max(1, Math.ceil(ms / 60_000))
  return min < 60 ? `${min} мин` : `${Math.floor(min / 60)} ч`
}

// «×2» in the map's top panel while double coins are on — players won it in
// the slots and couldn't tell it was working. A tap opens what it doubles and
// how long is left.
export function DoubleCoinsChip() {
  const buff = useDoubleCoins()
  const now = useNow(60_000)
  const [open, setOpen] = useState(false)
  if (!buff) return null
  const rest = left(buff.until - now)
  return (
    <>
      <button
        type="button"
        className="double-coins-chip tap-scale"
        aria-label={`Двойные монеты, ещё ${rest}`}
        onClick={() => {
          hapticTap()
          setOpen(true)
        }}
      >
        <b>×2</b>
        <span>{rest}</span>
      </button>
      {open && <DoubleCoinsModal from={buff.from} until={buff.until} onClose={() => setOpen(false)} />}
    </>
  )
}

// The hero is the coin inside a gold ring — the ring is what's left of the
// buff's time, drawn the way the shield modal draws a shield's 24 hours.
const RING_R = 58
const RING_C = 2 * Math.PI * RING_R

function DoubleCoinsModal({ from, until, onClose }: { from: number; until: number; onClose: () => void }) {
  const now = useNow(30_000)
  const leftMs = Math.max(0, until - now)
  const minutes = Math.max(1, Math.ceil(leftMs / 60_000))
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const share = Math.min(1, leftMs / Math.max(1, until - from))

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card double-modal" role="dialog" aria-label="Двойные монеты" onClick={(e) => e.stopPropagation()}>
        <div className="double-modal-hero" aria-hidden>
          <svg className="double-modal-ring" width="140" height="140" viewBox="0 0 140 140">
            <defs>
              <linearGradient id="double-ring-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#FFD86B" />
                <stop offset="1" stopColor="#D98E0B" />
              </linearGradient>
            </defs>
            <circle cx="70" cy="70" r={RING_R} fill="none" stroke="rgba(217,142,11,.14)" strokeWidth="7" />
            <circle
              className="double-modal-ring-left"
              cx="70"
              cy="70"
              r={RING_R}
              fill="none"
              stroke="url(#double-ring-grad)"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={RING_C}
              strokeDashoffset={RING_C * (1 - share)}
              style={{ ['--ring-c' as string]: RING_C }}
              transform="rotate(-90 70 70)"
            />
          </svg>
          <div className="double-modal-coin">
            <CoinIcon size={56} animated="spin" />
          </div>
          <div className="double-modal-badge">×2</div>
        </div>

        <div className="modal-title double-modal-title">Двойные монеты</div>

        <div className="double-modal-timer">
          <b>
            {h > 0 && (
              <>
                {h}
                <small>ч</small>{' '}
              </>
            )}
            {m}
            <small>мин</small>
          </b>
          <span>до конца удвоения</span>
        </div>

        <div className="double-modal-what">
          <div className="double-modal-kicker">Вдвое больше монет за</div>
          <div className="double-modal-chips">
            {DOUBLED.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>
        <div className="double-modal-note">
          <b>{ON_HOT}</b>
          {NOT_DOUBLED}
        </div>

        <button className="btn-primary" onClick={onClose}>
          Понятно
        </button>
      </div>
    </div>,
    document.body
  )
}
