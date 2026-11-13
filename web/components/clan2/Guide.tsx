'use client'

import { useState } from 'react'
import { C2Card, C2Sheet } from '@/components/clan2/C2Common'
import { buildingsOn, canManage, capOf, useDemoState } from '@/lib/clan2/demoStore'
import { hqBannerSvg } from '@/lib/clan2/live/hqMarker'
import { BUILD_CLAN_LEVEL, fmt } from '@/lib/clan2/rules'
import { tn } from '@/lib/i18n/runtime'
import { CoinIcon } from '@/components/app-shell/CoinIcon'

// What makes the clan update readable for somebody who has never seen it: four steps of how the whole thing works
// (each one opens), and one card that says what to do next.

// Where a button of the clan screens takes the player: a tab, and the very block on it (the screen scrolls to it).
export type Go = 'map' | 'hq' | 'base' | 'storage' | 'week' | 'exit' | 'treasury' | 'shop'

const STEPS = ['rent', 'save', 'build', 'defend'] as const

// «Как это работает»: the four steps in a row; tapping one opens a small moving picture of it, with the game's own
// numbers (rent per day, the shared and HQ sectors, the treasury's cap, the building levels), and one line of text.
export function HowItWorks({ onTour }: { onTour?: () => void } = {}) {
  const [open, setOpen] = useState<(typeof STEPS)[number]>('rent')
  const s = useDemoState()
  const per = s.settings.rentPerSectorDay
  return (
    <C2Card
      title={tn('clan2.guide.howTitle')}
      tour="how-it-works"
      focus="how-it-works"
      right={
        onTour ? (
          <button type="button" className="c2-link" onClick={onTour}>
            {tn('clan2.guide.tourAgain')}
          </button>
        ) : undefined
      }
    >
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
      <div className="c2-how" key={open}>
        {open === 'rent' && (
          <div className="c2-how-rent" aria-hidden>
            {/* Each sector gives off its «+1» as often as it pays (a shared one half as often again, the HQ's twice),
                once through, and stops on the day's total. */}
            {[
              { k: 'plain', n: per, ups: 2 },
              { k: 'shared', n: Math.round(per * s.settings.sharedRentFactor), ups: 3 },
              { k: 'hq', n: per * 2, ups: 4 },
            ].map((x) => (
              <span key={x.k} className={`c2-how-sector ${x.k}`}>
                <span className="c2-how-hex hex-aspect hex-shape" style={{ ['--c' as string]: s.clan.crest.primary }}>
                  {x.k === 'hq' && <span className="c2-how-flag" dangerouslySetInnerHTML={{ __html: hqBannerSvg(s.clan.crest, 16, 24) }} />}
                </span>
                {Array.from({ length: x.ups }).map((_, j) => (
                  <i key={j} className="c2-how-plus" style={{ animationDelay: `${0.2 + j * (2.2 / x.ups)}s` }}>
                    +1
                    <CoinIcon size={16} />
                  </i>
                ))}
                <b>+{x.n}</b>
                <small>{tn(`clan2.guide.rent_${x.k as 'plain' | 'shared' | 'hq'}`)}</small>
              </span>
            ))}
          </div>
        )}
        {open === 'save' && (
          <div className="c2-how-save" aria-hidden>
            <div className="c2-how-chips">
              {(['rent', 'tax', 'deposit', 'rewards'] as const).map((k, i) => (
                <span key={k} style={{ animationDelay: `${i * 0.12}s` }}>
                  {tn(`clan2.guide.src_${k}`)}
                </span>
              ))}
            </div>
            <div className="c2-how-capline">
              <span>0</span>
              <span>{tn('clan2.guide.capLine', { n: fmt(capOf(s)) })}</span>
            </div>
            <div className="c2-how-vault">
              <i className="c2-how-fill" />
            </div>
          </div>
        )}
        {open === 'build' && (
          <div className="c2-how-build" aria-hidden>
            {[1, 2, 3].map((n) => (
              <span key={n} className="c2-how-level" style={{ animationDelay: `${(n - 1) * 0.7}s` }}>
                <b>{n}</b>
                <small>{tn('clan2.guide.levelFrom', { n: BUILD_CLAN_LEVEL[n - 1] })}</small>
              </span>
            ))}
            <span className="c2-how-one">{tn('clan2.guide.oneAtATime')}</span>
          </div>
        )}
        {open === 'defend' && (
          <div className="c2-how-defend" aria-hidden>
            <span className="c2-how-banner" dangerouslySetInnerHTML={{ __html: hqBannerSvg(s.clan.crest, 40, 59) }} />
            <span className="c2-how-shields">
              {[0, 1, 2].map((i) => (
                <svg key={i} width="18" height="22" viewBox="3.5 1.5 17 21" style={{ animationDelay: `${i * 0.25}s` }}>
                  <path d="M12 2.5l7.5 2.8v5.6c0 4.7-3.2 8.3-7.5 10.6-4.3-2.3-7.5-5.9-7.5-10.6V5.3z" />
                </svg>
              ))}
            </span>
            <span className="c2-how-buildings">{tn('clan2.guide.whileHq')}</span>
          </div>
        )}
        <p className="c2-step-text">{tn(`clan2.guide.t_${open}`)}</p>
      </div>
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
    to = 'base'
  } else if (questReady) {
    // No «выбери цель» step: the treasury card right above already has its own «Выбрать, на что копить» button (the
    // owner saw the same thing twice, 13.11).
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
