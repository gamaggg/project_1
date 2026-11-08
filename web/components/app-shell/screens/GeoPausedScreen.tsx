'use client'

import { GeoHex } from '@/components/app-shell/screens/ProfileScreen'
import { tn } from '@/lib/i18n/runtime'

// «Где это?» on pause (GEO_PAUSED in lib/geo.ts): what a player sees instead
// of the game — from the profile's card or a shared ?geo=1 link. «Окей,
// понял» hides the profile's card for them for good (onOk saves the flag).
export function GeoPausedScreen({ onOk }: { onOk: () => void }) {
  return (
    <div className="geo-paused">
      <span className="profile-geo-art geo-paused-art" aria-hidden>
        <GeoHex />
        <span className="profile-geo-q">?</span>
      </span>
      <h2 className="geo-paused-title">{tn('geoGame.pausedTitle')}</h2>
      <p className="geo-paused-text">{tn('geoGame.pausedText')}</p>
      <button type="button" className="btn-primary geo-paused-ok" onClick={onOk}>
        {tn('geoGame.pausedOk')}
      </button>
    </div>
  )
}
