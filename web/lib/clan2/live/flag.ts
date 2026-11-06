'use client'

import { useSyncExternalStore } from 'react'

// The clan update runs in the real app only when a developer switches it on in
// this browser, and never in a production build: open the app with ?clan2=1 to
// switch it on, ?clan2=0 to switch it off. Nothing here talks to the database
// for writing: the new state of the clan lives in this browser (demoStore).

const KEY = 'range:clan2'
const listeners = new Set<() => void>()

function read(): boolean {
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
