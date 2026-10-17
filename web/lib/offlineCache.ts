'use client'

import { dehydrate, hydrate, type DehydratedState, type QueryClient, type QueryKey } from '@tanstack/react-query'

type DehydratedQuery = DehydratedState['queries'][number]

// What the app shows with no network: the game's data as of the last time it
// was online. The queries that make up the main screens are saved on the phone
// (IndexedDB) a moment after they change, and put back into the query cache at
// launch — so the map, the profile, the diary, the challenges and the rest
// come up at once, then refresh by themselves when there is a connection.
// Only for the player who was signed in when it was saved, and thrown away on
// sign-out. The app's own files are kept by the service worker (public/sw.js).

const DB_NAME = 'range-cache'
const STORE = 'kv'
const KEY = 'queries'
const LAST_USER_KEY = 'range:lastUser'
const MAX_AGE_MS = 14 * 24 * 3600 * 1000
// Saving is a stringify of a megabyte and a write of it: not more often than a
// breath, and not at all when nothing changed (it also runs when the app goes
// to the background, so the last changes are not lost).
const SAVE_DELAY_MS = 20_000
const MAX_ENTRIES = 300

// The queries worth having offline — the main screens' own data. Everything
// else (admin lists, search, one-off checks) is left out on purpose.
const PERSISTED = new Set([
  'territories',
  'sectors-geometry',
  'all-territory-ids',
  'profile',
  'catches',
  'diary',
  'my-challenges',
  'challenge-week-state',
  'species',
  'buffs',
  'shop-items',
  'my-inventory',
  'my-active-buffs',
  'treasury',
  'daily-reward',
  'slot-state',
  'first-steps',
  'weekly-leaderboard',
  'all-players',
  'activity',
  'unread-notifications',
  'user-awards',
  'claimed-from-others',
  'geo-today',
  'followers',
  'clans',
  'clan',
  'clan-chest',
  'clan-race',
  'clan-chat-summary',
  'clan-badges',
  'bite-forecast',
  'ui-state',
  'catch-likes',
  'catch-comments',
])

type Saved = { userId: string; savedAt: number; json: string }

// Maps and Sets don't survive JSON as they are.
const replacer = (_k: string, v: unknown) => {
  if (v instanceof Map) return { __t: 'Map', v: [...v.entries()] }
  if (v instanceof Set) return { __t: 'Set', v: [...v.values()] }
  return v
}
const reviver = (_k: string, v: unknown) => {
  if (v && typeof v === 'object' && '__t' in v) {
    const t = v as { __t: string; v: unknown[] }
    if (t.__t === 'Map') return new Map(t.v as [unknown, unknown][])
    if (t.__t === 'Set') return new Set(t.v)
  }
  return v
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idb<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode)
      const req = run(tx.objectStore(STORE))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

// ---------------------------------------------------------------- the player

// The signed-in player as the phone last knew them. Opening the app with no
// network cannot ask the server who is signed in — it takes this.
export function rememberUser(user: unknown) {
  try {
    localStorage.setItem(LAST_USER_KEY, JSON.stringify(user))
  } catch {
    // storage off: the app then behaves as before (needs a network to start)
  }
}
export function lastKnownUser<T>(): T | null {
  try {
    const raw = localStorage.getItem(LAST_USER_KEY)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}
function lastUserId(): string | null {
  return lastKnownUser<{ id?: string }>()?.id ?? null
}

// Sign-out (or a session that is really gone): nothing of this player stays.
export function forgetOfflineData() {
  kept = new Map()
  lastSignature = ''
  try {
    localStorage.removeItem(LAST_USER_KEY)
  } catch {}
  void idb('readwrite', (s) => s.delete(KEY)).catch(() => {})
}

// ---------------------------------------------------------------- save / restore

// What is already on the phone, by query. A save adds to it rather than
// replacing it: a launch that got only part of the data (no connection, a slow
// one) must never wipe the screens it did not reach.
let kept = new Map<string, DehydratedQuery>()
let lastSignature = ''

async function restore(client: QueryClient) {
  const userId = lastUserId()
  if (!userId) return
  const saved = await idb<Saved | undefined>('readonly', (s) => s.get(KEY)).catch(() => undefined)
  if (!saved || saved.userId !== userId || Date.now() - saved.savedAt > MAX_AGE_MS) return
  try {
    const state = JSON.parse(saved.json, reviver) as DehydratedState
    kept = new Map(state.queries.map((q) => [q.queryHash, q]))
    hydrate(client, state)
  } catch {
    // a copy this build can't read: ignored, the app asks the server
  }
}

function save(client: QueryClient) {
  const userId = lastUserId()
  if (!userId) return
  const state = dehydrate(client, {
    shouldDehydrateQuery: (q) => q.state.status === 'success' && PERSISTED.has(String((q.queryKey as QueryKey)[0])),
  })
  if (state.queries.length === 0) return
  // The same queries as last time, each as fresh as last time: nothing to write.
  const signature = state.queries.map((q) => `${q.queryHash}:${q.state.dataUpdatedAt}`).join('|')
  if (signature === lastSignature) return
  lastSignature = signature
  const now = Date.now()
  const merged = new Map(kept)
  for (const q of state.queries) merged.set(q.queryHash, q)
  // Too old to be of use, and the oldest ones past the cap.
  const fresh = [...merged.values()].filter((q) => now - q.state.dataUpdatedAt < MAX_AGE_MS)
  fresh.sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt)
  const queries = fresh.slice(0, MAX_ENTRIES)
  kept = new Map(queries.map((q) => [q.queryHash, q]))
  let json: string
  try {
    json = JSON.stringify({ mutations: [], queries }, replacer)
  } catch {
    return
  }
  const row: Saved = { userId, savedAt: now, json }
  void idb('readwrite', (s) => s.put(row, KEY)).catch(() => {})
}

// Puts the saved queries back, then keeps saving as the cache changes.
// Returns what to call to stop.
export function installOfflineCache(client: QueryClient): () => void {
  if (typeof indexedDB === 'undefined') return () => {}
  let timer = 0
  let stopped = false
  void restore(client)
  const unsubscribe = client.getQueryCache().subscribe(() => {
    if (stopped) return
    window.clearTimeout(timer)
    timer = window.setTimeout(() => save(client), SAVE_DELAY_MS)
  })
  // The phone may close the page right after the last change: write at once then.
  const onHide = () => {
    if (document.visibilityState === 'hidden') {
      window.clearTimeout(timer)
      save(client)
    }
  }
  document.addEventListener('visibilitychange', onHide)
  return () => {
    stopped = true
    window.clearTimeout(timer)
    unsubscribe()
    document.removeEventListener('visibilitychange', onHide)
  }
}
