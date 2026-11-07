'use client'

import '../clan2.css'
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { C2Toast, C2ToastProvider, useDemoNow } from '@/components/clan2/C2Common'
import { ClanScreen2 } from '@/components/clan2/ClanScreen2'
import type { MapFocus } from '@/components/clan2/HqTab'
import { MapTab } from '@/components/clan2/MapTab'
import { ProfileTab } from '@/components/clan2/ProfileTab'
import { C2Tour } from '@/components/clan2/C2Tour'
import type { SubTab } from '@/components/clan2/ClanScreen2'
import { ADMIN_TOUR, PLAYER_TOUR, type TourAudience, type TourStep } from '@/lib/clan2/tours'
import { AdminTab } from '@/components/clan2/AdminTab'
import { bindDemo, inClan, markTourSeen, tick, useDemoState } from '@/lib/clan2/demoStore'
import { currentLanguage, setCurrentLanguage, tn } from '@/lib/i18n/runtime'
import type { Lang } from '@/lib/i18n/core'
import { DemoPanel } from '@/components/clan2/DemoPanel'

// The shell of the demo: a control panel on the left (who you are, the clock,
// things that happen), a phone with the app on the right. On a phone-sized
// window the frame goes away and the panel folds above the screen.

type Tab = 'map' | 'clan' | 'profile' | 'admin'
const noop = () => () => {}

export function ClanPreview() {
  // Rendered on the client only: the demo's world is read from localStorage.
  const ready = useSyncExternalStore(noop, () => true, () => false)
  if (!ready) return null
  // The state of this page is the fictional clan's (the real app may have bound the store to a real one).
  bindDemo()
  return (
    <C2ToastProvider>
      <Shell />
    </C2ToastProvider>
  )
}

function Shell() {
  const s = useDemoState()
  const [tab, setTab] = useState<Tab>('clan')
  // The language of the demo: a change remounts the whole shell under the new one.
  const [lang, setLang] = useState<Lang>(() => currentLanguage())
  // Asked of the map by other screens (show a sector, set the HQ): a new object each time.
  const [mapFocus, setMapFocus] = useState<MapFocus | undefined>(undefined)
  const [sub, setSub] = useState<SubTab>('treasury')
  const [tour, setTour] = useState<TourAudience | null>(null)
  const now = useDemoNow()

  useEffect(() => {
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [])

  // The «Что нового» tour opens by itself the first time a player (or the admin) looks at the screen.
  const wantTour: TourAudience | null = s.persona === 'admin' && !s.toursSeen.admin ? 'admin' : inClan(s) && !s.toursSeen.player && s.persona !== 'admin' ? 'player' : null
  useEffect(() => {
    if (!wantTour || tour) return
    const id = window.setTimeout(() => setTour(wantTour), 900)
    return () => window.clearTimeout(id)
  }, [wantTour, tour])

  const current: Tab = tab === 'admin' && s.persona !== 'admin' ? 'clan' : tab
  const tabs: Tab[] = s.persona === 'admin' ? ['map', 'clan', 'profile', 'admin'] : ['map', 'clan', 'profile']
  const unread = s.alerts.filter((a) => !a.read).length
  const clock = new Date(now).toLocaleString('ru-RU', { weekday: 'short', hour: '2-digit', minute: '2-digit' })

  let body: ReactNode
  const goMap = (focus?: MapFocus) => {
    setMapFocus(focus ? { ...focus } : undefined)
    setTab('map')
  }
  if (current === 'clan') body = <ClanScreen2 onOpenSector={(id) => goMap({ sectorId: id })} onGoMap={goMap} sub={sub} onSub={setSub} />
  else if (current === 'map') body = <MapTab focus={mapFocus} onOpenHq={() => setTab('clan')} />
  else if (current === 'profile') body = <ProfileTab />
  else body = <AdminTab />

  return (
    <div className="c2-stage" key={lang}>
      <DemoPanel
        clock={clock}
        lang={lang}
        onLang={(l) => {
          setCurrentLanguage(l)
          setLang(l)
        }}
        onTour={() => setTour(s.persona === 'admin' ? 'admin' : 'player')}
      />
      <div className="c2-phone-wrap">
        <div className="c2-phone">
          <div className="c2-status" aria-hidden>
            <span>{new Date(now).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
            <span>RANGE</span>
          </div>
          <div className={`c2-phone-body${current === 'map' ? ' map' : ''}`} key={current}>
            {body}
          </div>
          <C2Toast />
          {tour && (
            <C2Tour
              steps={tour === 'admin' ? ADMIN_TOUR : PLAYER_TOUR}
              onStep={(st: TourStep) => {
                setTab(st.tab)
                if (st.sub) setSub(st.sub)
              }}
              onClose={() => {
                markTourSeen(tour)
                setTour(null)
              }}
            />
          )}
          <nav className="c2-tabbar" aria-label="RANGE">
            {tabs.map((t) => (
              <button key={t} className={current === t ? 'on' : undefined} onClick={() => setTab(t)} data-tour={`tab-${t}`}>
                {tn(`clan2.tab.${t}`)}
                {t === 'clan' && unread > 0 && <i className="c2-badge">{unread}</i>}
              </button>
            ))}
          </nav>
        </div>
      </div>
    </div>
  )
}
