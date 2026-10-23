'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/components/providers/AuthProvider'
import { InstallAppModal } from '@/components/app-shell/InstallAppModal'
import { useCanInstall } from '@/lib/installApp'
import { tourLocked } from '@/lib/tourLock'
import { useUiState } from '@/lib/uiState'
import { tn } from '@/lib/i18n/runtime'

// Once per account (and per device, for a device that cannot reach the
// account's flags): after the player is settled on the map, a small offer to
// put RANGE on the home screen. «Подробнее» opens the full guide, «Закрыть»
// says where to find it again — Profile, at the bottom. Counted as seen the
// moment it appears, so closing the app halfway does not bring it back.
const UI_KEY = 'install_offer_seen'
const storageKey = (userId: string) => `fishzone:installOffer:${userId}`

// Something already on screen (a sheet, a modal, a tour) goes first.
const busy = () => tourLocked() || !!document.querySelector('.modal-overlay, .move-sheet-overlay, .recap-player, .tour-root')

export function InstallOffer({ blocked, onToast }: { blocked: boolean; onToast: (msg: string, ms?: number) => void }) {
  const { user } = useAuth()
  const ui = useUiState()
  const canInstall = useCanInstall()
  const [seenHere, setSeenHere] = useState<boolean | null>(null)
  const [step, setStep] = useState<'idle' | 'offer' | 'guide'>('idle')

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

  const seenOnAccount = ui.state?.[UI_KEY] === true
  const due = !!user && ui.ready && seenHere === false && !seenOnAccount && canInstall && !blocked && step === 'idle'

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
      setStep('offer')
    }
    // Not the first second: the map and its own first things settle first.
    timer = window.setTimeout(tryShow, 5000)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ui.set is stable per user; the rest is in due
  }, [due, user])

  function close() {
    setStep('idle')
    onToast(tn('install.offerLater'), 4800)
  }

  if (step === 'guide') return <InstallAppModal onClose={() => setStep('idle')} />
  if (step !== 'offer') return null
  return createPortal(
    <div className="modal-overlay" onClick={close}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element -- the app's own icon, a fixed small file */}
        <img className="install-offer-icon" src="/icon-192.png" alt="" width={64} height={64} />
        <div className="modal-title">{tn('install.offerTitle')}</div>
        <div className="modal-body">{tn('install.offerText')}</div>
        <button className="btn-primary" onClick={() => setStep('guide')}>
          {tn('install.offerMore')}
        </button>
        <button className="btn-secondary" style={{ marginTop: 10 }} onClick={close}>
          {tn('common.close')}
        </button>
      </div>
    </div>,
    document.body
  )
}
