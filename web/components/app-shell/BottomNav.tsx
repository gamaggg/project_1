'use client'

import { useEffect, useRef } from 'react'
import type { TabScreenId } from '@/components/app-shell/FishZoneApp'

export function BottomNav({
  active,
  onNavigate,
  onPlus,
  plusPending,
  unreadCount = 0,
  clanChatUnread = 0,
  shopRewards = 0,
}: {
  active: TabScreenId
  onNavigate: (id: TabScreenId) => void
  onPlus: () => void
  plusPending?: boolean
  unreadCount?: number
  // Unread messages in the player's clan chat — the chat is reached through
  // the profile's clan card, so its count rides on the profile tab.
  clanChatUnread?: number
  // Slot spins waiting in the Shop (lib/shopRewards.ts) — the Shop is
  // reached through the profile too.
  shopRewards?: number
}) {
  const profileCount = clanChatUnread + shopRewards
  // The bar's real height (82px, or more with a home-indicator inset) as
  // --nav-h, so the map's sector card can sit a fixed gap above it.
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const set = () => document.documentElement.style.setProperty('--nav-h', `${el.offsetHeight}px`)
    set()
    const ro = new ResizeObserver(set)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div className="bottomnav" ref={ref}>
      <NavItem id="screen-map" active={active === 'screen-map'} onClick={onNavigate}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 4 3 6.5v14L9 18l6 2.5 6-2.5v-14L15 6.5 9 4Z" />
          <path d="M9 4v14M15 6.5v14" />
        </svg>
        <span>Карта</span>
      </NavItem>
      <NavItem id="screen-territories" active={active === 'screen-territories'} onClick={onNavigate}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="9.85,4.88 14.15,4.88 16.3,8.6 14.15,12.32 9.85,12.32 7.7,8.6" />
          <polygon points="3.4,8.6 7.7,8.6 9.85,12.32 7.7,16.04 3.4,16.04 1.25,12.32" />
          <polygon points="16.3,8.6 20.6,8.6 22.75,12.32 20.6,16.04 16.3,16.04 14.15,12.32" />
          <polygon points="9.85,12.32 14.15,12.32 16.3,16.04 14.15,19.76 9.85,19.76 7.7,16.04" />
        </svg>
        <span>Территории</span>
      </NavItem>
      <div
        data-tour="camera" className="navitem navitem-plus tap-scale"
        onClick={plusPending ? undefined : onPlus}
        style={plusPending ? { pointerEvents: 'none', opacity: 0.6 } : undefined}
      >
        <div className="navplus-badge">
          <svg width="29" height="29" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 7h3.2L9 4.5h6L16.8 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" />
            <circle cx="12" cy="13" r="3.4" />
          </svg>
        </div>
      </div>
      <NavItem id="screen-activity" active={active === 'screen-activity'} onClick={onNavigate}>
        <span className="navitem-icon-wrap">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12h4l2.5 7L14 5l2.5 7H21" />
          </svg>
          {unreadCount > 0 && <span className="nav-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
        </span>
        <span>Активность</span>
      </NavItem>
      <NavItem id="screen-profile" active={active === 'screen-profile'} onClick={onNavigate}>
        <span className="navitem-icon-wrap">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="3.6" />
            <path d="M4.5 20c1.6-3.8 4.6-5.7 7.5-5.7s5.9 1.9 7.5 5.7" />
          </svg>
          {profileCount > 0 && (
            <span className="nav-badge" aria-label={`Ждут в профиле: ${profileCount}`}>
              {profileCount > 9 ? '9+' : profileCount}
            </span>
          )}
        </span>
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
  id: TabScreenId
  active: boolean
  onClick: (id: TabScreenId) => void
  children: React.ReactNode
}) {
  return (
    <div className={`navitem tap-scale${active ? ' active' : ''}`} onClick={() => onClick(id)}>
      {children}
    </div>
  )
}
