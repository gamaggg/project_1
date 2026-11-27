'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/components/providers/AuthProvider'
import { SocialLinks } from '@/components/app-shell/SocialLinks'
import { tourLocked } from '@/lib/tourLock'
import { useUiState } from '@/lib/uiState'
import { tn } from '@/lib/i18n/runtime'

// Once per account (and per device, for a device that cannot reach the
// account's flags): «Мы в Telegram и соцсетях» with the same buttons as the
// profile block, and a line saying where they live — Profile, under «Как
// играть». Built like InstallOffer: on the map, after celebrations and tours,
// counted as seen the moment it appears. Not on a player's first day (account
// younger than 24 h), so it does not stack on onboarding and the install offer.
const UI_KEY = 'social_offer_seen'
const storageKey = (userId: string) => `fishzone:socialOffer:${userId}`
const DAY_MS = 24 * 3600 * 1000

const busy = () => tourLocked() || !!document.querySelector('.modal-overlay, .move-sheet-overlay, .recap-player, .tour-root')

export function SocialOffer({ blocked, memberSince }: { blocked: boolean; memberSince: string | null }) {
  const { user } = useAuth()
  const ui = useUiState()
  const [seenHere, setSeenHere] = useState<boolean | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!user) return
    let seen = false
    try {
      seen = localStorage.getItem(storageKey(user.id)) !== null
    } catch {
      // Storage blocked: the account's flag alone decides.
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads browser storage, only available after mount
    setSeenHere(seen)
  }, [user])

  const settled = !!memberSince && Date.now() - new Date(memberSince).getTime() >= DAY_MS
  const seenOnAccount = ui.state?.[UI_KEY] === true
  const due = !!user && ui.ready && seenHere === false && !seenOnAccount && settled && !blocked && !open

  useEffect(() => {
    if (!due || !user) return
    let timer = 0
    const tryShow = () => {
      if (busy()) {
        timer = window.setTimeout(tryShow, 2500)
        return
      }
      try {
        localStorage.setItem(storageKey(user.id), '1')
      } catch {
        // As above.
      }
      setSeenHere(true)
      ui.set(UI_KEY, true)
      setOpen(true)
    }
    timer = window.setTimeout(tryShow, 5000)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ui.set is stable per user; the rest is in due
  }, [due, user])

  if (!open) return null
  return createPortal(<SocialOfferCard onClose={() => setOpen(false)} />, document.body)
}

// The card alone, apart from when it shows.
export function SocialOfferCard({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-label={tn('profile.social.offerTitle')} onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{tn('profile.social.offerTitle')}</div>
        <div className="modal-body" style={{ margin: '8px 0 16px' }}>
          {tn('profile.social.offerText')}
        </div>
        <SocialLinks compact />
        <div className="social-offer-where">{tn('profile.social.offerWhere')}</div>
        <button className="btn-secondary" onClick={onClose}>
          {tn('common.gotIt')}
        </button>
      </div>
    </div>
  )
}
