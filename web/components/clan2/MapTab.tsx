'use client'

import { useEffect, useRef, useState } from 'react'
import { CoinIcon } from '@/components/app-shell/CoinIcon'
import { AlertsCard } from '@/components/clan2/ExitTab'
import { Hq3D } from '@/components/clan2/Hq3D'
import { ruinsMarkerHtml } from '@/lib/clan2/live/hqMarker'
import { MapCanvas, type MapLayer } from '@/components/clan2/MapCanvas'
import { C2Sheet, fmtLeft, useC2, useDemoNow } from '@/components/clan2/C2Common'
import type { MapFocus } from '@/components/clan2/HqTab'
import { canManage, defendHq, inClan, placeHq, useDemoState } from '@/lib/clan2/demoStore'
import { fitLayout, hexCenter, type MapLayout } from '@/lib/clan2/mapLayout'
import { tn } from '@/lib/i18n/runtime'

// The map of the preview: the same hexagonal sectors as the real one, the
// clan's headquarters standing on the «Кланы» layer, the siege banner, and the
// bell with the clan's alerts. A tap on a sector opens its card; with a
// headquarters being placed, a tap on a clan sector puts it there.

const ENEMY_CREST = { shape: 'hex', symbol: 'pike', primary: '#8F2B22', secondary: '#F5D7A1' }

export function MapTab({ focus, onOpenHq }: { focus?: MapFocus; onOpenHq?: () => void }) {
  const s = useDemoState()
  const now = useDemoNow()
  const { act } = useC2()
  const boxRef = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<MapLayout | null>(null)
  const [layer, setLayer] = useState<MapLayer>('clans')
  const [selected, setSelected] = useState<string | null>(null)
  const [placing, setPlacing] = useState(false)
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [seen, setSeen] = useState<MapFocus | undefined>(undefined)

  // A request from another screen («Показать на карте», «Поставить штаб», «Маршрут»), taken once.
  if (focus && focus !== seen) {
    setSeen(focus)
    if (focus.place) setPlacing(true)
    if (focus.sectorId) setSelected(focus.sectorId)
  }

  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const measure = () => setLayout(fitLayout(box.clientWidth, box.clientHeight))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(box)
    return () => ro.disconnect()
  }, [])

  const unread = s.alerts.filter((a) => !a.read).length
  const sel = s.sectors.find((x) => x.id === selected) ?? null
  const hqSector = s.sectors.find((x) => x.id === s.hq.sectorId)
  const manage = canManage(s)
  const siege = s.hq.siege
  const clans = layer === 'clans'

  const pick = (id: string | null) => {
    if (placing && id) {
      const moving = !!s.hq.sectorId
      if (act(placeHq(id), moving ? 'hqMoved' : 'hqPlaced')) setPlacing(false)
      return
    }
    setSelected(id)
  }

  const owner = (o: string) => (o === 'mine' ? tn('clan2.map.ownerMine') : o === 'ally' ? tn('clan2.map.ownerAlly') : o === 'enemy' ? tn('clan2.map.ownerEnemy') : tn('clan2.map.ownerFree'))

  return (
    <div className="c2-map" ref={boxRef}>
      {layout && (
        <>
          <MapCanvas sectors={s.sectors} layer={layer} layout={layout} selectedId={selected} placing={placing} clanColor={s.clan.crest.primary} onPick={pick} />
          {clans &&
            s.sectors
              .filter((x) => x.hq)
              .map((x) => {
                const c = hexCenter(layout, x.q, x.r)
                const mine = x.hq === 'mine'
                return <Hq3D key={x.id} crest={mine ? s.clan.crest : ENEMY_CREST} x={c.x} y={c.y + layout.s * 0.55} enemy={!mine} siege={mine && !!siege} label={mine ? tn('clan2.map.hqHere') : tn('clan2.map.hqEnemy')} onClick={() => pick(x.id)} />
              })}
          {clans && s.hq.ruins && now < s.hq.ruins.until && (() => {
            const r = s.sectors.find((x) => x.id === s.hq.ruins!.sectorId)
            if (!r) return null
            const c = hexCenter(layout, r.q, r.r)
            return <span className="c2-ruins-abs" style={{ left: c.x, top: c.y + layout.s * 0.55 }} dangerouslySetInnerHTML={{ __html: ruinsMarkerHtml(tn('clan2.base.ruins')) }} />
          })()}
        </>
      )}

      <div className="c2-map-hud">
        <div className="c2-seg c2-map-layers" role="tablist">
          <button role="tab" aria-selected={!clans} className={!clans ? 'on' : undefined} onClick={() => setLayer('players')}>
            {tn('clan2.map.layerPlayers')}
          </button>
          <button role="tab" aria-selected={clans} className={clans ? 'on' : undefined} onClick={() => setLayer('clans')} data-tour="map-layer">
            {tn('clan2.map.layerClans')}
          </button>
        </div>
        <div className="c2-map-right">
          <span className="c2-daily" title={tn('clan2.map.daily')}>
            <CoinIcon size={20} />
            <b>+30</b>
          </span>
          {inClan(s) && (
            <button className="c2-bell" onClick={() => setAlertsOpen(true)} aria-label={tn('clan2.alerts.title')} data-tour="map-bell">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7zM10 20a2 2 0 0 0 4 0" />
              </svg>
              {unread > 0 && <i className="c2-badge">{unread}</i>}
            </button>
          )}
        </div>
      </div>

      {siege && hqSector && (
        <div className="c2-map-banner danger" role="alert">
          <span>{tn('clan2.map.siegeBar', { t: fmtLeft(siege.endsAt - now) })}</span>
          <button onClick={() => act(defendHq())}>{tn('clan2.map.defend')}</button>
        </div>
      )}
      {placing && (
        <div className="c2-map-banner">
          <span>{tn('clan2.map.placing')}</span>
          <button onClick={() => setPlacing(false)}>{tn('clan2.map.cancel')}</button>
        </div>
      )}

      <div className="c2-map-foot">
        <p>{tn('clan2.map.hint')}</p>
        <div className="c2-legend">
          <span className="mine">{tn('clan2.map.legendMine')}</span>
          <span className="ally">{tn('clan2.map.legendAlly')}</span>
          <span className="enemy">{tn('clan2.map.legendEnemy')}</span>
          <span className="free">{tn('clan2.map.legendFree')}</span>
        </div>
      </div>

      <C2Sheet open={!!sel} onClose={() => setSelected(null)} title={sel ? tn('clan2.map.sector', { id: sel.id }) : ''}>
        {sel && (
          <>
            <div className="c2-chips-row">
              <span className={`c2-chip ${sel.owner === 'mine' ? 'accent' : ''}`}>{owner(sel.owner)}</span>
              {sel.owner !== 'free' && <span className="c2-chip">{tn('clan2.map.defenseN', { n: sel.defense })}</span>}
              {sel.shield && <span className="c2-chip good">{tn('clan2.map.shield')}</span>}
              {sel.hot && <span className="c2-chip warn">{tn('clan2.map.hot')}</span>}
              {sel.shared > 1 && <span className="c2-chip">{tn('clan2.map.sharedN', { n: sel.shared })}</span>}
              {sel.hq === 'mine' && <span className="c2-chip accent">{tn('clan2.map.hqHere')}</span>}
              {sel.hq === 'enemy' && <span className="c2-chip bad">{tn('clan2.map.hqEnemy')}</span>}
            </div>
            {sel.hq === 'mine' && (
              <button className="btn-primary" onClick={() => (setSelected(null), onOpenHq?.())}>
                {tn('clan2.map.openHq')}
              </button>
            )}
            {manage && sel.owner === 'mine' && !sel.hq && (
              <button
                className="btn-secondary"
                onClick={() => {
                  const moving = !!s.hq.sectorId
                  if (act(placeHq(sel.id), moving ? 'hqMoved' : 'hqPlaced')) setSelected(null)
                }}
              >
                {s.hq.sectorId ? tn('clan2.map.moveHere', { n: s.settings.hqMoveCost }) : tn('clan2.map.placeHere', { n: s.settings.hqPlaceCost })}
              </button>
            )}
          </>
        )}
      </C2Sheet>

      <C2Sheet open={alertsOpen} onClose={() => setAlertsOpen(false)} title={tn('clan2.alerts.title')}>
        <AlertsCard
          onOpenSector={(id) => {
            setAlertsOpen(false)
            setSelected(id)
          }}
        />
      </C2Sheet>
    </div>
  )
}
