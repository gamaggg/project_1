'use client'

import '@/app/clan2.css'
import { AdminTab } from '@/components/clan2/AdminTab'
import { C2PortalProvider, C2Toast, C2ToastProvider } from '@/components/clan2/C2Common'
import { ExitTab } from '@/components/clan2/ExitTab'
import { GloryTab } from '@/components/clan2/GloryTab'
import { HubTab } from '@/components/clan2/HubTab'
import { HqTab } from '@/components/clan2/HqTab'
import { MembersTab } from '@/components/clan2/MembersTab'
import { TreasuryTab } from '@/components/clan2/TreasuryTab'
import { WeekTab } from '@/components/clan2/WeekTab'
import { IntroSheet } from '@/components/clan2/Guide'
import { markTourSeen, useDemoState } from '@/lib/clan2/demoStore'
import { requestMap, setLiveUi } from '@/lib/clan2/live/ui'

// One section of the clan update inside the real clan screen (components/app-shell/screens/ClanScreen.tsx).
export type Clan2Section = 'hub' | 'treasury' | 'exit' | 'week' | 'hq' | 'glory' | 'admin'
export const CLAN2_SECTIONS: Clan2Section[] = ['hub', 'treasury', 'hq', 'glory']

export function Clan2Panel({ section }: { section: Clan2Section }) {
  const s = useDemoState()
  return (
    <C2PortalProvider value="body">
    <C2ToastProvider>
      <div className="c2-live-panel c2-stack">
        {section === 'hub' && <HubTab onGo={(to) => setLiveUi({ clanTab: to })} onOpenSector={(id) => requestMap({ sectorId: id })} />}
        {section === 'treasury' && (
          <TreasuryTab
            onGo={(to) => {
              if (to === 'map') requestMap({ place: true })
              else if (to !== 'treasury') setLiveUi({ clanTab: to })
            }}
          />
        )}
        {section === 'exit' && (
          <>
            <ExitTab onOpenSector={(id) => requestMap({ sectorId: id })} />
            <MembersTab />
          </>
        )}
        {section === 'week' && <WeekTab />}
        {section === 'hq' && <HqTab onGoMap={(focus) => requestMap(focus ?? {})} />}
        {section === 'glory' && <GloryTab />}
        {section === 'admin' && <AdminTab bare />}
      </div>
      <IntroSheet open={section === 'hub' && !s.toursSeen.player && s.live !== undefined} onClose={() => markTourSeen('player')} />
      <C2Toast />
    </C2ToastProvider>
    </C2PortalProvider>
  )
}
