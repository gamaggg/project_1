'use client'

import { createPortal } from 'react-dom'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/components/providers/AuthProvider'
import { useProfile, useSpinWheel } from '@/lib/supabase/queries'
import { CoinIcon } from '@/components/app-shell/CoinIcon'
import { CoinCountUp, LiveCoinBalance } from '@/components/app-shell/CoinCountUp'
import { hapticTap, hapticSuccess } from '@/lib/telegram/haptics'

// Must mirror spin_wheel's v_segments exactly, in the same order — the
// backend picks an index into this same 12-slot layout and the dial below
// rotates to land the pointer on that index, so the two arrays are really
// one contract split across the client/server boundary.
const SLOTS = [0, 0, 2, 0, 0, 2, 0, 0, 2, 0, 0, 3] as const
const SLICE_DEG = 360 / SLOTS.length
const EXTRA_TURNS = 5
const SPIN_MS = 3800

// The dial's own rotation is measured clockwise from the pointer at top (see
// the conic-gradient below, which uses the same convention). To land slot
// i's center under the pointer the wheel must turn by the complement of
// that slot's own clockwise offset from top.
function angleForSlot(i: number) {
  const center = i * SLICE_DEG + SLICE_DEG / 2
  return (360 - center + 360) % 360
}

const QUICK_BETS = [50, 100]
const MIN_BET = 10

// ДЭП — the Shop's wheel-of-fortune tab (see ShopScreen's CATEGORIES). All
// twelve slots are equally likely; three double the stake and one triples
// it, the rest take it — spin_wheel does the actual roll server-side so
// nothing here can be predicted or influenced from the client.
export function WheelScreen() {
  const { user } = useAuth()
  const { data: profile } = useProfile(user?.id ?? null)
  const coins = profile?.coins ?? 0
  const spin = useSpinWheel()
  const queryClient = useQueryClient()

  const [betInput, setBetInput] = useState('50')
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<{ multiplier: number; payout: number; bet: number } | null>(null)

  const bet = Math.max(0, Math.floor(Number(betInput) || 0))
  const belowMin = bet > 0 && bet < MIN_BET
  const canSpin = bet >= MIN_BET && bet <= coins && !spinning && !spin.isPending

  function setBet(v: number) {
    setBetInput(String(Math.max(MIN_BET, Math.floor(v))))
  }

  function handleSpin() {
    if (!canSpin) return
    hapticTap()
    setSpinning(true)
    setResult(null)
    spin.mutate(bet, {
      onSuccess: (res) => {
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        const target = angleForSlot(res.segmentIndex)
        setRotation((prev) => {
          const base = Math.ceil((prev + 1) / 360) * 360
          return reduceMotion ? base + target : base + EXTRA_TURNS * 360 + target
        })
        window.setTimeout(
          () => {
            setSpinning(false)
            setResult({ multiplier: res.multiplier, payout: res.payout, bet })
            if (res.payout > 0) hapticSuccess()
            // Balance/history refetch on the dial actually stopping, not on
            // the RPC resolving — see useSpinWheel's comment on why an
            // earlier refetch would spoil the reveal.
            queryClient.invalidateQueries({ queryKey: ['profile', user?.id] })
            queryClient.invalidateQueries({ queryKey: ['my-coin-transactions', user?.id ?? null] })
          },
          reduceMotion ? 50 : SPIN_MS
        )
      },
      onError: () => setSpinning(false),
    })
  }

  return (
    <div className="wheel-screen">
      <div className="wheel-stage">
        <div className="wheel-pointer" />
        <div className="wheel-dial" style={{ transform: `rotate(${rotation}deg)`, transitionDuration: spinning ? `${SPIN_MS}ms` : '0ms' }}>
          {SLOTS.map((_, i) => (
            <span key={i} className="wheel-peg" style={{ transform: `translate(-50%,-50%) rotate(${i * SLICE_DEG}deg) translateY(-124px)` }} />
          ))}
          {SLOTS.map((v, i) => (
            <span
              key={i}
              className={`wheel-label${v === 0 ? ' wheel-label-zero' : v === 3 ? ' wheel-label-jackpot' : ' wheel-label-x2'}`}
              style={{ transform: `translate(-50%,-50%) rotate(${i * SLICE_DEG + SLICE_DEG / 2}deg) translateY(-92px)` }}
            >
              {v === 0 ? '0' : `×${v}`}
            </span>
          ))}
          <div className="wheel-hub">
            <CoinIcon size={28} />
          </div>
        </div>
      </div>

      <div className="wheel-bet-panel">
        <label className="wheel-bet-label">Ставка</label>
        <div className="wheel-bet-row">
          <input
            className="wheel-bet-input"
            type="text"
            inputMode="numeric"
            value={betInput}
            onChange={(e) => setBetInput(e.target.value.replace(/[^0-9]/g, ''))}
            disabled={spinning}
          />
          <CoinIcon size={16} />
        </div>
        <div className="wheel-quick-row">
          {QUICK_BETS.map((v) => (
            <button key={v} type="button" className="wheel-quick-btn" onClick={() => setBet(v)} disabled={spinning}>
              {v}
            </button>
          ))}
          <button type="button" className="wheel-quick-btn" onClick={() => setBet(bet > 0 ? bet * 2 : 50)} disabled={spinning}>
            ×2
          </button>
        </div>
        <button className="btn-primary wheel-spin-btn" onClick={handleSpin} disabled={!canSpin}>
          {spinning ? 'Крутится…' : bet > coins ? 'Не хватает монет' : belowMin ? `Минимум ${MIN_BET} монет` : 'Крутить'}
        </button>
        <div className="wheel-balance">
          На счету <LiveCoinBalance value={coins} /> <CoinIcon size={16} />
        </div>
      </div>

      {result && <WheelResultModal multiplier={result.multiplier} payout={result.payout} bet={result.bet} onClose={() => setResult(null)} />}
    </div>
  )
}

function WheelResultModal({ multiplier, payout, bet, onClose }: { multiplier: number; payout: number; bet: number; onClose: () => void }) {
  const won = payout > 0

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card wheel-result-card" onClick={(e) => e.stopPropagation()}>
        {won ? (
          <>
            <div className="wheel-result-mult">×{multiplier}</div>
            <div className="modal-title" style={{ textAlign: 'center' }}>
              Выигрыш!
            </div>
            <div className="wheel-result-coins">
              <CoinCountUp from={0} to={payout} size={56} animated={false} />
            </div>
          </>
        ) : (
          <>
            <div className="wheel-result-mult wheel-result-mult-zero">0</div>
            <div className="modal-title" style={{ textAlign: 'center' }}>
              Пусто
            </div>
            <div className="wheel-result-sub">Ставка {bet} сгорела — повезёт в следующий раз</div>
          </>
        )}
        <button className="btn-primary" style={{ marginTop: 16 }} onClick={onClose}>
          Ещё раз
        </button>
      </div>
    </div>,
    document.body
  )
}
