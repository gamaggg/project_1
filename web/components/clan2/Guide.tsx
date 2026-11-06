'use client'

import { useState } from 'react'
import { C2Card, C2Sheet } from '@/components/clan2/C2Common'
import { buildingsOn, canManage, useDemoState } from '@/lib/clan2/demoStore'
import { tn } from '@/lib/i18n/runtime'

// What makes the clan update readable for somebody who has never seen it: a chest that fills up with the treasury,
// four steps of how the whole thing works (each one opens), and one card that says what to do next.

export type Go = 'map' | 'hq' | 'week' | 'exit' | 'treasury'

// The treasure chest: the lid lifts when there is something in it, the heap of coins grows with how full the
// treasury is (balance / cap), and a few sparks twinkle over it.
export function TreasureChest({ ratio, onClick }: { ratio: number; onClick?: () => void }) {
  const rows = ratio <= 0 ? 0 : Math.max(1, Math.round(ratio * 6))
  const open = rows > 0
  const coin = (x: number, y: number, k: string, shine = false) => (
    <g key={k}>
      <ellipse cx={x} cy={y + 3} rx={10} ry={4.6} fill="#9A6408" />
      <ellipse cx={x} cy={y} rx={10} ry={4.6} fill="url(#c2c-gold)" stroke="#8A5A06" strokeWidth={0.9} />
      <ellipse cx={x} cy={y} rx={6.4} ry={2.8} fill="none" stroke="#C98F1E" strokeWidth={0.9} />
      <path d={`M ${x - 4} ${y - 1.6} q 3 -2.2 6 -0.4`} stroke="#FFF7D6" strokeWidth={1.2} fill="none" strokeLinecap="round" opacity={0.9} />
      {shine && <ellipse className="c2-coin-shine" cx={x} cy={y} rx={10} ry={4.6} fill="url(#c2c-sheen)" />}
    </g>
  )
  const rivets = (x0: number, x1: number, y: number, n: number) =>
    Array.from({ length: n }).map((_, i) => <circle key={`${x0}-${i}`} cx={n > 1 ? x0 + ((x1 - x0) / (n - 1)) * i : x0} cy={y} r={1.5} fill="#EEF1F7" stroke="#7B8598" strokeWidth={0.6} />)
  return (
    <button type="button" className={`c2-chest${open ? ' open' : ''}`} onClick={onClick} aria-label={tn('clan2.guide.chestAria')}>
      <svg viewBox="0 0 240 170" aria-hidden>
        <defs>
          <linearGradient id="c2c-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FFF0B0" />
            <stop offset="0.55" stopColor="#F5C24A" />
            <stop offset="1" stopColor="#D79A1E" />
          </linearGradient>
          <linearGradient id="c2c-sheen" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0.85" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="c2c-wood" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#C58A4C" />
            <stop offset="0.5" stopColor="#A06A33" />
            <stop offset="1" stopColor="#6E4521" />
          </linearGradient>
          <linearGradient id="c2c-lid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#D9A062" />
            <stop offset="1" stopColor="#8D5A2B" />
          </linearGradient>
          <linearGradient id="c2c-metal" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#AEB7C8" />
            <stop offset="0.45" stopColor="#F2F5FA" />
            <stop offset="1" stopColor="#8993A8" />
          </linearGradient>
          <radialGradient id="c2c-glow" cx="0.5" cy="0.62" r="0.55">
            <stop offset="0" stopColor="#FFE9A0" stopOpacity="0.95" />
            <stop offset="1" stopColor="#FFE9A0" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="c2c-inside" cx="0.5" cy="0.4" r="0.6">
            <stop offset="0" stopColor="#7A4B20" />
            <stop offset="1" stopColor="#2F1C0A" />
          </radialGradient>
        </defs>
        {/* The glow of the gold behind the chest, breathing slowly, and a few slow rays. */}
        {open && (
          <g className="c2-chest-aura">
            <ellipse cx={120} cy={92} rx={118} ry={78} fill="url(#c2c-glow)" />
            <g className="c2-chest-rays" style={{ transformOrigin: '120px 92px' }}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <path key={i} d="M 120 92 L 112 6 L 128 6 z" fill="#FFE9A0" opacity={0.2} transform={`rotate(${i * 60 - 150} 120 92)`} />
              ))}
            </g>
          </g>
        )}
        <ellipse cx={120} cy={150} rx={94} ry={10} fill="rgba(40,30,10,.26)" />
        {/* The inside of the chest and the heap of coins. */}
        <path d="M 38 90 q 82 -10 164 0 l -6 18 h -152 z" fill="url(#c2c-inside)" />
        {Array.from({ length: rows }).map((_, r) => {
          const n = Math.max(1, 6 - Math.floor(r * 0.9))
          return Array.from({ length: n }).map((__, i) => coin(120 + (i - (n - 1) / 2) * 16 + (r % 2 ? 5 : -4), 96 - r * 9, `${r}-${i}`, r === rows - 1 && i === 0))
        })}
        {/* The body. */}
        <rect x={30} y={92} width={180} height={56} rx={9} fill="url(#c2c-wood)" stroke="#4D2F13" strokeWidth={2.2} />
        {[48, 78, 108, 138, 168, 198].map((x) => (
          <path key={x} d={`M ${x} 94 v 52`} stroke="#4D2F13" strokeWidth={1.2} opacity={0.28} />
        ))}
        <rect x={32} y={94} width={176} height={7} rx={3} fill="#fff" opacity={0.16} />
        <rect x={32} y={140} width={176} height={6} rx={3} fill="#000" opacity={0.18} />
        {[56, 168].map((x) => (
          <g key={x}>
            <rect x={x} y={92} width={16} height={56} fill="url(#c2c-metal)" stroke="#6C778C" strokeWidth={1.4} />
            {rivets(x + 8, x + 8, 100, 1)}
            {rivets(x + 8, x + 8, 140, 1)}
          </g>
        ))}
        <rect x={104} y={101} width={32} height={34} rx={7} fill="url(#c2c-gold)" stroke="#8A5A06" strokeWidth={1.8} />
        <rect x={107} y={104} width={26} height={9} rx={4} fill="#fff" opacity={0.35} />
        <circle cx={120} cy={116} r={4.4} fill="#7A4E08" />
        <path d="M 117.8 116 h 4.4 l 1.4 11 h -7.2 z" fill="#7A4E08" />
        {/* The lid: shut, or lifted on its hinge. */}
        <g className="c2-chest-lid" style={{ transformOrigin: '120px 94px' }}>
          <path d="M 30 94 q 0 -40 90 -40 q 90 0 90 40 z" fill="url(#c2c-lid)" stroke="#4D2F13" strokeWidth={2.2} />
          <path d="M 44 90 q 4 -26 62 -30" stroke="#fff" strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.22} />
          {[56, 168].map((x) => (
            <g key={x}>
              <path d={`M ${x} 94 q -1 -26 8 -37 h 8 q 1 12 0 37 z`} fill="url(#c2c-metal)" stroke="#6C778C" strokeWidth={1.4} />
              {rivets(x + 8, x + 8, 66, 1)}
              {rivets(x + 8, x + 8, 86, 1)}
            </g>
          ))}
          <rect x={30} y={90} width={180} height={6} rx={3} fill="#4D2F13" opacity={0.4} />
        </g>
        {open &&
          [
            [52, 52, 1],
            [196, 46, 0.8],
            [128, 24, 1.1],
            [88, 36, 0.7],
          ].map(([x, y, k], i) => (
            <path key={i} className="c2-spark-star" style={{ animationDelay: `${i * 0.6}s`, transformOrigin: `${x}px ${y}px` }} d={`M ${x} ${y - 7 * k} l ${2 * k} ${5 * k} l ${5 * k} ${2 * k} l -${5 * k} ${2 * k} l -${2 * k} ${5 * k} l -${2 * k} -${5 * k} l -${5 * k} -${2 * k} l ${5 * k} -${2 * k} z`} fill="#FFF3C0" />
          ))}
      </svg>
    </button>
  )
}

const STEPS = ['rent', 'save', 'build', 'defend'] as const

// «Как это работает»: the four steps in a row; tapping one opens what it means.
export function HowItWorks() {
  const [open, setOpen] = useState<(typeof STEPS)[number]>('rent')
  return (
    <C2Card title={tn('clan2.guide.howTitle')} tour="how-it-works">
      <div className="c2-steps-row" role="tablist">
        {STEPS.map((id, i) => (
          <button key={id} role="tab" aria-selected={open === id} className={open === id ? 'on' : undefined} onClick={() => setOpen(id)}>
            <span className="c2-step-ico" aria-hidden>
              <StepIcon id={id} />
            </span>
            <small>{i + 1}</small>
            <b>{tn(`clan2.guide.s_${id}`)}</b>
          </button>
        ))}
      </div>
      <p className="c2-step-text" key={open}>
        {tn(`clan2.guide.t_${open}`)}
      </p>
    </C2Card>
  )
}

function StepIcon({ id }: { id: (typeof STEPS)[number] }) {
  const common = { width: 26, height: 26, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
  // rent: a sector with a coin on it; save: a stack of coins; build: a house; defend: a shield with a flag.
  if (id === 'rent')
    return (
      <svg {...common}>
        <path d="M7 3h10l5 9-5 9H7L2 12z" />
        <circle cx="12" cy="12" r="3.4" />
        <path d="M12 10.6v2.8M10.9 12h2.2" />
      </svg>
    )
  if (id === 'save')
    return (
      <svg {...common}>
        <ellipse cx="12" cy="6.5" rx="7" ry="3" />
        <path d="M5 6.5v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" />
        <path d="M5 11.5v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" />
      </svg>
    )
  if (id === 'build')
    return (
      <svg {...common}>
        <path d="M3 11 12 3l9 8M5 9.5V20h14V9.5M10 20v-5.5h4V20" />
      </svg>
    )
  return (
    <svg {...common}>
      <path d="M12 3l7.5 2.8v5.6c0 4.4-3 7.7-7.5 9.6-4.5-1.9-7.5-5.2-7.5-9.6V5.8z" />
      <path d="M10 9v6M10 9.2h4.5l-1.2 1.6 1.2 1.6H10" />
    </svg>
  )
}

// One card: the single thing that is worth doing now, with a button that takes the player there.
export function NextStep({ onGo }: { onGo?: (to: Go) => void }) {
  const s = useDemoState()
  const manage = canManage(s)
  const hq = buildingsOn(s)
  const built = Object.values(s.projects).some((l) => l > 0) || !!s.build
  const questReady = !s.quest.claimed && s.quest.progress >= s.quest.target
  let key: 'hq' | 'build' | 'goal' | 'quest' | 'buff' | 'keep' = 'keep'
  let to: Go = 'treasury'
  if (!hq && !s.hq.ruins) {
    key = 'hq'
    to = 'map'
  } else if (hq && !built) {
    key = 'build'
    to = 'hq'
  } else if (!s.treasury.goalId) {
    key = 'goal'
    to = 'treasury'
  } else if (questReady) {
    key = 'quest'
    to = 'week'
  } else if (s.buff.phase === 'idle') {
    key = 'buff'
    to = 'exit'
  }
  if (!manage && key !== 'keep' && key !== 'quest') key = 'keep'
  return (
    <div className="c2-next" data-tour="next-step">
      <small>{tn('clan2.guide.nextKicker')}</small>
      <b>{tn(`clan2.guide.next_${key}`)}</b>
      <p>{tn(`clan2.guide.nextText_${key}`)}</p>
      {key !== 'keep' && onGo && (
        <button className="btn-primary" onClick={() => onGo(to)}>
          {tn(`clan2.guide.nextBtn_${key}`)}
        </button>
      )}
    </div>
  )
}

// The first time a player opens the clan's new sections: the same four steps, one after another.
export function IntroSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [i, setI] = useState(0)
  const id = STEPS[i]
  return (
    <C2Sheet open={open} onClose={onClose} title={tn('clan2.guide.introTitle')}>
      <div className="c2-intro">
        <div className="c2-intro-ico" aria-hidden>
          <StepIcon id={id} />
        </div>
        <small>
          {i + 1} / {STEPS.length}
        </small>
        <b>{tn(`clan2.guide.s_${id}`)}</b>
        <p key={id}>{tn(`clan2.guide.t_${id}`)}</p>
        <div className="c2-intro-dots" aria-hidden>
          {STEPS.map((x, k) => (
            <i key={x} className={k === i ? 'on' : undefined} />
          ))}
        </div>
        <div className="c2-row-btns">
          <button className="btn-secondary" onClick={onClose}>
            {tn('clan2.guide.skip')}
          </button>
          <button
            className="btn-primary"
            onClick={() => {
              if (i < STEPS.length - 1) setI(i + 1)
              else onClose()
            }}
          >
            {i < STEPS.length - 1 ? tn('clan2.guide.next') : tn('clan2.guide.done')}
          </button>
        </div>
      </div>
    </C2Sheet>
  )
}
