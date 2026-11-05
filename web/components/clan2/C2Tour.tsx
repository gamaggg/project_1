'use client'

import { useEffect, useRef, useState } from 'react'
import { ClanCrest } from '@/components/app-shell/ClanCrest'
import type { TourStep } from '@/lib/clan2/tours'
import { useDemoState } from '@/lib/clan2/demoStore'
import { tn } from '@/lib/i18n/runtime'

// The spotlight tour, inside the phone of the preview: an introduction card,
// then each step dims the screen around one element and puts a note beside it.
// `onStep` moves the screen to where the step's element is (tab, section).

type Box = { x: number; y: number; w: number; h: number; ph: number }

export function C2Tour({ steps, onStep, onClose }: { steps: TourStep[]; onStep: (step: TourStep) => void; onClose: () => void }) {
  const s = useDemoState()
  const [i, setI] = useState(-1)
  const [box, setBox] = useState<Box | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const step = i >= 0 ? steps[i] : null

  useEffect(() => {
    if (!step) return
    onStep(step)
    const timer = window.setTimeout(() => {
      const phone = root.current?.closest('.c2-phone')
      const el = step.target ? phone?.querySelector<HTMLElement>(`[data-tour="${step.target}"]`) : null
      if (!phone || !el) {
        setBox(null)
        return
      }
      el.scrollIntoView({ block: 'center', behavior: 'auto' })
      window.setTimeout(() => {
        const p = phone.getBoundingClientRect()
        const r = el.getBoundingClientRect()
        setBox({ x: r.left - p.left, y: r.top - p.top, w: r.width, h: r.height, ph: p.height })
      }, 120)
    }, 380)
    return () => window.clearTimeout(timer)
    // onStep changes identity each render of the shell; the step is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  const last = i === steps.length - 1
  const cardBelow = !box || box.y + box.h / 2 < box.ph / 2
  const cardStyle = box ? (cardBelow ? { top: Math.min(box.y + box.h + 14, box.ph - 240) } : { bottom: Math.max(box.ph - box.y + 14, 100) }) : { top: 260 }

  return (
    <div className="c2-tour" ref={root}>
      {i < 0 ? (
        <div className="c2-tour-intro">
          <div className="c2-tour-crest">
            <ClanCrest crest={s.clan.crest} size={92} shine />
          </div>
          <h2>{tn('clan2.tour.introTitle')}</h2>
          <p>{tn('clan2.tour.introText')}</p>
          <button className="btn-primary" onClick={() => setI(0)}>
            {tn('clan2.tour.introStart')}
          </button>
          <button className="c2-link" onClick={onClose}>
            {tn('clan2.tour.skip')}
          </button>
        </div>
      ) : (
        <>
          {box ? <div className="c2-tour-spot" style={{ left: box.x - 6, top: box.y - 6, width: box.w + 12, height: box.h + 12 }} /> : <div className="c2-tour-dim" />}
          <div className="c2-tour-card" style={cardStyle} key={i}>
            <p>{step ? tn(step.text) : ''}</p>
            <div className="c2-tour-foot">
              <span className="c2-muted small">{tn('clan2.tour.of', { a: i + 1, b: steps.length })}</span>
              <span className="c2-tour-btns">
                {!last && (
                  <button className="c2-link" onClick={onClose}>
                    {tn('clan2.tour.skip')}
                  </button>
                )}
                <button className="c2-tour-next" onClick={() => (last ? onClose() : setI(i + 1))}>
                  {last ? tn('clan2.tour.done') : tn('clan2.tour.next')}
                </button>
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
