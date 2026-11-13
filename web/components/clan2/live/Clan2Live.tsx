'use client'

import '@/app/clan2.css'
import { useEffect, useMemo } from 'react'
import { ClanCrest } from '@/components/app-shell/ClanCrest'
import { C2Coins, C2PortalProvider, C2Sheet, C2Toast, C2ToastProvider, fmtLeft, useC2, useDemoNow } from '@/components/clan2/C2Common'
import { DemoPanel } from '@/components/clan2/DemoPanel'
import { HqMomentOverlay } from '@/components/clan2/live/HqMomentOverlay'
import { applyReal, bindLive, defendHq, hqPlaceCostOf, placeHq, refreshFromServer, resetLive, serverOn, tick, useDemoState } from '@/lib/clan2/demoStore'
import { fetchRealClan } from '@/lib/clan2/live/real'
import { clan2ToolsOn, setClan2Enabled } from '@/lib/clan2/live/flag'
import { DefenseShields } from '@/components/app-shell/SectorDefense'
import { buildLiveState, hueOf, liveKey, syncLiveState, type LiveInput } from '@/lib/clan2/live/seed'
import { requestMap, setLiveUi, useLiveUi } from '@/lib/clan2/live/ui'
import { DEFENSE_MAX, SIEGE_BREAK_REWARD } from '@/lib/clan2/rules'
import type { ClanDetail, Profile, Territory } from '@/lib/data/types'
import { tn } from '@/lib/i18n/runtime'
import { appInFront, onAppFocus } from '@/lib/appFocus'
import { CLAN_NOTIFICATION_EVENT } from '@/lib/supabase/queries/realtime'

const CLAN_POLL_MS = 3 * 60_000

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

  // Where the base stands: the HQ's sector, or while there is no HQ the clan's busiest sector. The base screen puts
  // the real map of that place under its picture.
  const hqId = useDemoState().hq.sectorId
  const clanId = input?.clan.id ?? null
  useEffect(() => {
    const own = clanId == null ? [] : territories.filter((x) => x.ownerClanId === clanId)
    const t = (hqId ? territories.find((x) => x.id === hqId) : null) ?? own.reduce<Territory | null>((best, x) => (!best || x.catchCount > best.catchCount ? x : best), null)
    const c = t?.corners
    setLiveUi({ hqGeo: t && c && c.length >= 4 ? { id: t.id, lat: t.lat, lng: t.lng, widthDeg: Math.abs(c[0][1] - c[3][1]) } : null })
  }, [hqId, territories, clanId])

  useEffect(() => {
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [])

  // The server (once its functions are in the database): the clan read now, at once on a clan notification for
  // this player (useRealtimeSync) and when the app comes back in front, and every 3 minutes as a fallback while the
  // app is in front (was every 30 s: three requests each time from every clan member online). The player's own
  // actions read it again themselves (demoStore srv). The store mirrors it.
  const serverKey = input ? `${input.clan.id}:${input.userId}` : ''
  useEffect(() => {
    if (!serverKey) return
    const [clanId, userId] = serverKey.split(':')
    let last = 0
    const read = () => {
      last = Date.now()
      void refreshFromServer(Number(clanId), userId).catch(() => {})
    }
    const first = window.setTimeout(read, 300)
    const id = window.setInterval(() => {
      if (appInFront()) read()
    }, CLAN_POLL_MS)
    const stopFocus = onAppFocus((inFront) => {
      if (inFront && Date.now() - last > 20_000) read()
    })
    // A burst of clan notifications (a siege lands several at once) is one read.
    let nudge = 0
    const onClanNote = () => {
      window.clearTimeout(nudge)
      nudge = window.setTimeout(read, 1000)
    }
    window.addEventListener(CLAN_NOTIFICATION_EVENT, onClanNote)
    return () => {
      window.clearTimeout(first)
      window.clearTimeout(nudge)
      window.clearInterval(id)
      stopFocus()
      window.removeEventListener(CLAN_NOTIFICATION_EVENT, onClanNote)
    }
  }, [serverKey])

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
    const id = window.setInterval(() => {
      if (appInFront()) load()
    }, 5 * 60_000)
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

  const tools = clan2ToolsOn()
  const siege = s.hq.siege
  const clock = new Date(now).toLocaleString('ru-RU', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
  const place = ui.confirmPlace ? s.sectors.find((x) => x.id === ui.confirmPlace) : null
  const moving = !!s.hq.sectorId
  const cost = hqPlaceCostOf(s)
  const hqSector = s.sectors.find((x) => x.id === s.hq.sectorId)
  // On the server a siege is broken by a catch on the HQ sector: the button takes the player there.
  const defend = () => {
    if (serverOn() && s.hq.sectorId) {
      setLiveUi({ hqSheet: false })
      requestMap({ sectorId: s.hq.sectorId })
    } else act(defendHq())
  }

  return (
    <>
      {/* A shield lost, a siege, the siege broken, the HQ fallen: played once over the app. */}
      <HqMomentOverlay visible={visible} onOpenClan={onOpenClan} />
      {/* The test bench is for developers only (?clan2tools=1): players see the update without it. */}
      {visible && tools && (
        <div className="c2-live-fabs">
          <button type="button" className="c2-live-fab" onClick={() => setLiveUi({ toolsOpen: true })} aria-label={tn('clan2.demo.tools')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z" />
            </svg>
          </button>
        </div>
      )}

      {/* No floating «Штаб в осаде» bar any more (owner, 13.11): it covered the sector card and the clan screen's
          bottom; the siege is told by the HQ row of the sector card, the HQ tab, the base and the moment over the app. */}
      {visible && ui.placing && (
        <div className="c2-live-stack">
          <div className="c2-live-banner">
            <span>{tn('clan2.map.placing')}</span>
            <button onClick={() => setLiveUi({ placing: false })}>{tn('clan2.map.cancel')}</button>
          </div>
        </div>
      )}

      <C2Sheet open={tools && ui.toolsOpen} onClose={() => setLiveUi({ toolsOpen: false })} title={tn('clan2.demo.toolsTitle')}>
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
            <DefenseShields value={Math.min(DEFENSE_MAX, hqSector.defense)} size={18} />
            {siege && (
              <div className="c2-siege">
                <strong>{tn('clan2.hq.siege')}</strong>
                <span>{tn('clan2.hq.siegeLeft', { t: fmtLeft(siege.endsAt - now) })}</span>
                <small>{tn('clan2.hq.siegeHow', { r: SIEGE_BREAK_REWARD })}</small>
                <button className="btn-primary" onClick={defend}>
                  {tn('clan2.map.defend')}
                </button>
              </div>
            )}
            <button
              className="btn-secondary"
              onClick={() => {
                setLiveUi({ hqSheet: false, clanTab: 'hq', focus: 'hq-card' })
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
              {cost === 0 ? <b>{tn('clan2.hq.free')}</b> : <C2Coins n={cost} />}
            </div>
            {s.treasury.balance < cost && <p className="c2-short">{tn('clan2.base.missing', { n: cost - s.treasury.balance })}</p>}
            <div className="c2-row-btns">
              <button className="btn-secondary" onClick={() => setLiveUi({ confirmPlace: null })}>
                {tn('clan2.map.cancel')}
              </button>
              <button
                className="btn-primary"
                disabled={s.treasury.balance < cost}
                onClick={() => {
                  if (act(placeHq(place.id), moving ? 'hqMoved' : 'hqPlaced')) setLiveUi({ confirmPlace: null, placing: false })
                }}
              >
                {moving ? tn('clan2.hq.move') : cost === 0 ? tn('clan2.hq.placeFree') : tn('clan2.hq.place')}
              </button>
            </div>
          </div>
        )}
      </C2Sheet>
    </>
  )
}
