'use client'

import { useEffect, useLayoutEffect, useRef } from 'react'
import type { TabScreenId } from '@/components/app-shell/FishZoneApp'
import { tn } from '@/lib/i18n/runtime'

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
  // The glass capsule behind the active tab: one element that slides to the
  // active tab and takes its size, so it fits whatever the labels need.
  const indicatorRef = useRef<HTMLSpanElement>(null)
  const place = () => {
    const nav = ref.current
    const ind = indicatorRef.current
    if (!nav || !ind) return
    const tab = nav.querySelector<HTMLElement>('.navitem.active')
    if (!tab) {
      ind.style.opacity = '0'
      return
    }
    ind.style.opacity = '1'
    // As wide as the tab, and always at least 18px wider than its label, so a
    // long name (Сектора, სექტორები) has room on both sides; never under
    // 54px for a short one. Centred on the tab and kept 6px inside the bar (the
    // capsule's top, bottom and radius are in the stylesheet, so it sits
    // concentric with the bar's own rounded edge).
    const label = tab.querySelector<HTMLElement>(':scope > span:last-child')
    let width = Math.min(nav.clientWidth - 12, Math.max(tab.offsetWidth, (label?.scrollWidth ?? 0) + 18, 54))
    let left = Math.max(6, Math.min(tab.offsetLeft + tab.offsetWidth / 2 - width / 2, nav.clientWidth - 6 - width))
    // The two tabs beside the camera button: the capsule stops at the camera's
    // edge instead of sliding under it, and its camera-facing end fades out.
    const plus = nav.querySelector<HTMLElement>('.navitem-plus')
    let fade = ''
    if (plus) {
      // The orange badge is a little narrower than the camera's slot.
      const badge = plus.firstElementChild as HTMLElement | null
      const inset = badge ? (plus.offsetWidth - badge.offsetWidth) / 2 : 0
      const camLeft = plus.offsetLeft + inset
      const camRight = plus.offsetLeft + plus.offsetWidth - inset
      if (tab.nextElementSibling === plus) {
        width = Math.max(40, Math.min(left + width, camLeft - 3) - left)
        fade = 'right'
      } else if (tab.previousElementSibling === plus) {
        const right = left + width
        left = Math.max(left, camRight + 3)
        width = Math.max(40, right - left)
        fade = 'left'
      }
    }
    if (fade) ind.dataset.fade = fade
    else delete ind.dataset.fade
    ind.style.width = `${width}px`
    ind.style.transform = `translateX(${left}px)`
  }
  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Space the bar takes from the bottom of the screen (its height plus the
    // gap it floats at).
    const set = () => {
      document.documentElement.style.setProperty('--nav-h', `${el.offsetHeight + parseFloat(getComputedStyle(el).bottom) || 0}px`)
      // The bar's own height alone: the sector card is placed from it in CSS (--nav-lift).
      document.documentElement.style.setProperty('--nav-height', `${el.offsetHeight}px`)
      place()
    }
    set()
    const ro = new ResizeObserver(set)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // On a tab change the capsule slides; the first placement (and a language
  // change, which resizes the labels) happens without animating.
  useLayoutEffect(() => {
    place()
    const ind = indicatorRef.current
    if (!ind) return
    const id = requestAnimationFrame(() => ind.classList.add('ready'))
    return () => cancelAnimationFrame(id)
  }, [active])
  return (
    <>
    {/* Content scrolling under the pill (and the gap around it) blurs out */}
    <div className="nav-edge" aria-hidden />
    <div className="bottomnav" ref={ref}>
      <span className="nav-indicator" ref={indicatorRef} aria-hidden />
      <NavItem id="screen-map" active={active === 'screen-map'} onClick={onNavigate}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 4 3 6.5v14L9 18l6 2.5 6-2.5v-14L15 6.5 9 4Z" />
          <path d="M9 4v14M15 6.5v14" />
        </svg>
        <span>{tn('nav.map')}</span>
      </NavItem>
      <NavItem id="screen-territories" active={active === 'screen-territories'} onClick={onNavigate}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="9.85,4.88 14.15,4.88 16.3,8.6 14.15,12.32 9.85,12.32 7.7,8.6" />
          <polygon points="3.4,8.6 7.7,8.6 9.85,12.32 7.7,16.04 3.4,16.04 1.25,12.32" />
          <polygon points="16.3,8.6 20.6,8.6 22.75,12.32 20.6,16.04 16.3,16.04 14.15,12.32" />
          <polygon points="9.85,12.32 14.15,12.32 16.3,16.04 14.15,19.76 9.85,19.76 7.7,16.04" />
        </svg>
        <span>{tn('nav.territories')}</span>
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
        <span>{tn('nav.activity')}</span>
      </NavItem>
      <NavItem id="screen-profile" active={active === 'screen-profile'} onClick={onNavigate}>
        <span className="navitem-icon-wrap">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="3.6" />
            <path d="M4.5 20c1.6-3.8 4.6-5.7 7.5-5.7s5.9 1.9 7.5 5.7" />
          </svg>
          {profileCount > 0 && (
            <span className="nav-badge" aria-label={tn('nav.waiting', { count: profileCount })}>
              {profileCount > 9 ? '9+' : profileCount}
            </span>
          )}
        </span>
        <span>{tn('nav.profile')}</span>
      </NavItem>
    </div>
    </>
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
