'use client'

import { useEffect, useRef } from 'react'

// The build this page was loaded from (next.config.ts inlines it); 'dev'
// locally, where there is nothing to update to.
const BUILT_VERSION = process.env.APP_VERSION ?? 'dev'

// Only a return after at least this long away checks — a quick switch to
// another app (copying a code, answering a message) never reloads anything.
const MIN_AWAY_MS = 30_000

// Remembers which version a reload was already made for, so a CDN that
// still serves the old page can't turn every return into another reload.
const RELOADED_FOR_KEY = 'fishzone:reloadedFor'

async function deployedVersion(): Promise<string | null> {
  try {
    const res = await fetch('/api/version', { cache: 'no-store' })
    if (!res.ok) return null
    const body = (await res.json()) as { version?: unknown }
    return typeof body.version === 'string' ? body.version : null
  } catch {
    return null
  }
}

function alreadyReloadedFor(version: string): boolean {
  try {
    return sessionStorage.getItem(RELOADED_FOR_KEY) === version
  } catch {
    return false
  }
}

function markReloadedFor(version: string) {
  try {
    sessionStorage.setItem(RELOADED_FOR_KEY, version)
  } catch {}
}

// Something typed that a reload would throw away — any visible text field
// with content (hidden screens are visibility:hidden, so they don't count).
export function hasVisibleTypedText(): boolean {
  const skip = new Set(['checkbox', 'radio', 'range', 'hidden', 'button', 'submit', 'reset', 'color', 'file'])
  for (const el of document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')) {
    if (el instanceof HTMLInputElement && skip.has(el.type)) continue
    if (el.readOnly || el.disabled || !el.value.trim()) continue
    if (!el.getClientRects().length || getComputedStyle(el).visibility !== 'visible') continue
    return true
  }
  return false
}

// A Mini App stays open in Telegram for days, so players kept running a
// build from before the latest deploy (on 28.09 a clan leader's share link
// lacked the new invite code for exactly that reason). On coming back after
// a while, this asks the server which version is live and, if it's newer and
// nothing would be lost (`canReload`), reloads onto `resumeUrl` — the deep
// link of the screen that was open, so the player lands where they were.
export function useAppUpdate(canReload: () => boolean, resumeUrl: () => string) {
  const canReloadRef = useRef(canReload)
  const resumeUrlRef = useRef(resumeUrl)
  useEffect(() => {
    canReloadRef.current = canReload
    resumeUrlRef.current = resumeUrl
  })

  useEffect(() => {
    if (BUILT_VERSION === 'dev') return
    let awaySince = document.hidden ? Date.now() : 0
    let checking = false

    async function check() {
      if (checking) return
      checking = true
      const latest = await deployedVersion()
      checking = false
      if (!latest || latest === BUILT_VERSION || document.hidden) return
      if (alreadyReloadedFor(latest) || !canReloadRef.current()) return
      markReloadedFor(latest)
      window.location.replace(resumeUrlRef.current() + window.location.hash)
    }
    function away() {
      if (!awaySince) awaySince = Date.now()
    }
    function back() {
      const since = awaySince
      awaySince = 0
      if (since && Date.now() - since >= MIN_AWAY_MS) void check()
    }
    const onVisibility = () => (document.hidden ? away() : back())

    // Telegram doesn't always hide the page when the Mini App is minimized;
    // its own activated/deactivated events (Bot API 8.0) cover that case.
    const webApp = window.Telegram?.WebApp
    document.addEventListener('visibilitychange', onVisibility)
    webApp?.onEvent?.('deactivated', away)
    webApp?.onEvent?.('activated', back)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      webApp?.offEvent?.('deactivated', away)
      webApp?.offEvent?.('activated', back)
    }
  }, [])
}
