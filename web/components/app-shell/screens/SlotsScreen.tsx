'use client'

import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CoinIcon } from '@/components/app-shell/CoinIcon'
import { SlotSymbol } from '@/components/app-shell/SlotSymbol'
import { useAuth } from '@/components/providers/AuthProvider'
import { useSlotState, useSpinSlots, type SlotPrize, type SlotSpinResult, type SlotSymbol as SymbolId } from '@/lib/supabase/queries'
import { useI18n, type TKey } from '@/lib/i18n'
import { hapticSuccess, hapticTap } from '@/lib/telegram/haptics'

// The «Слоты» tab that replaced ДЭП: free spins only, nothing is staked.
// The reel motion — idle reels that jolt up and down under a motion blur,
// the middle one against the others — is adapted from StealthWorm's
// "Love, Death & Robots" loader on Uiverse (MIT):
// https://uiverse.io/StealthWorm/chatty-zebra-11

const CELL = 84 // one symbol, px — keep in sync with .slot-cell in globals.css
const WINDOW = 118 // visible reel height: one symbol plus a peek of its neighbours
const CENTER = (WINDOW - CELL) / 2
const SPIN_MS = [1500, 1950, 2400]
const STRIP_FILL = 16
const SYMBOLS: SymbolId[] = ['stavrida', 'skorpena', 'lufar', 'katran', 'hook', 'hex']
// Seven identical cells while idle (as in the loader): the tease slides the
// strip a cell and a half each way, and there's always a copy in view.
const IDLE_COPIES = 7
const IDLE_Y = CENTER - 3 * CELL

type Reel = { strip: SymbolId[]; y: number; duration: number }

function idleReel(symbol: SymbolId): Reel {
  return { strip: Array(IDLE_COPIES).fill(symbol), y: IDLE_Y, duration: 0 }
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
  { prize: 'jackpot', symbols: ['katran', 'katran', 'katran'], chance: 0.005, label: 'slots.rows.jackpot', reward: { text: 'slots.rewards.jackpot' } },
  { prize: 'shield', symbols: ['hex', 'hex', 'hex'], chance: 0.03, label: 'slots.rows.shield', reward: { text: 'slots.rewards.shield' } },
  { prize: 'double', symbols: ['hook', 'hook', 'hook'], chance: 0.04, label: 'slots.rows.double', reward: { text: 'slots.rewards.double' } },
  { prize: 'lufar', symbols: ['lufar', 'lufar', 'lufar'], chance: 0.025, label: 'slots.rows.lufar', reward: { coins: 100 } },
  { prize: 'triple', symbols: ['stavrida', 'stavrida', 'stavrida'], chance: 0.1, label: 'slots.rows.triple', reward: { coins: 25 } },
  { prize: 'pair', symbols: ['skorpena', 'skorpena', 'hook'], chance: 0.3, label: 'slots.rows.pair', reward: { coins: 10 } },
]

const RESULT_TEXT: Record<SlotPrize, TKey> = {
  jackpot: 'slots.result.jackpot',
  jackpot_coins: 'slots.result.jackpotCoins',
  shield: 'slots.result.shield',
  double: 'slots.result.double',
  lufar: 'slots.result.lufar',
  triple: 'slots.result.triple',
  pair: 'slots.result.pair',
  none: 'slots.result.none',
}

function errorKey(error: unknown): TKey {
  const msg = error instanceof Error ? error.message : String((error as { message?: string })?.message ?? error)
  return msg.includes('SLOTS:no_spins') ? 'slots.noSpins' : 'common.tryAgain'
}

export function SlotsScreen() {
  const { t, lang } = useI18n()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data: state } = useSlotState()
  const spin = useSpinSlots()

  const [reels, setReels] = useState<Reel[]>(() => [idleReel('lufar'), idleReel('katran'), idleReel('hex')])
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<SlotSpinResult | null>(null)
  const stoppedRef = useRef(0)
  // The spin whose reels are still turning; null once it's been revealed.
  const activeRef = useRef<SlotSpinResult | null>(null)

  const left = result ? result.left : (state?.left ?? 0)
  const total = result ? result.total : (state?.total ?? 1)
  const freeShields = result ? result.freeShields : (state?.freeShields ?? 0)
  const canSpin = !!state && left > 0 && !spinning && !spin.isPending

  // A reel whose transitionend never comes (the tab went to the background
  // mid-spin) must not leave the machine stuck: reveal anyway shortly after
  // the slowest reel should have stopped.
  const fallbackRef = useRef<number | null>(null)
  useEffect(() => () => {
    if (fallbackRef.current) window.clearTimeout(fallbackRef.current)
  }, [])

  function reveal(res: SlotSpinResult) {
    if (activeRef.current !== res) return
    activeRef.current = null
    if (fallbackRef.current) window.clearTimeout(fallbackRef.current)
    setReels(res.reels.map(idleReel))
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
        // The last reel runs the other way round, like the loader's third column.
        const laid = reels.map((reel, i): Reel => {
          const current = reel.strip[3]
          const path = filler(STRIP_FILL)
          if (i === 2) {
            const strip = [res.reels[i], ...path, current]
            return { strip, y: CENTER - (strip.length - 1) * CELL, duration: 0 }
          }
          return { strip: [current, ...path, res.reels[i]], y: CENTER, duration: 0 }
        })
        setReels(laid)
        fallbackRef.current = window.setTimeout(() => reveal(res), SPIN_MS[2] + 600)
        requestAnimationFrame(() =>
          requestAnimationFrame(() =>
            setReels(
              laid.map((reel, i) => ({
                ...reel,
                y: i === 2 ? CENTER : CENTER - (reel.strip.length - 1) * CELL,
                duration: SPIN_MS[i],
              }))
            )
          )
        )
      },
    })
  }

  const percent = new Intl.NumberFormat(lang, { style: 'percent', maximumFractionDigits: 1 })

  return (
    <div className="slots">
      <div className="slots-title">{t('slots.title')}</div>

      <div className={`slots-machine${result && result.prize !== 'none' ? ' won' : ''}`}>
        <div className="slots-window" style={{ height: WINDOW }}>
          {reels.map((reel, i) => (
            <div key={i} className="slot-reel">
              <div className={`slot-tease${canSpin ? ` tease-${i}` : ''}`}>
                <div
                  className={`slot-strip${reel.duration ? ' moving' : ''}`}
                  style={{
                    transform: `translateY(${reel.y}px)`,
                    transitionDuration: `${reel.duration}ms`,
                    animationDuration: `${reel.duration}ms`,
                  }}
                  onTransitionEnd={(e) => {
                    if (e.propertyName === 'transform' && reel.duration) onReelStop()
                  }}
                >
                  {reel.strip.map((symbol, j) => (
                    <div key={j} className="slot-cell">
                      <SlotSymbol symbol={symbol} size={56} />
                    </div>
                  ))}
                </div>
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
            {t(RESULT_TEXT[result.prize], { coins: result.coins })}
          </div>
        ) : spin.isError ? (
          <div className="slots-result-text miss">{t(errorKey(spin.error))}</div>
        ) : null}
      </div>

      <button className="btn-primary slots-spin" disabled={!canSpin} onClick={start}>
        {spinning || spin.isPending ? t('slots.spinning') : left > 0 ? t('slots.spin') : t('slots.noSpins')}
      </button>
      <div className="slots-count">{t('slots.spinsToday', { left, total })}</div>
      <div className="slots-hint">{left > 0 ? t('slots.perCatch') : t('slots.noSpinsHint')}</div>
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
                <SlotSymbol key={i} symbol={symbol} size={22} />
              ))}
            </div>
            <div className="slots-pay-label">
              <div>{t(row.label)}</div>
              <div className="slots-pay-reward">
                {'coins' in row.reward ? (
                  <>
                    <CoinIcon size={16} /> {row.reward.coins}
                  </>
                ) : (
                  t(row.reward.text)
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
