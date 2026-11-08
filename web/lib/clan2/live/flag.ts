'use client'

import { useSyncExternalStore } from 'react'

// The clan update in the real app. In a production build it is on only for whom the server lets in (lib/clan2/live/
// access.ts: the super admin and the members of the pilot clans while the treasury is not on for everybody, then
// everyone) — and only once the server's functions are there. In development a developer can also switch it on in this
// browser: ?clan2=1 on, ?clan2=0 off (then, until the functions are in the database, it is the browser-only preview).

const KEY = 'range:clan2'
const listeners = new Set<() => void>()
let allowed = false

// Set by the app from the server's answer (useClan2Access).
export function setClan2Allowed(on: boolean) {
  if (allowed === on) return
  allowed = on
  listeners.forEach((l) => l())
}

function read(): boolean {
  if (allowed) return true
  if (process.env.NODE_ENV === 'production') return false
  try {
    const q = new URLSearchParams(window.location.search).get('clan2')
    if (q === '1') window.localStorage.setItem(KEY, '1')
    if (q === '0') window.localStorage.removeItem(KEY)
    return window.localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function clan2Enabled(): boolean {
  return typeof window !== 'undefined' && read()
}

export function setClan2Enabled(on: boolean) {
  try {
    if (on) window.localStorage.setItem(KEY, '1')
    else window.localStorage.removeItem(KEY)
  } catch {}
  listeners.forEach((l) => l())
}

export function useClan2Enabled(): boolean {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => clan2Enabled(),
    () => false
  )
}

// The test bench (the wrench over the map: time, catches, attacks, «как участник»): hidden, so the update looks the way
// players will see it. A developer opens it with ?clan2tools=1 (and hides it again with ?clan2tools=0).
const TOOLS_KEY = 'range:clan2-tools'
export function clan2ToolsOn(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const q = new URLSearchParams(window.location.search).get('clan2tools')
    if (q === '1') window.localStorage.setItem(TOOLS_KEY, '1')
    if (q === '0') window.localStorage.removeItem(TOOLS_KEY)
    return window.localStorage.getItem(TOOLS_KEY) === '1'
  } catch {
    return false
  }
}
