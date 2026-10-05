'use client'

import { createClient } from '@/lib/supabase/client'

// Our own usage stats (app_events, read by the super admin's «Статистика»
// screen). Events queue in memory and go to log_app_events in batches:
// every 30 s, at 20 queued, and when the app is hidden or closed — that
// last one with fetch keepalive, since the page may be gone a moment later.
// A random id per phone (localStorage) lets the newcomer funnel count
// people before they have an account. Stats must never break the app:
// every failure here is swallowed.

type QueuedEvent = { name: string; props?: Record<string, string | number | boolean | null>; city?: string; at: number }

const DEVICE_KEY = 'range:device'
const queue: QueuedEvent[] = []
let sessionId: string | null = null
let deviceId: string | null = null
let accessToken: string | null = null
let started = false

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

function ids(): { device: string; session: string } {
  if (!deviceId) {
    try {
      deviceId = window.localStorage.getItem(DEVICE_KEY)
      if (!deviceId) {
        deviceId = uuid()
        window.localStorage.setItem(DEVICE_KEY, deviceId)
      }
    } catch {
      deviceId = uuid()
    }
  }
  if (!sessionId) sessionId = uuid()
  return { device: deviceId, session: sessionId }
}

function start() {
  if (started || typeof window === 'undefined') return
  started = true
  const supabase = createClient()
  // Kept current so the keepalive send on close can carry the session
  // without awaiting anything.
  supabase.auth.getSession().then(({ data }) => {
    accessToken = data.session?.access_token ?? null
  })
  supabase.auth.onAuthStateChange((_event, session) => {
    accessToken = session?.access_token ?? null
  })
  window.setInterval(() => flush(false), 30_000)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush(true)
  })
  window.addEventListener('pagehide', () => flush(true))
}

// A dev server on this machine would fill the real table with test clicks.
function isLocal(): boolean {
  const h = window.location.hostname
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h.endsWith('.localhost')
}

export function track(name: string, props?: QueuedEvent['props'], city?: string) {
  if (typeof window === 'undefined' || isLocal()) return
  start()
  queue.push({ name, props, city, at: Date.now() })
  if (queue.length >= 20) flush(false)
}

function flush(closing: boolean) {
  if (!queue.length) return
  const events = queue.splice(0, 100)
  const { device, session } = ids()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return
  try {
    fetch(`${url}/rest/v1/rpc/log_app_events`, {
      method: 'POST',
      keepalive: closing,
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${accessToken ?? key}` },
      body: JSON.stringify({ p_device: device, p_session: session, p_events: events }),
    }).catch(() => {})
  } catch {}
}
