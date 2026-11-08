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

// One section of the clan update inside the real clan screen (components/app-shell/screens/ClanScreen.tsx).
export type Clan2Section = 'treasury' | 'shop' | 'exit' | 'week' | 'hq' | 'glory' | 'admin'
export const CLAN2_SECTIONS: Clan2Section[] = ['treasury', 'shop', 'exit', 'week', 'hq', 'glory']

export function Clan2Panel({ section, events }: { section: Clan2Section; events?: ClanEventLine[] }) {
  useFocusScroll()
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
          {section === 'glory' && <GloryTab />}
          {section === 'admin' && <AdminTab bare />}
        </div>
        <C2Toast />
      </C2ToastProvider>
    </C2PortalProvider>
  )
}
