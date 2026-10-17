'use client'

import { dehydrate, hydrate, type DehydratedState, type QueryClient, type QueryKey } from '@tanstack/react-query'

type DehydratedQuery = DehydratedState['queries'][number]

// What the app shows with no network: the game's data as of the last time it
// was online. The queries that make up the main screens are saved on the phone
// (IndexedDB, one record each) a while after they change, and put back into the
// query cache when they are needed — so the map, the profile, the diary, the
// challenges and the rest come up with no connection, then refresh by
// themselves when there is one. Only for the player who was signed in when it
// was saved, and thrown away on sign-out. The app's own files are kept by the
// service worker (public/sw.js).
//
// Light on purpose — the launch is when an iPhone's WebView has the least room
// (the map, the data and the first screens all start together), and a Mini App
// was thrown away right there: nothing is read back while the network is
// answering (only if it does not, or there is none), and a save writes only
// the queries that changed, a few at a time.

const DB_NAME = 'range-cache'
const DB_VERSION = 2
const STORE = 'q'
const LAST_USER_KEY = 'range:lastUser'
const MAX_AGE_MS = 14 * 24 * 3600 * 1000
const SAVE_DELAY_MS = 20_000
// With a network, the saved copy is only a fallback: asked for after this long
// without the app's own data having come.
const RESTORE_WAIT_MS = 6_000
const WRITE_CHUNK_CHARS = 250_000

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

type Row = { hash: string; userId: string; at: number; json: string }

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
// The reviver is called for every value in the text: only worth it when a Map or
// a Set is in there (almost never).
const parse = (json: string): DehydratedQuery => (json.includes('"__t"') ? JSON.parse(json, reviver) : JSON.parse(json))

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      // The first version kept everything in one record: gone.
      if (db.objectStoreNames.contains('kv')) db.deleteObjectStore('kv')
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'hash' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function withStore<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
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

// Each query as it is on the phone now (hash → when its data came): what a save
// does not need to write again.
const written = new Map<string, number>()

// Sign-out (or a session that is really gone): nothing of this player stays.
export function forgetOfflineData() {
  written.clear()
  try {
    localStorage.removeItem(LAST_USER_KEY)
  } catch {}
  void withStore('readwrite', (s) => s.clear()).catch(() => {})
}

// ---------------------------------------------------------------- save / restore

async function restore(client: QueryClient) {
  const userId = lastUserId()
  if (!userId) return
  const rows = await withStore<Row[]>('readonly', (s) => s.getAll()).catch(() => [] as Row[])
  const queries: DehydratedQuery[] = []
  const now = Date.now()
  for (const row of rows) {
    if (row.userId !== userId || now - row.at > MAX_AGE_MS) continue
    try {
      queries.push(parse(row.json))
      written.set(row.hash, row.at)
    } catch {
      // a copy this build can't read: ignored, the app asks the server
    }
  }
  if (queries.length) hydrate(client, { mutations: [], queries })
}

// Records of other players and of long ago leave the phone.
async function prune() {
  const userId = lastUserId()
  const db = await openDb().catch(() => null)
  if (!db) return
  try {
    const now = Date.now()
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite')
      const req = tx.objectStore(STORE).openCursor()
      req.onsuccess = () => {
        const cur = req.result
        if (!cur) return
        const row = cur.value as Row
        if (row.userId !== userId || now - row.at > MAX_AGE_MS) cur.delete()
        cur.continue()
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } finally {
    db.close()
  }
}

let saving = false

async function save(client: QueryClient) {
  const userId = lastUserId()
  if (!userId || saving) return
  const state = dehydrate(client, {
    shouldDehydrateQuery: (q) => q.state.status === 'success' && PERSISTED.has(String((q.queryKey as QueryKey)[0])),
  })
  // Only the queries whose data is newer than what the phone has.
  const changed = state.queries.filter((q) => written.get(q.queryHash) !== q.state.dataUpdatedAt)
  if (changed.length === 0) return
  saving = true
  try {
    let chars = 0
    for (const q of changed) {
      let json: string
      try {
        json = JSON.stringify(q, replacer)
      } catch {
        continue
      }
      const row: Row = { hash: q.queryHash, userId, at: q.state.dataUpdatedAt, json }
      await withStore('readwrite', (s) => s.put(row)).catch(() => undefined)
      written.set(q.queryHash, q.state.dataUpdatedAt)
      chars += json.length
      // A breath between the big ones, so the page never stalls on it.
      if (chars > WRITE_CHUNK_CHARS) {
        chars = 0
        await new Promise((r) => setTimeout(r, 60))
      }
    }
  } finally {
    saving = false
  }
}

// Keeps saving as the cache changes; puts the saved queries back when they are
// needed. Returns what to call to stop.
export function installOfflineCache(client: QueryClient): () => void {
  if (typeof indexedDB === 'undefined') return () => {}
  let timer = 0
  let stopped = false

  // With no network the copy is the whole app: back at once. With one, the app's
  // own data is on its way — the copy is asked for only if it has not come.
  const haveProfile = () => client.getQueryCache().findAll({ queryKey: ['profile'] }).some((q) => q.state.status === 'success')
  const offline = typeof navigator !== 'undefined' && !navigator.onLine
  const restoreTimer = window.setTimeout(
    () => {
      if (!stopped && (offline || !haveProfile())) void restore(client)
    },
    offline ? 0 : RESTORE_WAIT_MS
  )
  const pruneTimer = window.setTimeout(() => void prune(), 45_000)

  // The first change starts the clock; later ones ride the same save (waiting for
  // a quiet moment would never come while queries keep refreshing).
  const unsubscribe = client.getQueryCache().subscribe(() => {
    if (stopped || timer) return
    timer = window.setTimeout(() => {
      timer = 0
      void save(client)
    }, SAVE_DELAY_MS)
  })
  // The phone may close the page right after the last change: write then.
  const onHide = () => {
    if (document.visibilityState === 'hidden') {
      window.clearTimeout(timer)
      timer = 0
      void save(client)
    }
  }
  document.addEventListener('visibilitychange', onHide)
  return () => {
    stopped = true
    window.clearTimeout(timer)
    window.clearTimeout(restoreTimer)
    window.clearTimeout(pruneTimer)
    unsubscribe()
    document.removeEventListener('visibilitychange', onHide)
  }
}
