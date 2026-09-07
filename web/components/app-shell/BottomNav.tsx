'use client'

import type { ScreenId } from '@/components/app-shell/FishZoneApp'

const TABS: { id: ScreenId; label: string }[] = [
  { id: 'screen-map', label: 'Карта' },
  { id: 'screen-territories', label: 'Территории' },
  { id: 'screen-activity', label: 'Активность' },
  { id: 'screen-profile', label: 'Профиль' },
]

export function BottomNav({
  active,
  onNavigate,
  onPlus,
  plusPending,
}: {
  active: ScreenId
  onNavigate: (id: ScreenId) => void
  onPlus: () => void
  plusPending?: boolean
}) {
  return (
    <div className="bottomnav">
      <NavItem id="screen-map" active={active === 'screen-map'} onClick={onNavigate}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 4 3 6.5v14L9 18l6 2.5 6-2.5v-14L15 6.5 9 4Z" />
          <path d="M9 4v14M15 6.5v14" />
        </svg>
        <span>Карта</span>
      </NavItem>
      <NavItem id="screen-territories" active={active === 'screen-territories'} onClick={onNavigate}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
          <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
        </svg>
        <span>Территории</span>
      </NavItem>
      <div className="navitem tap-scale" onClick={plusPending ? undefined : onPlus} style={plusPending ? { pointerEvents: 'none', opacity: 0.6 } : undefined}>
        <div className="navplus-badge">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </div>
      </div>
      <NavItem id="screen-activity" active={active === 'screen-activity'} onClick={onNavigate}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12h4l2.5 7L14 5l2.5 7H21" />
        </svg>
        <span>Активность</span>
      </NavItem>
      <NavItem id="screen-profile" active={active === 'screen-profile'} onClick={onNavigate}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="3.6" />
          <path d="M4.5 20c1.6-3.8 4.6-5.7 7.5-5.7s5.9 1.9 7.5 5.7" />
        </svg>
        <span>Профиль</span>
      </NavItem>
    </div>
  )
}

function NavItem({
  id,
  active,
  onClick,
  children,
}: {
  id: ScreenId
  active: boolean
  onClick: (id: ScreenId) => void
  children: React.ReactNode
}) {
  return (
    <div className={`navitem tap-scale${active ? ' active' : ''}`} onClick={() => onClick(id)}>
      {children}
    </div>
  )
}
