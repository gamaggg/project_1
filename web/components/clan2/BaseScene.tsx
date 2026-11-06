'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { C2Bar, C2Coins, fmtLeft, useC2, useDemoNow } from '@/components/clan2/C2Common'
import { buildingsOn, canManage, upgradeProject, useDemoState } from '@/lib/clan2/demoStore'
import { PROJECTS, PROJECT_EFFECTS, PROJECT_IDS } from '@/lib/clan2/rules'
import type { ProjectId, ProjectLevel } from '@/lib/clan2/types'
import { crestSvgMarkup } from '@/lib/data/clanCrests'
import { tn, tnd } from '@/lib/i18n/runtime'

// «База клана»: the headquarters in the middle of a small island and the five
// buildings round it. Each building is a tap target: it is drawn bigger with every
// level, goes grey and sleeps while the headquarters is down, and when it is
// upgraded it is built before your eyes (rises, dust ring, sparks). Under the
// scene: what the chosen building gives now and at the next level.

type Pos = { x: number; y: number }
const SPOTS: Record<ProjectId, Pos> = {
  dock: { x: 50, y: 150 },
  fort: { x: 100, y: 64 },
  beacon: { x: 296, y: 72 },
  board: { x: 262, y: 156 },
  storage: { x: 160, y: 172 },
}
const HQ_SPOT: Pos = { x: 186, y: 104 }

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
      return tn('clan2.project.board.eff', { n: PROJECT_EFFECTS.board.bountySlots[level], p: PROJECT_EFFECTS.board.questPct[level] })
    case 'storage':
      return tn('clan2.project.storage.eff', { n: PROJECT_EFFECTS.storage.cap[level].toLocaleString('ru-RU').replace(/ | /g, ' ') })
  }
}

const WOOD = '#9A6B3A'
const WOOD_DARK = '#6B4423'
const STONE = '#B8BEC9'
const STONE_DARK = '#8A93A3'

function Dock({ level, p, s }: { level: ProjectLevel; p: string; s: string }) {
  const len = [0, 34, 46, 58][level]
  return (
    <g>
      <rect x={-len / 2} y={2} width={len} height={9} rx={2} fill={WOOD} />
      {Array.from({ length: Math.floor(len / 8) }).map((_, i) => (
        <rect key={i} x={-len / 2 + 3 + i * 8} y={2} width={1.4} height={9} fill={WOOD_DARK} opacity={0.55} />
      ))}
      {[-1, 0, 1].map((k) => (
        <rect key={k} x={k * (len / 2 - 5) - 2} y={10} width={4} height={10} rx={1.5} fill={WOOD_DARK} />
      ))}
      <path d={`M ${len / 2 - 6} -4 q 12 -2 20 4 l -4 6 h -14 z`} fill={level >= 3 ? '#F0A93E' : p} stroke="#fff" strokeWidth={1.2} />
      <rect x={len / 2 + 4} y={-6} width={1.6} height={10} fill="#fff" />
      {level >= 2 && (
        <g>
          <rect x={-len / 2 + 2} y={-22} width={2.4} height={24} fill={WOOD_DARK} />
          <path d={`M ${-len / 2 + 4.4} -22 l 14 4 l -14 4 z`} fill={s} stroke="#fff" strokeWidth={0.8} />
        </g>
      )}
      {level >= 3 && (
        <g>
          <circle cx={len / 2 - 4} cy={-4} r={3.2} fill="#FFE08A" className="c2-glow" />
          <rect x={len / 2 - 5} y={-2} width={2} height={5} fill={WOOD_DARK} />
        </g>
      )}
    </g>
  )
}

function Beacon({ level, p, s }: { level: ProjectLevel; p: string; s: string }) {
  const h = [0, 34, 46, 58][level]
  return (
    <g>
      <path d={`M -11 18 L -7 ${18 - h} L 7 ${18 - h} L 11 18 z`} fill="#fff" stroke={STONE_DARK} strokeWidth={1.2} />
      <path d={`M -9.6 ${18 - h * 0.25} L -8.6 ${18 - h * 0.5} L 8.6 ${18 - h * 0.5} L 9.6 ${18 - h * 0.25} z`} fill={p} />
      {level >= 2 && <path d={`M -8.2 ${18 - h * 0.7} L -7.6 ${18 - h * 0.85} L 7.6 ${18 - h * 0.85} L 8.2 ${18 - h * 0.7} z`} fill={p} />}
      <rect x={-9} y={18 - h - 7} width={18} height={7} rx={2} fill="#2B2F38" />
      <circle cx={0} cy={18 - h - 3.5} r={3.4} fill="#FFE08A" className="c2-glow" />
      <path d={`M -10 ${18 - h - 7} L 0 ${18 - h - 15} L 10 ${18 - h - 7} z`} fill={s} stroke="#fff" strokeWidth={1} />
      {level >= 3 && (
        <g className="c2-beam" style={{ transformOrigin: `0px ${18 - h - 3.5}px` }}>
          <path d={`M 0 ${18 - h - 3.5} L 44 ${18 - h - 12} L 44 ${18 - h + 5} z`} fill="#FFE08A" opacity={0.42} />
        </g>
      )}
    </g>
  )
}

function Fort({ level, p, s }: { level: ProjectLevel; p: string; s: string }) {
  const w = [0, 44, 56, 64][level]
  const tower = (x: number, k: string) => (
    <g key={k}>
      <rect x={x - 8} y={-18} width={16} height={34} fill={STONE} stroke={STONE_DARK} strokeWidth={1.2} />
      {[-8, -2.5, 3].map((dx) => (
        <rect key={dx} x={x + dx} y={-23} width={5} height={6} fill={STONE} stroke={STONE_DARK} strokeWidth={1} />
      ))}
      <rect x={x - 2} y={-6} width={4} height={8} rx={2} fill="#2B2F38" />
    </g>
  )
  return (
    <g>
      <rect x={-w / 2} y={-2} width={w} height={18} fill={STONE} stroke={STONE_DARK} strokeWidth={1.2} />
      {Array.from({ length: Math.floor(w / 9) }).map((_, i) => (
        <rect key={i} x={-w / 2 + 1 + i * 9} y={-7} width={6} height={6} fill={STONE} stroke={STONE_DARK} strokeWidth={1} />
      ))}
      {level >= 2 && tower(-w / 2 + 4, 'a')}
      {level >= 3 && tower(w / 2 - 4, 'b')}
      {level >= 2 && (
        <g>
          <rect x={level >= 3 ? -1 : -w / 2 + 3} y={-40} width={2} height={20} fill={WOOD_DARK} />
          <path d={`M ${level >= 3 ? 1 : -w / 2 + 5} -40 l 14 4 l -14 4 z`} fill={s} stroke="#fff" strokeWidth={0.8} />
        </g>
      )}
      <path d="M -6 16 v -9 a 6 6 0 0 1 12 0 v 9 z" fill={p} stroke="#fff" strokeWidth={1} />
    </g>
  )
}

function Board({ level, p, s }: { level: ProjectLevel; p: string; s: string }) {
  const notes = [0, 1, 2, 3][level]
  return (
    <g>
      <rect x={-17} y={-6} width={3} height={26} fill={WOOD_DARK} />
      <rect x={14} y={-6} width={3} height={26} fill={WOOD_DARK} />
      <rect x={-21} y={-26} width={42} height={30} rx={3} fill={WOOD} stroke={WOOD_DARK} strokeWidth={1.4} />
      {[0, 1, 2].slice(0, notes).map((i) => (
        <g key={i} transform={`translate(${-15 + i * 12} ${-21 + (i % 2) * 5}) rotate(${i % 2 ? 4 : -5})`}>
          <rect width={10} height={13} rx={1.2} fill={i === 1 ? '#FFF1B8' : '#fff'} stroke="#d9cfae" strokeWidth={0.7} />
          <path d="M2 4h6M2 7h6M2 10h4" stroke={i === 2 ? p : '#8A8F9A'} strokeWidth={0.9} strokeLinecap="round" />
        </g>
      ))}
      {level >= 3 && (
        <g>
          <rect x={-4} y={-38} width={2.2} height={14} fill={WOOD_DARK} />
          <path d="M -1.8 -38 l 16 4 l -16 4 z" fill={s} stroke="#fff" strokeWidth={0.8} />
        </g>
      )}
    </g>
  )
}

function Storage({ level, p, s }: { level: ProjectLevel; p: string; s: string }) {
  const w = [0, 34, 46, 58][level]
  return (
    <g>
      <rect x={-w / 2} y={-8} width={w} height={26} fill="#E9D3A5" stroke={WOOD_DARK} strokeWidth={1.3} />
      <path d={`M ${-w / 2 - 4} -8 L 0 ${-8 - 10 - level * 3} L ${w / 2 + 4} -8 z`} fill={p} stroke="#fff" strokeWidth={1.2} />
      <rect x={-6} y={4} width={12} height={14} rx={1} fill={WOOD_DARK} />
      {level >= 2 && (
        <g>
          <rect x={w / 2 - 14} y={-2} width={9} height={8} fill="#F6E7BF" stroke={WOOD_DARK} strokeWidth={0.9} />
          <rect x={-w / 2 + 5} y={-2} width={9} height={8} fill="#F6E7BF" stroke={WOOD_DARK} strokeWidth={0.9} />
        </g>
      )}
      {level >= 3 && (
        <g>
          <circle cx={0} cy={-18} r={5.6} fill="#F0A93E" stroke="#fff" strokeWidth={1.2} />
          <text x={0} y={-15.4} textAnchor="middle" fontSize={7.5} fontWeight={800} fill="#6B4300">
            R
          </text>
        </g>
      )}
      <rect x={w / 2 - 2} y={14} width={9} height={7} rx={1} fill={s} stroke="#fff" strokeWidth={0.8} />
    </g>
  )
}

const ART: Record<ProjectId, (props: { level: ProjectLevel; p: string; s: string }) => ReactNode> = { dock: Dock, beacon: Beacon, fort: Fort, board: Board, storage: Storage }

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

  // A level that just arrived is played as a build: also when it came from elsewhere (a goal bought in the treasury).
  useEffect(() => {
    for (const id of PROJECT_IDS) {
      if (s.projects[id] > prev.current[id]) {
        setBuilt({ id, n: Date.now() })
        setSel(id)
        const t = window.setTimeout(() => setBuilt((b) => (b && b.id === id ? null : b)), 1600)
        prev.current = s.projects
        return () => window.clearTimeout(t)
      }
    }
    prev.current = s.projects
  }, [s.projects])

  const level = s.projects[sel]
  const cost = level < 3 ? PROJECTS[sel].costs[level as 0 | 1 | 2] : 0
  const ruins = s.hq.ruins && now < s.hq.ruins.until ? s.hq.ruins : null
  const missing = Math.max(0, cost - s.treasury.balance)

  return (
    <div className="c2-base">
      <svg className="c2-base-svg" viewBox="0 0 340 214" role="group" aria-label={tn('clan2.base.title')}>
        <defs>
          <linearGradient id="c2-sea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#BFE1F2" />
            <stop offset="1" stopColor="#8FC4E0" />
          </linearGradient>
          <radialGradient id="c2-land" cx="0.5" cy="0.4" r="0.7">
            <stop offset="0" stopColor="#F4E6BF" />
            <stop offset="1" stopColor="#D9BF86" />
          </radialGradient>
        </defs>
        <rect width="340" height="214" rx="22" fill="url(#c2-sea)" />
        {[0, 1, 2, 3].map((i) => (
          <path key={i} className="c2-wave" style={{ animationDelay: `${i * -1.1}s` }} d={`M ${10 + i * 20} ${24 + i * 46} q 12 -7 24 0 t 24 0 t 24 0`} fill="none" stroke="rgba(255,255,255,.7)" strokeWidth={1.6} strokeLinecap="round" />
        ))}
        <ellipse cx="176" cy="120" rx="148" ry="82" fill="#C8AD72" />
        <ellipse cx="176" cy="114" rx="146" ry="80" fill="url(#c2-land)" />
        <path d="M 40 96 q 60 -28 130 -10 t 130 -4" fill="none" stroke="rgba(154,107,58,.28)" strokeWidth={10} strokeLinecap="round" />

        {/* The headquarters. */}
        <g transform={`translate(${HQ_SPOT.x} ${HQ_SPOT.y})`}>
          <ellipse cx={0} cy={22} rx={30} ry={8} fill="rgba(23,24,27,.2)" />
          {ruins ? (
            <g className="c2-ruins">
              <path d="M -20 22 L -16 4 L -8 10 L -4 -2 L 4 8 L 10 0 L 18 22 z" fill="#A89C86" stroke="#7A705E" strokeWidth={1.2} />
              <path d="M -2 -4 q -6 -12 2 -20 q 8 -8 0 -18" fill="none" stroke="rgba(60,60,60,.45)" strokeWidth={5} strokeLinecap="round" className="c2-smoke" />
            </g>
          ) : (
            <g className={on ? 'c2-hqtower' : undefined}>
              <rect x={-17} y={-14} width={34} height={36} rx={4} fill="#fff" stroke={STONE_DARK} strokeWidth={1.4} />
              <rect x={-21} y={-20} width={42} height={9} rx={2.5} fill={crest.primary} stroke="#fff" strokeWidth={1.2} />
              <g transform="translate(-12 -9)" dangerouslySetInnerHTML={{ __html: crestSvgMarkup(crest, 24) }} />
              <rect x={-1.2} y={-40} width={2.4} height={22} fill={WOOD_DARK} />
              <path d="M 1.2 -40 l 18 5 l -18 5 z" fill={crest.secondary} stroke="#fff" strokeWidth={0.9} className="c2-flag" />
            </g>
          )}
          <text x={0} y={36} textAnchor="middle" className="c2-scene-label">
            {ruins ? tn('clan2.base.ruins') : tn('clan2.base.hq')}
          </text>
        </g>

        {PROJECT_IDS.map((id) => {
          const pos = SPOTS[id]
          const lv = s.projects[id]
          const Art = ART[id]
          const active = on && lv > 0
          const isSel = sel === id
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
              <ellipse cx={0} cy={22} rx={isSel ? 34 : 30} ry={isSel ? 10 : 8} className="c2-plot-pad" />
              {lv === 0 ? (
                <g className="c2-plot-empty">
                  <rect x={-17} y={-14} width={34} height={32} rx={9} fill="rgba(255,255,255,.45)" stroke="rgba(120,100,60,.7)" strokeWidth={1.6} strokeDasharray="5 4" />
                  <path d="M -6 2 h 12 M 0 -4 v 12" stroke="rgba(120,100,60,.85)" strokeWidth={2.4} strokeLinecap="round" />
                </g>
              ) : (
                <g key={`${id}-${lv}`} className={`c2-bld${built?.id === id ? ' built' : ''}${active ? '' : ' sleeping'}`}>
                  <Art level={lv} p={crest.primary} s={crest.secondary} />
                </g>
              )}
              {built?.id === id && (
                <g className="c2-fx" key={built.n}>
                  <ellipse cx={0} cy={20} rx={10} ry={4} className="c2-dust" />
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <circle key={i} cx={0} cy={4} r={2.2} className="c2-spark" style={{ ['--a' as string]: `${i * 60}deg` }} />
                  ))}
                </g>
              )}
              {!on && lv > 0 && (
                <text x={14} y={-10} className="c2-zzz">
                  z z
                </text>
              )}
              <g className="c2-pips-svg" transform="translate(-9 31)">
                {[1, 2, 3].map((n) => (
                  <circle key={n} cx={(n - 1) * 9} cy={0} r={2.7} className={lv >= n ? 'on' : undefined} />
                ))}
              </g>
            </g>
          )
        })}
      </svg>

      {!on && (
        <div className={`c2-base-sleep${ruins ? ' fell' : ''}`} role="status">
          <b>{ruins ? tn('clan2.base.fell') : tn('clan2.base.noHq')}</b>
          <span>{ruins ? tn('clan2.base.fellHint', { t: fmtLeft(ruins.until - now) }) : tn('clan2.base.noHqHint')}</span>
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
          {level < 3 && (
            <div className="c2-effect next">
              <small>{tn('clan2.base.next', { n: level + 1 })}</small>
              <b>{effectText(sel, (level + 1) as ProjectLevel)}</b>
            </div>
          )}
        </div>
        {level < 3 ? (
          <>
            <div className="c2-bld-cost">
              <span>{tn('clan2.base.inTreasury')}</span>
              <C2Coins n={s.treasury.balance} />
              <span>/</span>
              <C2Coins n={cost} />
            </div>
            <C2Bar value={cost ? s.treasury.balance / cost : 1} tone={missing > 0 ? 'accent' : 'good'} />
            {manage ? (
              <button
                className="btn-primary"
                disabled={missing > 0 || !on}
                onClick={() => {
                  if (act(upgradeProject(sel), 'upgraded')) setBuilt({ id: sel, n: Date.now() })
                }}
              >
                {!on ? tn('clan2.base.needHq') : missing > 0 ? tn('clan2.base.missing', { n: missing }) : level === 0 ? tn('clan2.base.build', { n: cost }) : tn('clan2.hq.upgrade', { n: cost })}
              </button>
            ) : (
              <p className="c2-hint">{tn('clan2.base.managersOnly')}</p>
            )}
          </>
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
