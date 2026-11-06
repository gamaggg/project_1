'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ART } from '@/components/clan2/BaseArt'
import { C2Bar, C2Coins, fmtLeft, useC2, useDemoNow } from '@/components/clan2/C2Common'
import { buildingsOn, canManage, speedUpBuild, speedupPrice, upgradeProject, useDemoState } from '@/lib/clan2/demoStore'
import { BUILD_CLAN_LEVEL, BUILD_HOURS, PROJECTS, PROJECT_EFFECTS, PROJECT_IDS } from '@/lib/clan2/rules'
import type { ProjectId, ProjectLevel } from '@/lib/clan2/types'
import { useLiveUi, type HqGeo } from '@/lib/clan2/live/ui'
import { hqBannerSvg, hqOutlineColor } from '@/lib/clan2/live/hqMarker'
import { resolveCrest } from '@/lib/data/clanCrests'
import { previewStaticUrl } from '@/lib/mapbox/rasterTiles'
import { tn, tnd } from '@/lib/i18n/runtime'

// «База клана»: the clan's own sector, seen from above, on the real map of the place where its HQ stands (the same
// light map as the sector screen, the same all day). The HQ is in the middle — the same banner as on the game map —
// and six round plots stand round it, one for every building. A building is drawn bigger and richer with each level;
// one that can be built stands there as a ghost with a «+»; a bouncing arrow says «can be upgraded now»; while it is
// being built the scaffolding stands and a bar counts the time down; with the HQ down they all sleep.
// Everything is placed in the units of the 400 x 346.4 sector, as percentages of the box, so it scales with the screen.

const W = 400
const H = 346.4
// The picture is wider than the sector: the real map shows round it too (dimmed), the sector stays a hexagon in the middle.
const VW = 440
const VH = 400
const OX = (VW - W) / 2
const OY = (VH - H) / 2
// The map is drawn a little wider than the sector itself, so the coast and the streets round it can be seen.
const MAP_ZOOM_OUT = 1.7
const HEX = '100,0 300,0 400,173.2 300,346.4 100,346.4 0,173.2'
// The sector's middle: the HQ's plaza, where every path starts.
const MID = { x: 200, y: 173.2 }
// The six buildings stand in the six corners of the sector (the owner's scheme): lighthouse top left, market top right,
// board right, storage bottom right, dock bottom left, fort left — each ground point 74% of the way from the middle to
// its corner. A tall building in a top corner may rise over the top edge, the way a house stands up off its tile.
const CORNER: Record<ProjectId, [number, number]> = { beacon: [100, 0], market: [300, 0], board: [400, 173.2], storage: [300, 346.4], dock: [100, 346.4], fort: [0, 173.2] }
const SPOTS = Object.fromEntries(
  (Object.keys(CORNER) as ProjectId[]).map((id) => [id, { x: MID.x + (CORNER[id][0] - MID.x) * 0.74, y: MID.y + (CORNER[id][1] - MID.y) * 0.74 }])
) as Record<ProjectId, { x: number; y: number }>
// How big each building is drawn on its plot (the lighthouse is the tallest).
const SCALE: Record<ProjectId, number> = { beacon: 0.7, market: 0.82, board: 0.82, storage: 0.82, dock: 0.82, fort: 0.82 }
// The name pills of the side plots lean towards the middle, so a long name stays inside the sector (in % of the plot).
const PILL_DX: Partial<Record<ProjectId, number>> = { fort: 14, board: -22 }
// The HQ's ground point (the foot of its plinth, on the front of the plaza) and the demo's place (a sea-side sector of
// Batumi) when the clan is not bound to a real one.
const HQ_AT = { x: 200, y: 200 }
export const DEMO_GEO: HqGeo = { id: 'B1031', lat: 41.653959, lng: 41.628128, widthDeg: 0.008332 }

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

// The art box of one plot: the ground line is at y = 0, 28% of the box lies under it (plate, pills).
const ART_VB = '-56 -108 112 150'

const px = (x: number) => `${((OX + x) / VW) * 100}%`
const py = (y: number) => `${((OY + y) / VH) * 100}%`

export function BaseScene() {
  const s = useDemoState()
  const now = useDemoNow()
  const { act } = useC2()
  const { hqGeo } = useLiveUi()
  const manage = canManage(s)
  const on = buildingsOn(s)
  const [sel, setSel] = useState<ProjectId>('dock')
  const [built, setBuilt] = useState<{ id: ProjectId; n: number } | null>(null)
  const [pop, setPop] = useState<{ id: ProjectId | 'hq'; n: number } | null>(null)
  const [mapOk, setMapOk] = useState(true)
  const prev = useRef(s.projects)
  const crest = s.clan.crest
  const ruins = s.hq.ruins && now < s.hq.ruins.until ? s.hq.ruins : null
  const geo = s.live ? hqGeo : DEMO_GEO
  const mapUrl = geo && mapOk ? previewStaticUrl(geo.lat, geo.lng, geo.widthDeg, VW, VH, W / MAP_ZOOM_OUT) : null
  const outline = hqOutlineColor(crest)
  const clanColor = resolveCrest(crest).primary

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
  const SelArt = ART[sel]
  // The big picture in the card: the building is blown up to fill its frame (a flat dock more than a tall lighthouse).
  const heroRef = useRef<SVGGElement>(null)
  const [hero, setHero] = useState({ k: 1, dx: 0 })
  useLayoutEffect(() => {
    const b = heroRef.current?.getBBox()
    if (b && b.width > 0) {
      const k = Math.max(1, Math.min(2, 84 / b.height, 100 / b.width))
      setHero({ k, dx: -(b.x + b.width / 2) * k })
    }
  }, [sel, level])

  const choose = (id: ProjectId) => {
    setSel(id)
    setPop({ id, n: Date.now() })
  }

  return (
    <div className="c2-base">
      <div className="c2-base-hex" data-tour="base-scene" style={{ ['--clan' as string]: clanColor, ['--clan-dark' as string]: outline }}>
        <svg className="c2-base-svg" viewBox={`0 0 ${VW} ${VH}`} aria-hidden="true">
          <defs>
            <clipPath id="c2b-clip">
              <polygon points={HEX} />
            </clipPath>
            <radialGradient id="c2b-veil" cx="0.5" cy="0.55" r="0.6">
              <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
              <stop offset="1" stopColor="#fff" stopOpacity="0.05" />
            </radialGradient>
            <radialGradient id="c2b-plaza" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
              <stop offset="1" stopColor="#F4EEDD" stopOpacity="0.9" />
            </radialGradient>
          </defs>
            <rect width={VW} height={VH} fill="#E9ECEF" />
            {mapUrl && <image href={mapUrl} x={0} y={0} width={VW} height={VH} preserveAspectRatio="none" onError={() => setMapOk(false)} />}
            {!mapUrl && [0, 1, 2, 3].map((i) => <path key={i} className="c2-wave" style={{ animationDelay: `${i * -1.3}s` }} d={`M ${60 + i * 110} ${60 + (i % 2) * 20} q 12 -7 24 0 t 24 0`} fill="none" stroke="rgba(120,150,180,.5)" strokeWidth={1.6} strokeLinecap="round" />)}
          {/* Outside the sector the map is veiled, so the sector is the bright part. */}
          <path d={`M0 0H${VW}V${VH}H0Z M${HEX.split(' ').map((q) => { const [x, y] = q.split(',').map(Number); return `${x + OX},${y + OY}` }).join(' L')}Z`} fill="#fff" fillOpacity={0.4} fillRule="evenodd" />
          <g transform={`translate(${OX} ${OY})`}>
          <g clipPath="url(#c2b-clip)">
            <rect width={W} height={H} fill="url(#c2b-veil)" />
            <rect width={W} height={H} fill={clanColor} opacity={0.08} />
            {/* The paths from the HQ to every plot, and the plaza round it. */}
            {PROJECT_IDS.map((id) => (
              <path key={id} d={`M ${MID.x} ${MID.y} L ${SPOTS[id].x} ${SPOTS[id].y}`} stroke="#fff" strokeWidth={7} strokeLinecap="round" opacity={0.85} />
            ))}
            {PROJECT_IDS.map((id) => (
              <path key={`d${id}`} d={`M ${MID.x} ${MID.y} L ${SPOTS[id].x} ${SPOTS[id].y}`} stroke={outline} strokeWidth={1.4} strokeDasharray="1 6" strokeLinecap="round" opacity={0.55} />
            ))}
            <ellipse cx={MID.x} cy={MID.y + 8} rx={58} ry={36} fill="url(#c2b-plaza)" stroke={outline} strokeOpacity={0.4} strokeWidth={1.6} />

          </g>
          {/* A light bevel just inside the edge, so the sector reads as a tile. */}
          <polygon points={HEX} transform="translate(10 8.66) scale(.95)" fill="none" stroke="#fff" strokeOpacity={0.5} strokeWidth={2} strokeLinejoin="round" />
          {/* The sector's outline, as on the game map: the clan's colour, darker. */}
          <polygon points={HEX} fill="none" stroke={outline} strokeOpacity={0.35} strokeWidth={9} strokeLinejoin="round" />
          <polygon points={HEX} fill="none" stroke={outline} strokeWidth={3} strokeLinejoin="round" />
          </g>
        </svg>

        {/* The HQ: the banner of the game map, on the plaza. */}
        <button
          type="button"
          className={`c2-base-hq${on ? '' : ' down'}`}
          style={{ left: px(HQ_AT.x), top: py(HQ_AT.y) }}
          aria-label={ruins ? tn('clan2.base.ruins') : tn('clan2.base.hq')}
          onClick={() => setPop({ id: 'hq', n: Date.now() })}
        >
          <span className="c2-base-hq-art" key={pop?.id === 'hq' ? pop.n : 0}>
            {ruins ? (
              <svg viewBox="-34 -48 68 56" aria-hidden="true">
                <path d="M -30 0 L -26 -20 L -16 -12 L -10 -28 L 0 -14 L 8 -24 L 18 -10 L 28 0 z" fill="#B7AB93" stroke="#7A705E" strokeWidth={1.4} />
                <path className="c2-smoke" d="M -2 -26 q -7 -12 2 -22 q 9 -9 0 -20" fill="none" stroke="rgba(70,70,70,.5)" strokeWidth={5} strokeLinecap="round" />
              </svg>
            ) : (
              <span dangerouslySetInnerHTML={{ __html: hqBannerSvg(crest, 62, 92) }} />
            )}
          </span>
          <span className="c2-base-pill hq">{ruins ? tn('clan2.base.ruins') : tn('clan2.base.hq')}</span>
        </button>

        {PROJECT_IDS.map((id) => {
          const pos = SPOTS[id]
          const lv = s.projects[id]
          const Art = ART[id]
          const isSel = sel === id
          const under = s.build?.id === id ? s.build : null
          const gate = lv < 3 ? BUILD_CLAN_LEVEL[lv as 0 | 1 | 2] : 0
          const price = lv < 3 ? PROJECTS[id].costs[lv as 0 | 1 | 2] : 0
          const locked = !under && lv < 3 && s.clan.level < gate
          const ready = !under && lv < 3 && on && manage && !busy && !locked && s.treasury.balance >= price
          const progress = under ? Math.min(1, Math.max(0, (now - under.startedAt) / (under.endsAt - under.startedAt))) : 0
          return (
            <button
              key={id}
              type="button"
              className={`c2-plot${isSel ? ' sel' : ''}${on ? '' : ' asleep'}${ready ? ' ready' : ''}${lv === 0 ? ' empty' : ''}`}
              style={{ left: px(pos.x), top: py(pos.y), zIndex: Math.round(pos.y) }}
              aria-label={`${tnd(`clan2.project.${id}.name`)} ${lv}/3`}
              aria-pressed={isSel}
              onClick={() => choose(id)}
            >
              <svg className="c2-plot-svg" viewBox={ART_VB} overflow="visible" aria-hidden="true">
                <ellipse cx={0} cy={5} rx={36} ry={10.5} className="c2-plot-pad" />
                <g key={pop?.id === id ? pop.n : 0} className={`c2-plot-lift${pop?.id === id ? ' pop' : ''}`}>
                  <g transform={`scale(${SCALE[id]})`}>
                  {lv === 0 ? (
                    <g className={`c2-ghost${locked ? ' locked' : ''}`}>
                      <Art level={1} p={crest.primary} s={crest.secondary} />
                    </g>
                  ) : (
                    <g key={`${id}-${lv}`} className={`c2-bld${built?.id === id ? ' built' : ''}${on ? '' : ' sleeping'}`}>
                      <Art level={lv} p={crest.primary} s={crest.secondary} />
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
                  </g>
                </g>
                {built?.id === id && (
                  <g className="c2-fx" key={built.n}>
                    <ellipse cx={0} cy={4} rx={12} ry={4} className="c2-dust" />
                    {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                      <circle key={i} cx={0} cy={-20} r={2.4} className="c2-spark" style={{ ['--a' as string]: `${i * 45}deg` }} />
                    ))}
                  </g>
                )}
              </svg>
              {/* What it says at a glance: «+» build / upgrade (orange: possible now, grey: not yet), otherwise its level. */}
              {!under && (
                <span className={`c2-plot-badge ${lv === 0 || ready ? (ready ? 'plus' : 'off') : lv === 3 ? 'max' : 'lv'}`}>{lv === 0 || ready ? '+' : lv}</span>
              )}
              {!on && lv > 0 && <span className="c2-zzz-html">z z</span>}
              <span className="c2-base-pill" style={PILL_DX[id] ? { ['--pill-dx' as string]: `${PILL_DX[id]}%` } : undefined}>
                <span>{tnd(`clan2.project.${id}.name`)}</span>
              </span>
              {under && (
                <span className="c2-plot-bar" aria-hidden="true">
                  <i style={{ width: `${progress * 100}%` }} />
                </span>
              )}
            </button>
          )
        })}
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
        <div className="c2-bld-hero">
          <svg className="c2-bld-heroart" viewBox="-56 -96 112 124" overflow="visible" aria-hidden="true">
            <ellipse cx={0} cy={5} rx={52} ry={14} className="c2-plot-pad" />
            <g className={`c2-bld-herolift${level === 0 ? ' c2-ghost' : on ? '' : ' sleeping'}`}>
              <g ref={heroRef} style={{ transform: `translateX(${hero.dx}px) scale(${hero.k})`, transformOrigin: '0 0' }}>
                <SelArt level={(level || 1) as ProjectLevel} p={crest.primary} s={crest.secondary} />
              </g>
            </g>
          </svg>
          <div className="c2-bld-title">
            <strong>{tnd(`clan2.project.${sel}.name`)}</strong>
            <small>{tn('clan2.hq.level', { a: level })}</small>
            <span className="c2-pips" aria-hidden="true">
              {[1, 2, 3].map((n) => (
                <i key={n} className={level >= n ? 'on' : undefined} />
              ))}
            </span>
          </div>
        </div>
        <p className="c2-muted small">{tnd(`clan2.project.${sel}.desc`)}</p>
        <ol className="c2-ladder">
          {([1, 2, 3] as const).map((n) => {
            const state = level >= n ? 'done' : n === level + 1 ? 'next' : 'later'
            return (
              <li key={n} className={state}>
                <span className="c2-ladder-dot" aria-hidden="true">
                  {state === 'done' ? '✓' : n}
                </span>
                <span className="c2-ladder-text">
                  <small>{tn('clan2.hq.level', { a: n })}</small>
                  <b>{effectText(sel, n as ProjectLevel)}</b>
                </span>
                {state !== 'done' && (
                  <span className="c2-ladder-cost">
                    <C2Coins n={PROJECTS[sel].costs[n - 1]} />
                  </span>
                )}
              </li>
            )
          })}
        </ol>
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
              <button type="button" onClick={() => choose(id)}>
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

const SCAFFOLD = '#B98A4A'
