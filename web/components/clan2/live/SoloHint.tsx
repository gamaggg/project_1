'use client'

import '@/app/clan2.css'
import { useState } from 'react'
import { useOtherHqs } from '@/lib/clan2/live/otherHqs'
import { tn } from '@/lib/i18n/runtime'

// The way into a clan for a player without one: on the «Кланы» layer, under the map's panel, one line says that the
// flags are the clans' headquarters and a tap on one shows the clan's base and how to join. Closed with ×, it stays
// closed in this browser.
const KEY = 'range:clan2-solo-hint'

function readClosed(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function Clan2SoloHint() {
  const others = useOtherHqs()
  const [closed, setClosed] = useState(readClosed)
  if (closed || others.length === 0) return null
  return (
    <div className="c2-solo-hint" role="note">
      <span className="c2-solo-hint-flag" aria-hidden>
        <svg width="14" height="14" viewBox="0 0 14 14">
          <path d="M3.5 1.5v11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M4.1 2.2h7.2l-1.7 2.9 1.7 2.9H4.1z" fill="currentColor" />
        </svg>
      </span>
      <span className="c2-solo-hint-text">{tn('clan2.other.hint', { n: others.length })}</span>
      <button
        type="button"
        className="c2-solo-hint-close"
        aria-label={tn('clan2.other.hintClose')}
        onClick={() => {
          try {
            window.localStorage.setItem(KEY, '1')
          } catch {}
          setClosed(true)
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
          <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}
