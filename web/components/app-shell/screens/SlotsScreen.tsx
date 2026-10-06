'use client'

import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CoinIcon } from '@/components/app-shell/CoinIcon'
import { SlotSymbol, slotSymbolSrc } from '@/components/app-shell/SlotSymbol'
import { useAuth } from '@/components/providers/AuthProvider'
import { useSlotState, useSpinSlots, type SlotPrize, type SlotSpinResult, type SlotSymbol as SymbolId } from '@/lib/supabase/queries'
import type { CityId } from '@/lib/data/city'
import { useI18n, type TKey } from '@/lib/i18n'
import { hapticSuccess, hapticTap } from '@/lib/telegram/haptics'

// The «Слоты» tab that replaced ДЭП: free spins only, nothing is staked.
// The reel motion — strips sliding under a motion blur, the last reel running
// against the others — is adapted from StealthWorm's "Love, Death & Robots"
// loader on Uiverse (MIT): https://uiverse.io/StealthWorm/chatty-zebra-11

const CELL = 92 // one symbol, px — keep in sync with --slot-cell in globals.css
const WINDOW = 128 // visible reel height: one symbol plus a peek of its neighbours
const CENTER = (WINDOW - CELL) / 2
const SPIN_MS = [1500, 1950, 2400]
const STRIP_FILL = 16
// Idle drift: every DRIFT_EVERY ms all three reels roll on to new symbols
// together, stopping left to right like a short spin; a result stays put
// for DRIFT_HOLD ms first so it can be read.
const DRIFT_EVERY = 2500
const DRIFT_MS = [900, 1150, 1400]
const DRIFT_HOLD = 6000
const SYMBOLS: SymbolId[] = ['stavrida', 'skorpena', 'lufar', 'katran', 'hook', 'hex']
// At rest a reel is a short band of seven cells with its symbol in the middle
// and other symbols around it (the peeks above and below the payline) — like
// a real reel band rather than seven copies of one symbol. Each reel has its
// own order (offsets into SYMBOLS from the middle one, no two neighbours
// alike), so the three don't look alike.
const BANDS = [
  [3, 5, 1, 0, 2, 4, 3],
  [2, 4, 5, 0, 1, 3, 2],
  [4, 1, 3, 0, 5, 2, 4],
]
const IDLE_Y = CENTER - 3 * CELL

// `symbol` is what the reel shows (or is rolling to); `drift` marks an idle
// roll, whose end just settles the band instead of counting as a spin stop.
type Reel = { strip: SymbolId[]; y: number; duration: number; symbol: SymbolId; drift?: boolean }

function idleReel(symbol: SymbolId, reel: number): Reel {
  const k = SYMBOLS.indexOf(symbol)
  return { strip: BANDS[reel].map((o) => SYMBOLS[(k + o) % SYMBOLS.length]), y: IDLE_Y, duration: 0, symbol }
}

// A roll from one symbol to another: the strip starts with the band at rest
// (the symbol and its two neighbours) and ends with the target's own band, so
// the peeks around the payline don't jump when it starts or settles. The last
// reel runs the other way round, like the loader's third column.
function rollPlan(reel: number, from: SymbolId, to: SymbolId, fill: number) {
  const a = idleReel(from, reel).strip.slice(2, 5)
  const b = idleReel(to, reel).strip.slice(2, 5)
  const path = filler(fill)
  if (reel === 2) {
    const strip = [...b, ...path, ...a]
    return { strip, startY: CENTER - (strip.length - 2) * CELL, endY: CENTER - CELL }
  }
  const strip = [...a, ...path, ...b]
  return { strip, startY: CENTER - CELL, endY: CENTER - (strip.length - 2) * CELL }
}

function filler(count: number): SymbolId[] {
  const out: SymbolId[] = []
  for (let i = 0; i < count; i++) {
    let next: SymbolId
    do next = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]
    while (next === out[out.length - 1])
    out.push(next)
  }
  return out
}

const PAY_ROWS: { prize: SlotPrize; symbols: SymbolId[]; chance: number; label: TKey; reward: { coins: number } | { text: TKey } }[] = [
  // Same odds as spin_slots on the server (supabase-drafts/slots_odds_free_spin.sql),
  // rarest first.
  { prize: 'jackpot', symbols: ['katran', 'katran', 'katran'], chance: 0.003, label: 'slots.rows.jackpot', reward: { text: 'slots.rewards.jackpot' } },
  { prize: 'lufar', symbols: ['lufar', 'lufar', 'lufar'], chance: 0.04, label: 'slots.rows.lufar', reward: { coins: 100 } },
  { prize: 'shield', symbols: ['hex', 'hex', 'hex'], chance: 0.05, label: 'slots.rows.shield', reward: { text: 'slots.rewards.shield' } },
  { prize: 'double', symbols: ['hook', 'hook', 'hook'], chance: 0.06, label: 'slots.rows.double', reward: { text: 'slots.rewards.double' } },
  { prize: 'free_spin', symbols: ['skorpena', 'skorpena', 'skorpena'], chance: 0.08, label: 'slots.rows.freeSpin', reward: { text: 'slots.rewards.freeSpin' } },
  { prize: 'triple', symbols: ['stavrida', 'stavrida', 'stavrida'], chance: 0.14, label: 'slots.rows.triple', reward: { coins: 25 } },
  { prize: 'pair', symbols: ['skorpena', 'skorpena', 'hook'], chance: 0.38, label: 'slots.rows.pair', reward: { coins: 10 } },
]

// Moscow's reels carry river fish on the same symbols (see SlotSymbol), so
// the lines that name a fish have their own Moscow wording.
const MOSCOW_TEXT: Partial<Record<TKey, TKey>> = {
  'slots.rows.jackpot': 'slots.moscow.rows.jackpot',
  'slots.rows.lufar': 'slots.moscow.rows.lufar',
  'slots.rows.triple': 'slots.moscow.rows.triple',
  'slots.rows.freeSpin': 'slots.moscow.rows.freeSpin',
  'slots.result.freeSpin': 'slots.moscow.result.freeSpin',
  'slots.result.lufar': 'slots.moscow.result.lufar',
  'slots.result.jackpot': 'slots.moscow.result.jackpot',
  'slots.rewards.jackpot': 'slots.moscow.rewards.jackpot',
}

const RESULT_TEXT: Record<SlotPrize, TKey> = {
  jackpot: 'slots.result.jackpot',
  jackpot_coins: 'slots.result.jackpotCoins',
  shield: 'slots.result.shield',
  double: 'slots.result.double',
  lufar: 'slots.result.lufar',
  triple: 'slots.result.triple',
  free_spin: 'slots.result.freeSpin',
  pair: 'slots.result.pair',
  none: 'slots.result.none',
}

function errorKey(error: unknown): TKey {
  const msg = error instanceof Error ? error.message : String((error as { message?: string })?.message ?? error)
  return msg.includes('SLOTS:no_spins') ? 'slots.noSpins' : 'common.tryAgain'
}

export function SlotsScreen({ city }: { city: CityId }) {
  const { t, lang } = useI18n()
  const local = (key: TKey) => (city === 'moscow' ? (MOSCOW_TEXT[key] ?? key) : key)
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data: state } = useSlotState()
  const spin = useSpinSlots()

  const [reels, setReels] = useState<Reel[]>(() => [idleReel('lufar', 0), idleReel('katran', 1), idleReel('hex', 2)])
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<SlotSpinResult | null>(null)
  const stoppedRef = useRef(0)
  // The spin whose reels are still turning; null once it's been revealed.
  const activeRef = useRef<SlotSpinResult | null>(null)

  const left = result ? result.left : (state?.left ?? 0)
  const total = result ? result.total : (state?.total ?? 1)
  // Gift spins from a super admin: part of `left`, spent after the day's own.
  const bonus = result ? result.bonus : (state?.bonus ?? 0)
  const freeShields = result ? result.freeShields : (state?.freeShields ?? 0)
  const canSpin = !!state && left > 0 && !spinning && !spin.isPending

  // A reel whose transitionend never comes (the tab went to the background
  // mid-spin) must not leave the machine stuck: reveal anyway shortly after
  // the slowest reel should have stopped.
  const fallbackRef = useRef<number | null>(null)
  useEffect(() => () => {
    if (fallbackRef.current) window.clearTimeout(fallbackRef.current)
  }, [])

  // Idle reels don't sit still: now and then all three roll a few cells on
  // to new symbols, so the machine looks alive and shows something new.
  // Not while spinning, not right after a result, not on a hidden screen,
  // not with reduced motion.
  const rootRef = useRef<HTMLDivElement>(null)
  const reelsRef = useRef(reels)
  const settledAtRef = useRef(0)
  useEffect(() => {
    reelsRef.current = reels
  }, [reels])
  const busy = spinning || spin.isPending
  useEffect(() => {
    if (busy || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = window.setInterval(() => {
      if (document.hidden || Date.now() - settledAtRef.current < DRIFT_HOLD) return
      if (!rootRef.current?.closest('.screen.active')) return
      const now = reelsRef.current
      if (now.some((reel) => reel.duration)) return
      // Each reel to something new — but never three alike at rest, it
      // would look like a win nobody got.
      let next: SymbolId[]
      do next = now.map((reel) => SYMBOLS.filter((s) => s !== reel.symbol)[Math.floor(Math.random() * (SYMBOLS.length - 1))])
      while (next[0] === next[1] && next[1] === next[2])
      const plans = now.map((reel, i) => rollPlan(i, reel.symbol, next[i], 2 + Math.floor(Math.random() * 3)))
      const laid = plans.map((plan, i): Reel => ({ strip: plan.strip, y: plan.startY, duration: 0, symbol: next[i], drift: true }))
      setReels(laid)
      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          setReels((prev) => prev.map((x, i) => (x.strip === laid[i].strip ? { ...x, y: plans[i].endY, duration: DRIFT_MS[i] } : x)))
        )
      )
    }, DRIFT_EVERY)
    return () => window.clearInterval(id)
  }, [busy])

  // All six pictures ready before the first spin, so no cell flies past empty.
  useEffect(() => {
    for (const symbol of SYMBOLS) new Image().src = slotSymbolSrc(symbol, city)
  }, [city])

  function reveal(res: SlotSpinResult) {
    if (activeRef.current !== res) return
    activeRef.current = null
    if (fallbackRef.current) window.clearTimeout(fallbackRef.current)
    setReels(res.reels.map((symbol, i) => idleReel(symbol, i)))
    settledAtRef.current = Date.now()
    setSpinning(false)
    setResult(res)
    if (res.prize !== 'none') hapticSuccess()
    queryClient.invalidateQueries({ queryKey: ['profile', user?.id] })
    queryClient.invalidateQueries({ queryKey: ['my-active-buffs', user?.id ?? null] })
    queryClient.invalidateQueries({ queryKey: ['slot-state', user?.id ?? null] })
  }

  function onReelStop() {
    hapticTap()
    stoppedRef.current += 1
    if (stoppedRef.current === 3 && activeRef.current) reveal(activeRef.current)
  }

  function start() {
    if (!canSpin) return
    setResult(null)
    spin.mutate(undefined, {
      onSuccess: (res) => {
        activeRef.current = res
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          reveal(res)
          return
        }
        stoppedRef.current = 0
        setSpinning(true)
        // Lay each strip out at its start position first, then move it on
        // the next frame so the browser has a "from" to transition out of.
        const plans = reelsRef.current.map((reel, i) => rollPlan(i, reel.symbol, res.reels[i], STRIP_FILL))
        const laid = plans.map((plan, i): Reel => ({ strip: plan.strip, y: plan.startY, duration: 0, symbol: res.reels[i] }))
        setReels(laid)
        fallbackRef.current = window.setTimeout(() => reveal(res), SPIN_MS[2] + 600)
        requestAnimationFrame(() =>
          requestAnimationFrame(() => setReels(laid.map((reel, i) => ({ ...reel, y: plans[i].endY, duration: SPIN_MS[i] }))))
        )
      },
    })
  }

  const percent = new Intl.NumberFormat(lang, { style: 'percent', maximumFractionDigits: 1 })

  return (
    <div className="slots" ref={rootRef}>
      <div className="slots-title">{t('slots.title')}</div>

      <div className={`slots-machine${result && result.prize !== 'none' ? ' won' : ''}`}>
        <div className="slots-window" style={{ height: WINDOW }}>
          {reels.map((reel, i) => (
            <div key={i} className="slot-reel">
              <div
                className={`slot-strip${reel.duration ? ` moving${reel.drift ? ' drift' : ''}` : ''}`}
                style={{
                  transform: `translateY(${reel.y}px)`,
                  transitionDuration: `${reel.duration}ms`,
                  animationDuration: `${reel.duration}ms`,
                }}
                onTransitionEnd={(e) => {
                  if (e.propertyName !== 'transform' || !reel.duration) return
                  // An idle roll just settles into the new symbol's band (same
                  // picture, short strip again); a spin's stop counts to the reveal.
                  if (reel.drift) setReels((prev) => prev.map((x, j) => (j === i && x.strip === reel.strip ? idleReel(x.symbol, i) : x)))
                  else onReelStop()
                }}
              >
                {reel.strip.map((symbol, j) => (
                  <div key={j} className="slot-cell">
                    <SlotSymbol symbol={symbol} city={city} size={66} />
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="slots-payline" />
        </div>
      </div>

      <div className="slots-result" aria-live="polite">
        {result ? (
          <div key={result.reels.join() + result.left} className={`slots-result-text${result.prize === 'none' ? ' miss' : ''}`}>
            {result.coins > 0 && <CoinIcon size={20} />}
            {t(local(RESULT_TEXT[result.prize]), { coins: result.coins })}
          </div>
        ) : spin.isError ? (
          <div className="slots-result-text miss">{t(errorKey(spin.error))}</div>
        ) : null}
      </div>

      <button className="btn-primary slots-spin" disabled={!canSpin} onClick={start}>
        {spinning || spin.isPending ? t('slots.spinning') : left > 0 ? t('slots.spin') : t('slots.noSpins')}
      </button>
      <div className="slots-count">{t('slots.spinsToday', { left: left - bonus, total })}</div>
      <div className="slots-hint">{left > 0 ? t('slots.perCatch') : t('slots.noSpinsHint')}</div>
      {bonus > 0 && (
        <div className="slots-gift">
          <b>{t('slots.gift', { count: bonus })}</b>
          <span>{t('slots.giftHint')}</span>
        </div>
      )}
      {freeShields > 0 && <div className="slots-shields">{t('slots.freeShields', { count: freeShields })}</div>}

      <div className="slots-paytable">
        <div className="slots-paytable-head">
          <span>{t('slots.payTable')}</span>
          <span>{t('slots.chance')}</span>
        </div>
        {PAY_ROWS.map((row) => (
          <div key={row.prize} className="slots-pay-row">
            <div className="slots-pay-symbols">
              {row.symbols.map((symbol, i) => (
                <SlotSymbol key={i} symbol={symbol} city={city} size={20} />
              ))}
            </div>
            <div className="slots-pay-label">
              <div>{t(local(row.label))}</div>
              <div className="slots-pay-reward">
                {'coins' in row.reward ? (
                  <>
                    <CoinIcon size={16} /> {row.reward.coins}
                  </>
                ) : (
                  t(local(row.reward.text))
                )}
              </div>
            </div>
            <div className="slots-pay-chance">{percent.format(row.chance)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
