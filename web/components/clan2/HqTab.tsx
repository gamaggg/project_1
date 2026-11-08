'use client'

import { useState } from 'react'
import { DefenseShields } from '@/components/app-shell/SectorDefense'
import { C2Card, fmtLeft, useDemoNow } from '@/components/clan2/C2Common'
import { BaseScene } from '@/components/clan2/BaseScene'
import { canManage, siegeMinutesOf, useDemoState } from '@/lib/clan2/demoStore'
import { DAY, DEFENSE_MAX, HQ_LOOT_MAX, HQ_LOOT_SHARE, HQ_MOVE_COOLDOWN_DAYS, HQ_RUINS_HOURS, SIEGE_BREAK_REWARD } from '@/lib/clan2/rules'
import { hqBannerSvg } from '@/lib/clan2/live/hqMarker'
import { tn } from '@/lib/i18n/runtime'

// «Штаб»: the clan's headquarters (where, how strong, moving it), the base of buildings round it, and — last — how the
// headquarters is defended, as four steps that open one by one.

export type MapFocus = { sectorId?: string; place?: boolean }

export function HqTab({ onGoMap }: { onGoMap?: (focus?: MapFocus) => void }) {
  const s = useDemoState()
  const now = useDemoNow()
  const manage = canManage(s)
  const hq = s.hq
  const sector = s.sectors.find((x) => x.id === hq.sectorId)
  const coolLeft = hq.sectorId ? Math.max(0, (hq.lastMoveAt ?? hq.placedAt ?? 0) + HQ_MOVE_COOLDOWN_DAYS * DAY - now) : 0
  const ruinsOn = !!hq.ruins && now < hq.ruins.until

  return (
    <div className="c2-stack">
      <C2Card title={tn('clan2.hq.title')} tour="hq-card" focus="hq-card">
        {sector ? (
          <>
            <div className="c2-hq-head">
              {/* The same banner as on the map and on the base, so the HQ looks one way everywhere. */}
              <div className="c2-hq-crest banner" aria-hidden="true" dangerouslySetInnerHTML={{ __html: hqBannerSvg(s.clan.crest, 44, 65) }} />
              <div>
                <strong>{tn('clan2.hq.where', { id: sector.id })}</strong>
                <div className="c2-hq-shields">
                  <DefenseShields value={Math.min(DEFENSE_MAX, sector.defense)} size={16} />
                  <span className="c2-muted small">{tn('clan2.hq.defense', { n: Math.min(DEFENSE_MAX, sector.defense) })}</span>
                </div>
              </div>
            </div>
            {hq.siege && (
              <div className="c2-siege">
                <strong>{tn('clan2.hq.siege')}</strong>
                <span>{tn('clan2.hq.siegeLeft', { t: fmtLeft(hq.siege.endsAt - now) })}</span>
                <small>{tn('clan2.hq.siegeHow', { r: SIEGE_BREAK_REWARD })}</small>
              </div>
            )}
            <div className="c2-label">{tn('clan2.hq.perksTitle')}</div>
            <ul className="c2-perks">
              <li>{tn('clan2.hq.perk1')}</li>
              <li>{tn('clan2.hq.perk2')}</li>
              <li>{tn('clan2.hq.perk3')}</li>
            </ul>
            <div className="c2-row-btns">
              <button className="btn-secondary" onClick={() => onGoMap?.({ sectorId: sector.id })}>
                {tn('clan2.hq.onMap')}
              </button>
              {manage && (
                <button className="btn-secondary" disabled={coolLeft > 0 || s.treasury.balance < s.settings.hqMoveCost} onClick={() => onGoMap?.({ place: true })}>
                  {tn('clan2.hq.move')}
                </button>
              )}
            </div>
            <p className="c2-muted small" style={{ marginTop: 8 }}>
              {coolLeft > 0 ? `${tn('clan2.hq.moveCost', { n: s.settings.hqMoveCost })}. ${tn('clan2.hq.moveCooldown', { t: fmtLeft(coolLeft) })}` : tn('clan2.hq.moveCost', { n: s.settings.hqMoveCost })}
            </p>
          </>
        ) : (
          <>
            {ruinsOn ? (
              <div className="c2-ruins-card">
                <strong>{tn('clan2.hq.ruinsTitle', { id: hq.ruins!.sectorId })}</strong>
                <span>{tn('clan2.hq.ruinsBy', { by: hq.ruins!.by, n: hq.ruins!.loot })}</span>
                <span>{tn('clan2.hq.ruinsWait', { t: fmtLeft(hq.ruins!.until - now) })}</span>
                <small>{tn('clan2.hq.ruinsBuildings')}</small>
              </div>
            ) : (
              <>
                <p className="c2-muted">{tn('clan2.hq.none')}</p>
                <p className="c2-hint">{tn('clan2.hq.noneHint', { n: s.settings.hqPlaceCost })}</p>
              </>
            )}
            {manage ? (
              <>
                <button className="btn-primary" disabled={ruinsOn || s.treasury.balance < s.settings.hqPlaceCost} onClick={() => onGoMap?.({ place: true })}>
                  {tn('clan2.hq.place')}
                </button>
                {!ruinsOn && s.treasury.balance < s.settings.hqPlaceCost && <p className="c2-short">{tn('clan2.base.missing', { n: s.settings.hqPlaceCost - s.treasury.balance })}</p>}
              </>
            ) : (
              <p className="c2-hint faint">{tn('clan2.hq.placeLeaders')}</p>
            )}
          </>
        )}
      </C2Card>

      <C2Card title={tn('clan2.base.title')} hint={tn('clan2.base.hint')} tour="hq-buildings" focus="base">
        <BaseScene />
      </C2Card>

      <DefenseGuide siegeMin={siegeMinutesOf(s)} />
    </div>
  )
}

const STEPS = ['guard', 'attack', 'siege', 'fall'] as const
type Step = (typeof STEPS)[number]

function StepIcon({ id }: { id: Step }) {
  const p = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
  if (id === 'guard')
    return (
      <svg {...p}>
        <path d="M12 3l7.5 2.8v5.6c0 4.4-3 7.7-7.5 9.6-4.5-1.9-7.5-5.2-7.5-9.6V5.8z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    )
  if (id === 'attack')
    return (
      <svg {...p}>
        <path d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4" />
      </svg>
    )
  if (id === 'siege')
    return (
      <svg {...p}>
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l2.5 2.5M9 2h6" />
      </svg>
    )
  // the fall: the HQ's flag knocked over on the ground
  return (
    <svg {...p}>
      <path d="M3 21h18" />
      <path d="M6 20.5 17 9.5" />
      <path d="M17 9.5l1.2 5.8-5.6-1.6z" />
      <path d="M8 17.5l-1.6-1.6" />
    </svg>
  )
}

// «Как защищать штаб»: the four things that happen to a headquarters, in the order they happen; a step opens with a
// small picture of it (the shields filling, running out, the clock of the siege, what is lost).
function DefenseGuide({ siegeMin }: { siegeMin: number }) {
  const [open, setOpen] = useState<Step>('guard')
  return (
    <C2Card title={tn('clan2.hq.ruleTitle')} tour="hq-rules" focus="hq-rules">
      <div className="c2-steps-row" role="tablist">
        {STEPS.map((id, i) => (
          <button key={id} role="tab" aria-selected={open === id} className={open === id ? 'on' : undefined} onClick={() => setOpen(id)}>
            <span className="c2-step-ico" aria-hidden>
              <StepIcon id={id} />
            </span>
            <small>{i + 1}</small>
            <b>{tn(`clan2.hq.step_${id}`)}</b>
          </button>
        ))}
      </div>
      <div className="c2-defense" key={open}>
        {open === 'guard' && (
          <>
            <div className="c2-defense-pic" aria-hidden>
              {[1, 2, 3].map((n) => (
                <span key={n} className="c2-defense-stage">
                  <DefenseShields value={n} size={20} />
                  <small>{tn('clan2.hq.picCatch', { n })}</small>
                </span>
              ))}
            </div>
            <p>{tn('clan2.hq.rule1')}</p>
          </>
        )}
        {open === 'attack' && (
          <>
            {/* Three shields, a catch of an outsider takes one each; the catch after the last one starts the siege. */}
            <div className="c2-defense-pic four" aria-hidden>
              {[2, 1, 0].map((n, i) => (
                <span key={n} className="c2-defense-stage">
                  <DefenseShields value={n} size={18} />
                  <small>{tn('clan2.hq.picHit', { n: i + 1 })}</small>
                  <em>{n === 0 ? tn('clan2.hq.picNone') : tn('clan2.hq.picLeft', { n })}</em>
                </span>
              ))}
              <span className="c2-defense-stage siege">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="13" r="8" />
                  <path d="M12 9v4l2.5 2.5M9 2h6" />
                </svg>
                <small>{tn('clan2.hq.picHit', { n: 4 })}</small>
                <em>{tn('clan2.hq.picSiege')}</em>
              </span>
            </div>
            <p>{tn('clan2.hq.rule2')}</p>
          </>
        )}
        {open === 'siege' && (
          <>
            <div className="c2-defense-siege">
              <div className="c2-defense-clock" aria-hidden>
                <svg viewBox="0 0 64 64" width="64" height="64">
                  <circle cx="32" cy="32" r="27" fill="none" stroke="#F0EEEA" strokeWidth="7" />
                  <circle className="c2-defense-clock-run" cx="32" cy="32" r="27" fill="none" stroke="#FC5200" strokeWidth="7" strokeLinecap="round" pathLength={100} strokeDasharray="100" transform="rotate(-90 32 32)" />
                </svg>
                <b>{siegeMin}</b>
                <small>{tn('clan2.hq.picMin')}</small>
              </div>
              <p className="c2-defense-when">{tn('clan2.hq.siegeWhen')}</p>
            </div>
            <p>{tn('clan2.hq.rule3', { m: siegeMin, r: SIEGE_BREAK_REWARD })}</p>
            <div className="c2-defense-facts">
              <span className="challenge-fact">
                {tn('clan2.hq.picTime')}
                <b>{tn('clan2.hq.picTimeVal', { m: siegeMin })}</b>
              </span>
              <span className="challenge-fact">
                {tn('clan2.hq.picReward')}
                <b>+{SIEGE_BREAK_REWARD}</b>
              </span>
            </div>
          </>
        )}
        {open === 'fall' && (
          <div className="c2-fall-tiles">
            <span>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <ellipse cx="12" cy="6.5" rx="7" ry="3" />
                <path d="M5 6.5v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5M5 11.5v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" />
              </svg>
              <b>{tn('clan2.hq.fallT1', { p: Math.round(HQ_LOOT_SHARE * 100) })}</b>
              <small>{tn('clan2.hq.fallS1', { n: HQ_LOOT_MAX })}</small>
            </span>
            <span>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M7 3h10l5 9-5 9H7L2 12z" />
                <path d="M10 16V8l5 2-5 2" />
              </svg>
              <b>{tn('clan2.hq.fallT2')}</b>
              <small>{tn('clan2.hq.fallS2')}</small>
            </span>
            <span>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M3 11 12 3l9 8M5 9.5V20h14V9.5" />
                <path d="M15 5h3l-3 3h3" />
              </svg>
              <b>{tn('clan2.hq.fallT3')}</b>
              <small>{tn('clan2.hq.fallS3')}</small>
            </span>
            <span>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="13" r="8" />
                <path d="M12 9v4l2.5 2.5M9 2h6" />
              </svg>
              <b>{tn('clan2.hq.fallT4', { h: HQ_RUINS_HOURS })}</b>
              <small>{tn('clan2.hq.fallS4')}</small>
            </span>
          </div>
        )}
      </div>
    </C2Card>
  )
}
