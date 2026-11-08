'use client'

import { tn } from '@/lib/i18n'

// «Идут технические работы»: what everybody but the super admin sees while the switch is on (lib/supabase/queries/
// maintenance.ts). The brand's orange like the loading screen, what is going on, the super admin's own words if they
// wrote any, «check again», and at the bottom the way in for the super admin (a guest: the sign-in; someone signed in
// who is not the super admin: sign out and sign in again).
export function MaintenanceScreen({ message, checking, onRetry, onAdmin, adminLabel }: { message: string | null; checking: boolean; onRetry: () => void; onAdmin: () => void; adminLabel: string }) {
  return (
    <div className="app-shell maintenance-shell" role="main">
      {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset, same as LoadingShell */}
      <img src="/brand/logo_2.svg" alt="RANGE" className="maintenance-logo" />
      <div className="maintenance-card">
        <span className="maintenance-icon" aria-hidden>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z" />
          </svg>
        </span>
        <h1>{tn('maintenance.title')}</h1>
        <p>{tn('maintenance.text')}</p>
        {message && <p className="maintenance-note">{message}</p>}
        <button type="button" className="maintenance-retry tap-scale" onClick={onRetry} disabled={checking}>
          {tn('maintenance.retry')}
        </button>
      </div>
      <button type="button" className="maintenance-admin" onClick={onAdmin}>
        {adminLabel}
      </button>
    </div>
  )
}
