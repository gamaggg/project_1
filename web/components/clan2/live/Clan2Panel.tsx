'use client'

import '@/app/clan2.css'
import { AdminTab } from '@/components/clan2/AdminTab'
import { C2PortalProvider, C2Toast, C2ToastProvider } from '@/components/clan2/C2Common'
import { ExitTab } from '@/components/clan2/ExitTab'
import { GloryTab } from '@/components/clan2/GloryTab'
import { HqTab } from '@/components/clan2/HqTab'
import { MembersTab } from '@/components/clan2/MembersTab'
import { ShopTab } from '@/components/clan2/ShopTab'
import { TreasuryTab, type ClanEventLine } from '@/components/clan2/TreasuryTab'
import { WeekTab } from '@/components/clan2/WeekTab'
import { goLive, useFocusScroll } from '@/components/clan2/nav'
import { requestMap, setLiveUi } from '@/lib/clan2/live/ui'
import { useLiveSynced } from '@/lib/clan2/demoStore'
import { tn } from '@/lib/i18n/runtime'

// One section of the clan update inside the real clan screen (components/app-shell/screens/ClanScreen.tsx).
export type Clan2Section = 'treasury' | 'shop' | 'exit' | 'week' | 'hq' | 'glory' | 'admin'
export const CLAN2_SECTIONS: Clan2Section[] = ['treasury', 'shop', 'exit', 'week', 'hq', 'glory']

export function Clan2Panel({ section, events, onOpenCatch }: { section: Clan2Section; events?: ClanEventLine[]; onOpenCatch?: (id: number, ids: number[]) => void }) {
  useFocusScroll()
  // Just bound to this clan (the app opened, or the player came back from another clan): until the server answers,
  // the store holds only the copy saved in this browser last time. A placeholder instead of its old numbers; the
  // sections then mount with the real ones, so the treasury's «+N» plays only for coins that really came in.
  const synced = useLiveSynced()
  if (!synced) {
    return (
      <div className="c2-live-panel c2-stack" role="status" aria-busy="true" aria-label={tn('common.loading')}>
        <section className="c2-card card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="skeleton-line" style={{ width: '34%' }} />
          <div className="skeleton-line" style={{ width: '58%', height: 30, borderRadius: 10 }} />
          <div className="skeleton-line" style={{ width: '100%' }} />
          <div className="skeleton-line" style={{ width: '72%' }} />
        </section>
      </div>
    )
  }
  return (
    <C2PortalProvider value="body">
      <C2ToastProvider>
        <div className="c2-live-panel c2-stack">
          {section === 'treasury' && <TreasuryTab onGo={goLive} events={events} onTour={() => setLiveUi({ tour: true })} />}
          {section === 'shop' && (
            <div data-focus="shop-top" data-tour="shop-top">
              <ShopTab />
            </div>
          )}
          {section === 'exit' && (
            <>
              <ExitTab />
              <MembersTab />
            </>
          )}
          {section === 'week' && <WeekTab />}
          {section === 'hq' && <HqTab onGoMap={(focus) => requestMap(focus ?? {})} />}
          {section === 'glory' && <GloryTab onOpenCatch={onOpenCatch} />}
          {section === 'admin' && <AdminTab bare />}
        </div>
        <C2Toast />
      </C2ToastProvider>
    </C2PortalProvider>
  )
}
