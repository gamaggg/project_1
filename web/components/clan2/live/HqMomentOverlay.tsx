'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { BuildMoment } from '@/components/clan2/BuildMoment'
import { useDemoNow } from '@/components/clan2/C2Common'
import { goLive } from '@/components/clan2/nav'
import { HqMoment, type HqMomentKind } from '@/components/clan2/HqMoment'
import { siegeMinutesOf, useDemoState } from '@/lib/clan2/demoStore'
import { requestMap, setLiveUi } from '@/lib/clan2/live/ui'
import { SIEGE_BREAK_REWARD } from '@/lib/clan2/rules'
import { PROJECT_IDS } from '@/lib/clan2/rules'
import type { ClanAlert, ProjectId, ProjectLevel } from '@/lib/clan2/types'
import { tn } from '@/lib/i18n/runtime'

// The clan's own headquarters, when something happens to it: a shield knocked off, a siege, the siege broken, the HQ
// fallen — and a building finished («Постройка готова», for the whole clan). The moment plays once over the app (on the map or the clan screen, wherever the player is, and when they come
// in from the notification), with what it means and a way to the sector. Which alert was last shown is kept in this
// browser, so a moment is never played twice.

const SEEN_KEY = (clanId: number) => `range:clan2-moment-seen:${clanId}`
// An alarm older than this is history, not news: it waits in the clan journal.
const FRESH_MS = 3 * 3_600_000

function readSeen(clanId: number): number {
  try {
    return Number(window.localStorage.getItem(SEEN_KEY(clanId)) ?? 0) || 0
  } catch {
    return 0
  }
}

// A finished build: the alert's text is «building:level» (a shop purchase uses the same kind with the item's id alone).
function builtOf(a: ClanAlert): { id: ProjectId; level: ProjectLevel } | null {
  if (a.kind !== 'project_done') return null
  const [id, lv] = a.text.split(':')
  const level = Number(lv)
  return PROJECT_IDS.includes(id as ProjectId) && level >= 1 && level <= 3 ? { id: id as ProjectId, level: level as ProjectLevel } : null
}

// What an alert of the clan's HQ plays as (null: not one of them).
function momentOf(a: ClanAlert): { kind: HqMomentKind; defense?: number; coins?: number; name?: string } | null {
  if (a.kind === 'sector_attack' && a.text.startsWith('hq:')) return { kind: 'hit', defense: Number(a.text.slice(3)) || 0 }
  if (a.kind === 'hq_siege') return { kind: 'siege' }
  if (a.kind === 'hq_saved') return { kind: 'saved', name: a.text }
  if (a.kind === 'hq_fallen') return { kind: 'fell', coins: -(Number(a.text.split(':')[1]) || 0) }
  return null
}

export function HqMomentOverlay({ visible, onOpenClan }: { visible: boolean; onOpenClan?: (clanId: number) => void }) {
  const s = useDemoState()
  // The game's clock (it ticks every second; the test bench may have moved it on).
  const clock = useDemoNow()
  const [closed, setClosed] = useState(0)
  if (!s.live || !visible) return null
  const clanId = s.live.clanId
  const seen = Math.max(readSeen(clanId), closed)
  const now = clock
  const alert = s.alerts.find((a) => a.id > seen && now - a.at < FRESH_MS && (momentOf(a) || builtOf(a)))
  if (!alert) return null
  const close = () => {
    try {
      window.localStorage.setItem(SEEN_KEY(clanId), String(alert.id))
    } catch {}
    setClosed(alert.id)
  }
  const built = builtOf(alert)
  if (built)
    return createPortal(
      <div className="hqx-overlay" onClick={close}>
        <div className="hqx-card" role="dialog" aria-label={tn('clan2.moment.built', { name: '', n: built.level })} onClick={(e) => e.stopPropagation()}>
          <BuildMoment id={built.id} level={built.level} crest={s.clan.crest} size={260} />
          <p>{tn('clan2.moment.textBuilt')}</p>
          <div className="c2-row-btns">
            <button className="btn-secondary" onClick={close}>
              {tn('clan2.moment.ok')}
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                close()
                setLiveUi({ hqSheet: false, baseSel: built.id })
                goLive('base')
                onOpenClan?.(clanId)
              }}
            >
              {tn('clan2.moment.toBase')}
            </button>
          </div>
        </div>
      </div>,
      document.body
    )
  const m = momentOf(alert)!
  const sectorId = alert.sectorId ?? s.hq.sectorId ?? undefined
  const toMap = m.kind === 'hit' || m.kind === 'siege'
  return createPortal(
    <div className="hqx-overlay" onClick={close}>
      <div className="hqx-card" role="dialog" aria-label={tn('clan2.hq.title')} onClick={(e) => e.stopPropagation()}>
        <HqMoment kind={m.kind} side="defender" crest={s.clan.crest} attackerCrest={{ shape: 'round', symbol: 'anchor', primary: '#D2452E', secondary: '#FFE7A0' }} defense={m.defense} minutes={siegeMinutesOf(s)} coins={m.kind === 'saved' ? SIEGE_BREAK_REWARD : m.coins} name={m.name} size={260} />
        <p>{tn(`clan2.moment.text${m.kind === 'hit' ? 'Hit' : m.kind === 'siege' ? 'Siege' : m.kind === 'saved' ? 'Saved' : 'Fell'}`)}</p>
        <div className="c2-row-btns">
          {toMap && sectorId ? (
            <>
              <button className="btn-secondary" onClick={close}>
                {tn('clan2.moment.ok')}
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  close()
                  setLiveUi({ hqSheet: false })
                  requestMap({ sectorId })
                }}
              >
                {tn('clan2.moment.toMap')}
              </button>
            </>
          ) : (
            <button className="btn-primary" onClick={close}>
              {tn('clan2.moment.ok')}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
