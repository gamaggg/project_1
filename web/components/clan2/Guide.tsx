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
  const coin = (x: number, y: number, k: string) => (
    <g key={k}>
      <ellipse cx={x} cy={y + 2.4} rx={9} ry={4.2} fill="#B57A10" />
      <ellipse cx={x} cy={y} rx={9} ry={4.2} fill="url(#c2c-gold)" stroke="#8A5A06" strokeWidth={0.8} />
      <path d={`M ${x - 3} ${y - 0.4} l 3 -1.6 l 3 1.6`} stroke="#B57A10" strokeWidth={1} fill="none" strokeLinecap="round" />
    </g>
  )
  return (
    <button type="button" className={`c2-chest${open ? ' open' : ''}`} onClick={onClick} aria-label={tn('clan2.guide.chestAria')}>
      <svg viewBox="0 0 220 150" aria-hidden>
        <defs>
          <linearGradient id="c2c-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FFE9A0" />
            <stop offset="1" stopColor="#F0B53E" />
          </linearGradient>
          <linearGradient id="c2c-wood" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#B27A40" />
            <stop offset="1" stopColor="#7C5028" />
          </linearGradient>
        </defs>
        <ellipse cx={110} cy={134} rx={84} ry={9} fill="rgba(40,30,10,.25)" />
        {/* The heap of coins behind the front wall. */}
        {Array.from({ length: rows }).map((_, r) => {
          const n = Math.max(1, 5 - Math.floor(r * 0.8))
          return Array.from({ length: n }).map((__, i) => coin(110 + (i - (n - 1) / 2) * 15 + (r % 2 ? 4 : -3), 78 - r * 8.5, `${r}-${i}`))
        })}
        {/* The body of the chest. */}
        <rect x={28} y={78} width={164} height={52} rx={7} fill="url(#c2c-wood)" stroke="#5B3A18" strokeWidth={2} />
        {[34, 70, 110, 150, 186].map((x) => (
          <rect key={x} x={x - 1} y={80} width={2.2} height={48} fill="#5B3A18" opacity={0.25} />
        ))}
        <rect x={52} y={78} width={13} height={52} fill="#D8DEE8" stroke="#8993A5" strokeWidth={1.4} />
        <rect x={155} y={78} width={13} height={52} fill="#D8DEE8" stroke="#8993A5" strokeWidth={1.4} />
        <rect x={98} y={88} width={24} height={26} rx={5} fill="url(#c2c-gold)" stroke="#8A5A06" strokeWidth={1.6} />
        <circle cx={110} cy={99} r={3.4} fill="#8A5A06" />
        <rect x={108.6} y={99} width={2.8} height={8} rx={1.2} fill="#8A5A06" />
        {/* The lid: shut, or lifted on its hinge. */}
        <g className="c2-chest-lid" style={{ transformOrigin: '110px 80px' }}>
          <path d="M 28 78 q 0 -34 82 -34 q 82 0 82 34 z" fill="url(#c2c-wood)" stroke="#5B3A18" strokeWidth={2} />
          <path d="M 52 78 q 0 -30 58 -33 l 0 33 z" fill="rgba(255,255,255,.08)" />
          <rect x={52} y={50} width={13} height={28} fill="#D8DEE8" stroke="#8993A5" strokeWidth={1.4} />
          <rect x={155} y={50} width={13} height={28} fill="#D8DEE8" stroke="#8993A5" strokeWidth={1.4} />
        </g>
        {open &&
          [
            [60, 40],
            [168, 36],
            [118, 22],
          ].map(([x, y], i) => (
            <path key={i} className="c2-spark-star" style={{ animationDelay: `${i * 0.7}s` }} d={`M ${x} ${y - 6} l 1.8 4.2 l 4.2 1.8 l -4.2 1.8 l -1.8 4.2 l -1.8 -4.2 l -4.2 -1.8 l 4.2 -1.8 z`} fill="#FFF1B8" />
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
  if (id === 'rent')
    return (
      <svg {...common}>
        <path d="M7 3h10l5 9-5 9H7L2 12z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    )
  if (id === 'save')
    return (
      <svg {...common}>
        <rect x="3" y="9" width="18" height="11" rx="2" />
        <path d="M3 13h18M12 9V6a3 3 0 0 0-6 0M12 15v2" />
      </svg>
    )
  if (id === 'build')
    return (
      <svg {...common}>
        <path d="M14 6 6 14l4 4 8-8zM14 6l3-3 4 4-3 3M4 20l2-2" />
      </svg>
    )
  return (
    <svg {...common}>
      <path d="M6 21V4M6 5h12l-3 4 3 4H6" />
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
