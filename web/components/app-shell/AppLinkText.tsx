'use client'

import type { ReactNode } from 'react'
import { APP_LINK_RE } from '@/lib/moderation'

// FishZoneApp listens for this and opens the link's target in place (sector,
// catch, clan, profile) — no reload, no leaving the app.
export const APP_LINK_EVENT = 'range:open-app-link'

// Punctuation that ends a sentence rather than the link («…?territory=B0488.»).
const TRAILING = /[.,!?;:)»"']+$/

function linkLabel(href: string): string {
  try {
    const p = new URL(/^https?:\/\//i.test(href) ? href : `https://${href}`).searchParams
    const territory = p.get('territory')
    if (territory) return `Сектор ${territory}`
    if (p.get('catch')) return 'Улов'
    if (p.get('clan')) return 'Клан'
    const user = p.get('user')
    if (user) return `Профиль ${user}`
    if (p.get('achievement')) return 'Достижение'
  } catch {
    // Not a parseable URL — fall through to the plain label.
  }
  return 'RANGE'
}

// Splits text into plain runs and links to RANGE itself; the links render as
// small chips («Сектор B0488») that open in the app. Plain runs go through
// `renderText` — the clan chat highlights @mentions there.
export function renderWithAppLinks(text: string, renderText: (part: string, key: string) => ReactNode = (part) => part): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(APP_LINK_RE)) {
    const at = m.index ?? 0
    const href = m[0].replace(TRAILING, '')
    if (!href) continue
    if (at > last) out.push(renderText(text.slice(last, at), `t${last}`))
    out.push(
      <a
        key={`l${at}`}
        className="app-link"
        href={/^https?:\/\//i.test(href) ? href : `https://${href}`}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          window.dispatchEvent(new CustomEvent(APP_LINK_EVENT, { detail: href }))
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
        </svg>
        {linkLabel(href)}
      </a>
    )
    last = at + href.length
  }
  if (last < text.length) out.push(renderText(text.slice(last), `t${last}`))
  return out
}
