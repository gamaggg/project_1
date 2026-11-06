'use client'

import { useEffect, useRef, useState } from 'react'
import { ART } from '@/components/clan2/BaseArt'
import { C2Bar, C2Coins, fmtLeft, useC2, useDemoNow } from '@/components/clan2/C2Common'
import { buildingsOn, canManage, speedUpBuild, speedupPrice, upgradeProject, useDemoState } from '@/lib/clan2/demoStore'
import { BUILD_CLAN_LEVEL, BUILD_HOURS, PROJECTS, PROJECT_EFFECTS, PROJECT_IDS } from '@/lib/clan2/rules'
import type { ProjectId, ProjectLevel } from '@/lib/clan2/types'
import { crestSvgMarkup } from '@/lib/data/clanCrests'
import { tn, tnd } from '@/lib/i18n/runtime'

// «База клана»: the clan's own sector, seen from above — the headquarters in the middle and six plots round it,
// one for every building. The sector has the shape of every sector of the game (hex-aspect hex-shape). A building
// is drawn bigger and richer with each level; one that can be built stands there as a ghost with a «+»; while it is
// being built the scaffolding stands and a ring counts the time down; with the headquarters down they all sleep.

const CX = 200
const CY = 173
// The plots, clockwise from the top: where each building stands on the 400 x 346 sector.
const SPOTS: Record<ProjectId, { x: number; y: number }> = {
  beacon: { x: 200, y: 92 },
  market: { x: 303, y: 143 },
  board: { x: 303, y: 238 },
  storage: { x: 200, y: 298 },
  dock: { x: 97, y: 238 },
  fort: { x: 97, y: 143 },
}

// What a building gives at a level, as a phrase (level 0: nothing yet).
export function effectText(id: ProjectId, level: ProjectLevel): string {
  if (level === 0) return tn('clan2.project.none')
  switch (id) {
    case 'dock':
      return tn('clan2.project.dock.eff', { n: PROJECT_EFFECTS.dock.slots[level] })
    case 'beacon':
      return tn('clan2.project.beacon.eff', { n: PROJECT_EFFECTS.beacon.siegeMinutes[level] })
    case 'fort':
      return tn('clan2.project.fort.eff', { n: PROJECT_EFFECTS.fort.decayDays[level] })
    case 'board':
      return tn('clan2.project.board.eff', { p: PROJECT_EFFECTS.board.questPct[level] })
    case 'storage':
      return tn('clan2.project.storage.eff', { n: PROJECT_EFFECTS.storage.cap[level].toLocaleString('ru-RU').replace(/ | /g, ' ') })
    case 'market':
      return tn('clan2.project.market.eff', { p: PROJECT_EFFECTS.market.rentPct[level] })
  }
}

const hexPoints = (k: number) =>
  [
    [100, 0],
    [300, 0],
    [400, 173.2],
    [300, 346.4],
    [100, 346.4],
    [0, 173.2],
  ]
    .map(([x, y]) => `${CX + (x - CX) * k},${CY + (y - CY) * k}`)
    .join(' ')

export function BaseScene() {
  const s = useDemoState()
  const now = useDemoNow()
  const { act } = useC2()
  const manage = canManage(s)
  const on = buildingsOn(s)
  const [sel, setSel] = useState<ProjectId>('dock')
  const [built, setBuilt] = useState<{ id: ProjectId; n: number } | null>(null)
  const prev = useRef(s.projects)
  const crest = s.clan.crest
  const ruins = s.hq.ruins && now < s.hq.ruins.until ? s.hq.ruins : null

  // A level that has just arrived is played as a finished build.
  useEffect(() => {
    for (const id of PROJECT_IDS) {
      if (s.projects[id] > prev.current[id]) {
        setBuilt({ id, n: Date.now() })
        setSel(id)
        const t = window.setTimeout(() => setBuilt((b) => (b && b.id === id ? null : b)), 1800)
        prev.current = s.projects
        return () => window.clearTimeout(t)
      }
    }
    prev.current = s.projects
  }, [s.projects])

  const level = s.projects[sel]
  const next = level < 3 ? ((level + 1) as 1 | 2 | 3) : null
  const cost = level < 3 ? PROJECTS[sel].costs[level as 0 | 1 | 2] : 0
  const needLevel = level < 3 ? BUILD_CLAN_LEVEL[level as 0 | 1 | 2] : 0
  const buildHours = level < 3 ? BUILD_HOURS[sel][level as 0 | 1 | 2] : 0
  const levelOk = s.clan.level >= needLevel
  const moneyOk = s.treasury.balance >= cost
  const busy = !!s.build
  const building = s.build?.id === sel ? s.build : null
  const can = !!next && on && levelOk && moneyOk && !busy && manage

  return (
    <div className="c2-base">
      <div className="c2-base-hex hex-aspect hex-shape" data-tour="base-scene">
        <svg className="c2-base-svg" viewBox="0 0 400 346.4" role="group" aria-label={tn('clan2.base.title')}>
          <defs>
            <linearGradient id="c2b-sea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#9ED0EC" />
              <stop offset="1" stopColor="#5FA6D2" />
            </linearGradient>
            <radialGradient id="c2b-grass" cx="0.5" cy="0.45" r="0.75">
              <stop offset="0" stopColor="#E8F2C6" />
              <stop offset="0.7" stopColor="#CFE3A0" />
              <stop offset="1" stopColor="#B7D184" />
            </radialGradient>
            <radialGradient id="c2b-plaza" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#FFF4D6" />
              <stop offset="1" stopColor="#E9D3A0" />
            </radialGradient>
          </defs>
          <polygon points={hexPoints(1)} fill="url(#c2b-sea)" />
          {[0, 1, 2, 3, 4].map((i) => (
            <path key={i} className="c2-wave" style={{ animationDelay: `${i * -1.3}s` }} d={`M ${20 + i * 70} ${18 + (i % 2) * 8} q 12 -7 24 0 t 24 0`} fill="none" stroke="rgba(255,255,255,.8)" strokeWidth={1.6} strokeLinecap="round" />
          ))}
          <polygon points={hexPoints(0.9)} fill="#E7D9AE" />
          <polygon points={hexPoints(0.86)} fill="url(#c2b-grass)" stroke="#A9BE7A" strokeWidth={1.4} />
          {/* Paths from the headquarters to every plot, and the plaza round it. */}
          {PROJECT_IDS.map((id) => (
            <path key={id} d={`M ${CX} ${CY} L ${SPOTS[id].x} ${SPOTS[id].y - 8}`} stroke="#E4D2A0" strokeWidth={9} strokeLinecap="round" opacity={0.85} />
          ))}
          <circle cx={CX} cy={CY} r={46} fill="url(#c2b-plaza)" stroke="#CDB57A" strokeWidth={2} />
          <circle cx={CX} cy={CY} r={38} fill="none" stroke="#D8C28C" strokeWidth={1} strokeDasharray="3 4" />

          {/* The headquarters. */}
          <g transform={`translate(${CX} ${CY + 22})`}>
            <ellipse cx={0} cy={3} rx={36} ry={7} fill="rgba(40,30,10,.25)" />
            {ruins ? (
              <g>
                <path d="M -30 0 L -26 -20 L -16 -12 L -10 -28 L 0 -14 L 8 -24 L 18 -10 L 28 0 z" fill="#B7AB93" stroke="#7A705E" strokeWidth={1.4} />
                <path className="c2-smoke" d="M -2 -26 q -7 -12 2 -22 q 9 -9 0 -20" fill="none" stroke="rgba(70,70,70,.5)" strokeWidth={5} strokeLinecap="round" />
              </g>
            ) : (
              <g className={on ? 'c2-hqtower' : undefined}>
                <rect x={-26} y={-44} width={52} height={44} rx={4} fill={STONE_HQ} stroke="#9BA3B3" strokeWidth={1.4} />
                <rect x={-26} y={-44} width={52} height={7} rx={3} fill="#fff" opacity={0.65} />
                {[-26, -12, 2, 16].map((x) => (
                  <rect key={x} x={x} y={-52} width={10} height={9} rx={1} fill={STONE_HQ} stroke="#9BA3B3" strokeWidth={1} />
                ))}
                <path d="M -9 0 v -17 a 9 9 0 0 1 18 0 v 17 z" fill="#3A2A18" />
                <g transform="translate(-15 -42)" dangerouslySetInnerHTML={{ __html: crestSvgMarkup(crest, 30) }} />
                <rect x={-1.2} y={-82} width={2.4} height={30} fill="#6F4A24" />
                <path className="c2-flag" d="M 1.2 -82 l 24 6 l -24 6 z" fill={crest.secondary} stroke="#fff" strokeWidth={1} />
                <circle cx={0} cy={-84} r={2.6} fill="#F0B53E" />
              </g>
            )}
          </g>
          <text x={CX} y={CY + 56} textAnchor="middle" className="c2-scene-label">
            {ruins ? tn('clan2.base.ruins') : tn('clan2.base.hq')}
          </text>

          {PROJECT_IDS.map((id) => {
            const pos = SPOTS[id]
            const lv = s.projects[id]
            const Art = ART[id]
            const isSel = sel === id
            const under = s.build?.id === id ? s.build : null
            const gate = lv < 3 ? BUILD_CLAN_LEVEL[lv as 0 | 1 | 2] : 0
            const locked = !under && lv < 3 && s.clan.level < gate
            const progress = under ? Math.min(1, Math.max(0, (now - under.startedAt) / (under.endsAt - under.startedAt))) : 0
            return (
              <g
                key={id}
                className={`c2-plot${isSel ? ' sel' : ''}${on ? '' : ' asleep'}`}
                transform={`translate(${pos.x} ${pos.y})`}
                role="button"
                tabIndex={0}
                aria-label={`${tnd(`clan2.project.${id}.name`)} ${lv}/3`}
                onClick={() => setSel(id)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSel(id)}
              >
                <ellipse cx={0} cy={4} rx={isSel ? 44 : 40} ry={isSel ? 12 : 10} className="c2-plot-pad" />
                {lv === 0 ? (
                  <g className={`c2-ghost${locked ? ' locked' : ''}`} transform="scale(1.3)">
                    <Art level={1} p={crest.primary} s={crest.secondary} />
                  </g>
                ) : (
                  <g key={`${id}-${lv}`} className={`c2-bld${built?.id === id ? ' built' : ''}${on ? '' : ' sleeping'}`}>
                    <g transform="scale(1.3)">
                      <Art level={lv} p={crest.primary} s={crest.secondary} />
                    </g>
                  </g>
                )}
                {under && (
                  <g className="c2-scaffold">
                    <path d="M -34 4 L -30 -48 M 34 4 L 30 -48 M -32 -14 H 32 M -31 -32 H 31 M -34 4 L 30 -48 M 34 4 L -30 -48" stroke={SCAFFOLD} strokeWidth={2.2} fill="none" strokeLinecap="round" />
                    <g className="c2-hammer">
                      <rect x={-2} y={-66} width={4} height={18} rx={1.6} fill="#7B5127" />
                      <rect x={-9} y={-70} width={18} height={8} rx={2} fill="#9AA2B1" stroke="#6F7686" strokeWidth={1} />
                    </g>
                  </g>
                )}
                {lv === 0 && !under && (
                  <g transform="translate(26 -44)">
                    <circle r={10} className={locked ? 'c2-badge-lock' : 'c2-badge-plus'} />
                    {locked ? (
                      <text y={3.6} textAnchor="middle" className="c2-badge-text">
                        {gate}
                      </text>
                    ) : (
                      <path d="M -4.2 0 h 8.4 M 0 -4.2 v 8.4" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" />
                    )}
                  </g>
                )}
                {built?.id === id && (
                  <g className="c2-fx" key={built.n}>
                    <ellipse cx={0} cy={4} rx={12} ry={4} className="c2-dust" />
                    {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                      <circle key={i} cx={0} cy={-20} r={2.4} className="c2-spark" style={{ ['--a' as string]: `${i * 45}deg` }} />
                    ))}
                  </g>
                )}
                {!on && lv > 0 && (
                  <text x={22} y={-48} className="c2-zzz">
                    z z
                  </text>
                )}
                {under ? (
                  <g transform="translate(0 20)">
                    <rect x={-26} y={0} width={52} height={6} rx={3} fill="rgba(23,24,27,.18)" />
                    <rect x={-26} y={0} width={52 * progress} height={6} rx={3} fill="#FC5200" />
                  </g>
                ) : (
                  <g className="c2-pips-svg" transform="translate(-9 22)">
                    {[1, 2, 3].map((n) => (
                      <circle key={n} cx={(n - 1) * 9} cy={0} r={3} className={lv >= n ? 'on' : undefined} />
                    ))}
                  </g>
                )}
                <text y={40} textAnchor="middle" className="c2-plot-name">
                  {tnd(`clan2.project.${id}.name`)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {!on && (
        <div className={`c2-base-sleep${ruins ? ' fell' : ''}`} role="status">
          <b>{ruins ? tn('clan2.base.fell') : tn('clan2.base.noHq')}</b>
          <span>{ruins ? tn('clan2.base.fellHint', { t: fmtLeft(ruins.until - now) }) : tn('clan2.base.noHqHint')}</span>
        </div>
      )}

      {s.build && (
        <div className="c2-build-banner" role="status">
          <b>
            {tnd(`clan2.project.${s.build.id}.name`)} → {tn('clan2.hq.level', { a: s.build.toLevel })}
          </b>
          <span>{tn('clan2.base.buildLeft', { t: fmtLeft(s.build.endsAt - now) })}</span>
          <C2Bar value={(now - s.build.startedAt) / (s.build.endsAt - s.build.startedAt)} />
          {manage && (
            <button className="btn-secondary" disabled={s.treasury.balance < speedupPrice(s)} onClick={() => act(speedUpBuild())}>
              {tn('clan2.base.speedup', { n: speedupPrice(s) })}
            </button>
          )}
        </div>
      )}

      <div className="c2-bld-card" key={sel}>
        <div className="c2-bld-head">
          <strong>{tnd(`clan2.project.${sel}.name`)}</strong>
          <span className="c2-pips" aria-label={tn('clan2.hq.level', { a: level })}>
            {[1, 2, 3].map((n) => (
              <i key={n} className={level >= n ? 'on' : undefined} />
            ))}
          </span>
        </div>
        <p className="c2-muted small">{tnd(`clan2.project.${sel}.desc`)}</p>
        <div className="c2-effect-rows">
          <div className={`c2-effect now${level === 0 ? ' none' : ''}`}>
            <small>{tn('clan2.base.now')}</small>
            <b>{effectText(sel, level)}</b>
          </div>
          {next && (
            <div className="c2-effect next">
              <small>{tn('clan2.base.next', { n: next })}</small>
              <b>{effectText(sel, next as ProjectLevel)}</b>
            </div>
          )}
        </div>
        {next ? (
          building ? (
            <p className="c2-hint">{tn('clan2.base.buildLeft', { t: fmtLeft(building.endsAt - now) })}</p>
          ) : (
            <>
              <ul className="c2-needs">
                <li className={levelOk ? 'ok' : 'no'}>{tn('clan2.base.needLevel', { n: needLevel, have: s.clan.level })}</li>
                <li className={moneyOk ? 'ok' : 'no'}>
                  {tn('clan2.base.inTreasury')} <C2Coins n={s.treasury.balance} /> / <C2Coins n={cost} />
                </li>
                <li className={busy ? 'no' : 'ok'}>{busy ? tn('clan2.base.busy') : tn('clan2.base.time', { t: fmtLeft(buildHours * 3_600_000) })}</li>
              </ul>
              {manage ? (
                <button
                  className="btn-primary"
                  disabled={!can}
                  onClick={() => {
                    if (act(upgradeProject(sel), 'upgraded')) setBuilt(null)
                  }}
                >
                  {!on ? tn('clan2.base.needHq') : !levelOk ? tn('clan2.base.levelLow', { n: needLevel }) : !moneyOk ? tn('clan2.base.missing', { n: cost - s.treasury.balance }) : busy ? tn('clan2.base.busy') : level === 0 ? tn('clan2.base.buildBtn', { n: cost }) : tn('clan2.base.upgradeBtn', { n: cost })}
                </button>
              ) : (
                <p className="c2-hint">{tn('clan2.base.managersOnly')}</p>
              )}
            </>
          )
        ) : (
          <span className="c2-ok">{tn('clan2.hq.maxed')}</span>
        )}
      </div>

      <ul className="c2-perk-list">
        {PROJECT_IDS.map((id) => {
          const lv = s.projects[id]
          return (
            <li key={id} className={`${sel === id ? 'sel' : ''}${on && lv > 0 ? '' : ' off'}`}>
              <button type="button" onClick={() => setSel(id)}>
                <span className="c2-perk-name">{tnd(`clan2.project.${id}.name`)}</span>
                <span className="c2-perk-eff">{on || lv === 0 ? effectText(id, lv) : tn('clan2.base.asleep')}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

const STONE_HQ = '#E3E6EE'
const SCAFFOLD = '#B98A4A'
