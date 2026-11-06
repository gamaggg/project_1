'use client'

import '@/app/clan2.css'
import { useEffect, useMemo } from 'react'
import { ClanCrest } from '@/components/app-shell/ClanCrest'
import { C2Bar, C2Coins, C2PortalProvider, C2Sheet, C2Toast, C2ToastProvider, fmtLeft, useC2, useDemoNow } from '@/components/clan2/C2Common'
import { DemoPanel } from '@/components/clan2/DemoPanel'
import { AlertsCard } from '@/components/clan2/ExitTab'
import { applyReal, bindLive, defendHq, markAlertsRead, placeHq, resetLive, tick, useDemoState } from '@/lib/clan2/demoStore'
import { fetchRealClan } from '@/lib/clan2/live/real'
import { setClan2Enabled } from '@/lib/clan2/live/flag'
import { buildLiveState, hueOf, liveKey, syncLiveState, type LiveInput } from '@/lib/clan2/live/seed'
import { setLiveUi, useLiveUi } from '@/lib/clan2/live/ui'
import { DEFENSE_MAX } from '@/lib/clan2/rules'
import type { ClanDetail, Profile, Territory } from '@/lib/data/types'
import { tn } from '@/lib/i18n/runtime'

// The clan update inside the real app: binds the demo store to the player's real clan (read-only), keeps its
// clock running, and puts the pieces that belong to no screen of their own on top of the app: the test bench
// button, the bell with the clan's alerts, the siege / «place the HQ» bar, the HQ card and the confirmations.
// Everything new is kept in this browser (demoStore); the database is only read.

export function Clan2Live({
  territories,
  profile,
  clan,
  visible,
  onOpenClan,
}: {
  territories: Territory[]
  profile: Profile | null | undefined
  clan: ClanDetail | null | undefined
  visible: boolean
  onOpenClan: (id: number) => void
}) {
  const input = useMemo<LiveInput | null>(() => {
    if (!profile || !clan || !clan.myRole) return null
    return { clan, userId: profile.id, coins: profile.coins ?? 0, isSuperAdmin: profile.isSuperAdmin, territories }
  }, [profile, clan, territories])

  // Bound again whenever the real clan or the sectors change; what is saved here stays.
  useEffect(() => {
    if (!input) return
    bindLive(
      liveKey(input.userId, input.clan.id),
      () => buildLiveState(input),
      (d) => syncLiveState(d, input)
    )
  }, [input])

  // Where the HQ sector really is: the base screen puts the real map under its picture.
  const hqId = useDemoState().hq.sectorId
  useEffect(() => {
    const t = hqId ? territories.find((x) => x.id === hqId) : null
    const c = t?.corners
    setLiveUi({ hqGeo: t && c && c.length >= 4 ? { id: t.id, lat: t.lat, lng: t.lng, widthDeg: Math.abs(c[0][1] - c[3][1]) } : null })
  }, [hqId, territories])

  useEffect(() => {
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [])

  // The clan's real catches (read-only): the week's task progress, the hall of fame, who fished lately. Now and every five minutes.
  const clanForReal = input?.clan
  useEffect(() => {
    if (!clanForReal) return
    let stop = false
    const load = () =>
      fetchRealClan(clanForReal, Date.now())
        .then((r) => {
          if (!stop && r) applyReal(r, hueOf)
        })
        .catch(() => {})
    // The saved state is bound by the effect above; give it a moment, then read.
    const first = window.setTimeout(load, 600)
    const id = window.setInterval(load, 5 * 60_000)
    return () => {
      stop = true
      window.clearTimeout(first)
      window.clearInterval(id)
    }
  }, [clanForReal])

  if (!input) return null
  return (
    <C2PortalProvider value="body">
      <C2ToastProvider>
        <LiveLayer input={input} visible={visible} onOpenClan={onOpenClan} />
        <C2Toast />
      </C2ToastProvider>
    </C2PortalProvider>
  )
}

function LiveLayer({ input, visible, onOpenClan }: { input: LiveInput; visible: boolean; onOpenClan: (id: number) => void }) {
  const s = useDemoState()
  const ui = useLiveUi()
  const now = useDemoNow()
  const { act } = useC2()
  const bound = !!s.live && s.live.clanId === input.clan.id
  if (!bound) return null

  const unread = s.alerts.filter((a) => !a.read).length
  const siege = s.hq.siege
  const clock = new Date(now).toLocaleString('ru-RU', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
  const place = ui.confirmPlace ? s.sectors.find((x) => x.id === ui.confirmPlace) : null
  const moving = !!s.hq.sectorId
  const cost = moving ? s.settings.hqMoveCost : s.settings.hqPlaceCost
  const hqSector = s.sectors.find((x) => x.id === s.hq.sectorId)

  return (
    <>
      {visible && (
        <div className="c2-live-fabs">
          <button type="button" className="c2-live-fab" onClick={() => setLiveUi({ toolsOpen: true })} aria-label={tn('clan2.demo.tools')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z" />
            </svg>
          </button>
          <button type="button" className="c2-live-fab" onClick={() => setLiveUi({ alertsOpen: true })} aria-label={tn('clan2.alerts.title')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7zM10 20a2 2 0 0 0 4 0" />
            </svg>
            {unread > 0 && <i className="c2-badge">{unread}</i>}
          </button>
        </div>
      )}

      {visible && (siege || ui.placing) && (
        <div className="c2-live-stack">
          {siege && hqSector && (
            <div className="c2-live-banner danger" role="alert">
              <span>{tn('clan2.map.siegeBar', { t: fmtLeft(siege.endsAt - now) })}</span>
              <button onClick={() => act(defendHq())}>{tn('clan2.map.defend')}</button>
            </div>
          )}
          {ui.placing && (
            <div className="c2-live-banner">
              <span>{tn('clan2.map.placing')}</span>
              <button onClick={() => setLiveUi({ placing: false })}>{tn('clan2.map.cancel')}</button>
            </div>
          )}
        </div>
      )}

      <C2Sheet open={ui.toolsOpen} onClose={() => setLiveUi({ toolsOpen: false })} title={tn('clan2.demo.toolsTitle')}>
        <DemoPanel
          clock={clock}
          live
          onResetLive={() => resetLive(() => buildLiveState(input))}
          onOff={() => {
            setLiveUi({ toolsOpen: false })
            setClan2Enabled(false)
            window.location.reload()
          }}
        />
      </C2Sheet>

      <C2Sheet
        open={ui.alertsOpen}
        onClose={() => {
          setLiveUi({ alertsOpen: false })
          markAlertsRead()
        }}
        title={tn('clan2.alerts.title')}
      >
        <AlertsCard onOpenSector={() => setLiveUi({ alertsOpen: false })} />
      </C2Sheet>

      <C2Sheet open={!!ui.hqSheet && !!hqSector} onClose={() => setLiveUi({ hqSheet: false })} title={tn('clan2.hq.title')}>
        {hqSector && (
          <div className="c2-stack">
            <div className="c2-hq-head">
              <div className="c2-hq-crest">
                <ClanCrest crest={s.clan.crest} size={56} />
              </div>
              <div>
                <strong>{tn('clan2.hq.where', { id: hqSector.id })}</strong>
                <div className="c2-muted small">{tn('clan2.hq.defense', { n: hqSector.defense })}</div>
              </div>
            </div>
            <C2Bar value={hqSector.defense / DEFENSE_MAX} tone={hqSector.defense === 0 ? 'bad' : hqSector.defense <= 1 ? 'warn' : 'good'} />
            {siege && (
              <div className="c2-siege">
                <strong>{tn('clan2.hq.siege')}</strong>
                <span>{tn('clan2.hq.siegeLeft', { t: fmtLeft(siege.endsAt - now) })}</span>
                <small>{tn('clan2.hq.siegeHow')}</small>
                <button className="btn-primary" onClick={() => act(defendHq())}>
                  {tn('clan2.map.defend')}
                </button>
              </div>
            )}
            <button
              className="btn-secondary"
              onClick={() => {
                setLiveUi({ hqSheet: false, clanTab: 'hq' })
                onOpenClan(input.clan.id)
              }}
            >
              {tn('clan2.map.openHq')}
            </button>
          </div>
        )}
      </C2Sheet>

      <C2Sheet open={!!place} onClose={() => setLiveUi({ confirmPlace: null })} title={place ? tn('clan2.map.sector', { id: place.id }) : ''}>
        {place && (
          <div className="c2-stack">
            <p className="c2-muted">{moving ? tn('clan2.live.moveText', { id: place.id }) : tn('clan2.live.placeText', { id: place.id })}</p>
            <div className="c2-bld-cost">
              <span>{tn('clan2.base.inTreasury')}</span>
              <C2Coins n={s.treasury.balance} />
              <span>·</span>
              <span>{moving ? tn('clan2.live.moveCost') : tn('clan2.live.placeCost')}</span>
              <C2Coins n={cost} />
            </div>
            <div className="c2-row-btns">
              <button className="btn-secondary" onClick={() => setLiveUi({ confirmPlace: null })}>
                {tn('clan2.map.cancel')}
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  if (act(placeHq(place.id), moving ? 'hqMoved' : 'hqPlaced')) setLiveUi({ confirmPlace: null, placing: false })
                }}
              >
                {moving ? tn('clan2.map.moveHere', { n: cost }) : tn('clan2.map.placeHere', { n: cost })}
              </button>
            </div>
          </div>
        )}
      </C2Sheet>
    </>
  )
}
