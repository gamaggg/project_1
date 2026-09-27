'use client'

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAdminMoveCatch, useProfile, useTerritories } from '@/lib/supabase/queries'
import { KIND_LABEL } from '@/lib/data/species'
import type { Catch, Territory } from '@/lib/data/types'

const NEIGHBOURS_ON_MAP = 18
const LIST_LIMIT = 12
const COMPASS = ['С', 'СВ', 'В', 'ЮВ', 'Ю', 'ЮЗ', 'З', 'СЗ']

// Local flat projection around the current sector — metres east/north.
// Plenty accurate over the couple of kilometres this sheet ever shows.
function toMeters(lat: number, lng: number, lat0: number, lng0: number): [number, number] {
  return [(lng - lng0) * Math.cos((lat0 * Math.PI) / 180) * 111_320, (lat - lat0) * 110_540]
}

function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10} м` : `${(m / 1000).toFixed(1).replace('.', ',')} км`
}

function moveErrorText(error: unknown): string {
  const msg = error instanceof Error ? error.message : String((error as { message?: string })?.message ?? error)
  if (msg.includes('MOVE:same_sector')) return 'Улов уже в этом секторе'
  if (msg.includes('MOVE:other_city')) return 'Переносить можно только в сектор того же города'
  if (msg.includes('MOVE:unknown_sector')) return 'Такого сектора нет'
  if (msg.includes('MOVE:catch_not_found')) return 'Улов не найден — возможно, его уже удалили'
  if (msg.includes('not authorized')) return 'Переносить уловы может только супер-админ'
  return 'Не удалось перенести — попробуй ещё раз'
}

type Candidate = { t: Territory; distance: number; dir: string; x: number; y: number }

// Super admin: move a catch GPS put in the wrong sector. The neighbourhood
// is drawn as the real hexes around the current sector (tap one), with
// search by number for anything further away.
export function MoveCatchSheet({ c, onClose }: { c: Catch; onClose: () => void }) {
  const { data: territories = [] } = useTerritories()
  const { data: owner } = useProfile(c.userId)
  const ownerName = owner?.displayName ?? null
  const move = useAdminMoveCatch()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [done, setDone] = useState<string | null>(null)

  const current = territories.find((t) => t.id === c.territoryId) ?? null
  const cityPrefix = c.territoryId.slice(0, 1)

  const candidates = useMemo<Candidate[]>(() => {
    if (!current) return []
    return territories
      .filter((t) => t.id !== current.id && t.id.startsWith(cityPrefix))
      .map((t) => {
        const [x, y] = toMeters(t.lat, t.lng, current.lat, current.lng)
        const bearing = (Math.atan2(x, y) * 180) / Math.PI
        const dir = COMPASS[Math.round(((bearing + 360) % 360) / 45) % 8]
        return { t, distance: Math.hypot(x, y), dir, x, y }
      })
      .sort((a, b) => a.distance - b.distance)
  }, [territories, current, cityPrefix])

  // About two rings of hexes around the current one (neighbour centres sit
  // √3 radii apart), never fewer than the 6 nearest — sparse stretches of
  // river would otherwise shrink everything to specks.
  const hexRadius = current ? Math.max(...current.corners.map(([lat, lng]) => Math.hypot(...toMeters(lat, lng, current.lat, current.lng))), 50) : 0
  const onMap = candidates.filter((k, i) => i < 6 || k.distance <= hexRadius * 3.6).slice(0, NEIGHBOURS_ON_MAP)
  const digits = query.replace(/\D/g, '')
  const listed = digits ? candidates.filter((k) => k.t.id.slice(1).includes(digits)).slice(0, LIST_LIMIT) : candidates.slice(0, LIST_LIMIT)
  const selected = candidates.find((k) => k.t.id === selectedId) ?? null

  function submit() {
    if (!selected) return
    move.mutate({ catchId: c.id, territoryId: selected.t.id }, { onSuccess: () => setDone(selected.t.id) })
  }

  return createPortal(
    <div className="move-sheet-overlay" onClick={onClose}>
      <div className="move-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Перенести улов">
        <div className="move-sheet-handle" />
        {done ? (
          <div className="move-done">
            <div className="move-done-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="m5 12.5 4.5 4.5L19 7.5" />
              </svg>
            </div>
            <div className="move-done-title">Улов перенесён в {done}</div>
            <div className="move-done-sub">Владельцы обоих секторов пересчитаны. Монеты не менялись.</div>
            <button className="btn-primary" style={{ marginTop: 18 }} onClick={onClose}>
              Готово
            </button>
          </div>
        ) : (
          <>
            <div className="move-head">
              <div>
                <div className="move-kicker">Супер-админ · перенос улова</div>
                <div className="move-title">
                  {c.speciesName}
                  {ownerName ? ` · ${ownerName}` : ''}
                </div>
              </div>
              <button className="icon-btn tap-scale" aria-label="Закрыть" onClick={onClose}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            <div className="move-body">
              {current ? (
                <HexNeighbourhood current={current} neighbours={onMap} catcherId={c.userId} selectedId={selectedId} onSelect={setSelectedId} />
              ) : (
                <div className="move-empty">Сектор {c.territoryId} не найден на карте — выбери новый через поиск</div>
              )}

              <label className="move-search">
                <span>{cityPrefix}</span>
                <input inputMode="numeric" placeholder="Номер сектора" value={query} onChange={(e) => setQuery(e.target.value)} />
              </label>

              <div className="move-list">
                {listed.length === 0 && <div className="move-empty">Сектор с таким номером не найден</div>}
                {listed.map((k) => (
                  <button key={k.t.id} className={`move-row${k.t.id === selectedId ? ' on' : ''}`} onClick={() => setSelectedId(k.t.id)}>
                    <span className={`move-row-hex${k.t.ownerId === c.userId ? ' catcher' : k.t.ownerId ? ' owned' : ''}`} />
                    <span className="move-row-main">
                      <b>{k.t.id}</b>
                      <span>
                        {KIND_LABEL[k.t.kind]} · {k.t.ownerId ? (k.t.ownerId === c.userId ? `у ${ownerName ?? 'рыбака'}` : (k.t.ownerDisplayName ?? 'занят')) : 'свободен'}
                        {k.t.catchCount > 0 ? ` · ${k.t.catchCount} ул.` : ''}
                      </span>
                    </span>
                    <span className="move-row-dist">
                      <b>{formatDistance(k.distance)}</b>
                      <span>{k.dir}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="move-footer">
              <div className="move-route">
                <span className="move-route-from">{c.territoryId}</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
                <span className={`move-route-to${selected ? '' : ' empty'}`}>{selected ? selected.t.id : 'выбери сектор'}</span>
              </div>
              <div className="move-note">
                {c.territoryId} вернётся прежнему хозяину или освободится, {selected ? selected.t.id : 'новый сектор'} перейдёт рыбаку, если этот улов там самый свежий. Монеты не меняются.
              </div>
              {move.isError && <div className="move-error">{moveErrorText(move.error)}</div>}
              <button className="btn-primary" disabled={!selected || move.isPending} onClick={submit}>
                {move.isPending ? 'Переносим…' : selected ? `Перенести в ${selected.t.id}` : 'Перенести'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}

// The real hexes around the current sector, drawn to scale from their own
// corners, so picking "the one just north of it" works the way it looks on
// the map.
function HexNeighbourhood({
  current,
  neighbours,
  catcherId,
  selectedId,
  onSelect,
}: {
  current: Territory
  neighbours: Candidate[]
  catcherId: string
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const project = (lat: number, lng: number) => {
    const [x, y] = toMeters(lat, lng, current.lat, current.lng)
    return [x, -y] as const
  }
  const shapes = [{ t: current, x: 0, y: 0 }, ...neighbours.map((k) => ({ t: k.t, x: k.x, y: -k.y }))].map((s) => ({
    ...s,
    points: s.t.corners.map(([lat, lng]) => project(lat, lng)),
  }))
  const all = shapes.flatMap((s) => s.points)
  const pad = 40
  const minX = Math.min(...all.map((p) => p[0])) - pad
  const maxX = Math.max(...all.map((p) => p[0])) + pad
  const minY = Math.min(...all.map((p) => p[1])) - pad
  const maxY = Math.max(...all.map((p) => p[1])) + pad
  const radius = Math.max(...shapes[0].points.map((p) => Math.hypot(p[0], p[1])), 60)
  const font = radius * 0.32
  const sel = shapes.find((s) => s.t.id === selectedId)

  return (
    <svg className="move-hexmap" viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Соседние сектора">
      <defs>
        <marker id="move-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
          <path d="M0 0 10 5 0 10Z" fill="#17181B" />
        </marker>
      </defs>
      {shapes.map((s) => {
        const isCurrent = s.t.id === current.id
        const isSel = s.t.id === selectedId
        const cls = isCurrent ? 'current' : isSel ? 'selected' : s.t.ownerId === catcherId ? 'catcher' : s.t.ownerId ? 'owned' : 'free'
        return (
          <g key={s.t.id} className={`move-hex ${cls}`} onClick={isCurrent ? undefined : () => onSelect(s.t.id)}>
            <polygon points={s.points.map((p) => p.join(',')).join(' ')} strokeWidth={radius * 0.05} />
            <text x={s.x} y={s.y + font * 0.35} fontSize={font} textAnchor="middle">
              {s.t.id}
            </text>
            {isCurrent && (
              <text x={s.x} y={s.y + font * 1.45} fontSize={font * 0.7} textAnchor="middle" className="move-hex-tag">
                сейчас
              </text>
            )}
          </g>
        )
      })}
      {sel && (
        <line
          x1={sel.x * 0.32}
          y1={sel.y * 0.32}
          x2={sel.x * 0.66}
          y2={sel.y * 0.66}
          stroke="#17181B"
          strokeWidth={radius * 0.06}
          strokeLinecap="round"
          markerEnd="url(#move-arrow)"
          pointerEvents="none"
        />
      )}
    </svg>
  )
}
