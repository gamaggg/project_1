/* RANGE service worker — lets the app open with no network at all.

   What it does:
   - keeps the app itself on the phone: the built scripts, styles, fonts and
     pictures listed in /_next/static/precache.json (written at build time by
     scripts/precache-manifest.mjs), refreshed on each launch;
   - opens the app's page from the phone when the network is down or too slow
     (online it asks the server first, so a new version is never held back);
   - remembers map tiles and the avatars / catch photos already seen, up to a
     limit, so the map and the lists are not blank without a connection.
   It never touches the game's own data (Supabase requests, /api): that is kept
   by the app itself (lib/offlineCache.ts) and always asks the server first.

   Bump CACHE_VERSION to throw every cache away. */

const CACHE_VERSION = 'v1'
const SHELL = `range-shell-${CACHE_VERSION}`
const STATIC = `range-static-${CACHE_VERSION}`
const TILES = `range-tiles-${CACHE_VERSION}`
const IMAGES = `range-images-${CACHE_VERSION}`
const KEEP = new Set([SHELL, STATIC, TILES, IMAGES])
const LIMITS = { [TILES]: 1500, [IMAGES]: 500 }
const NAV_TIMEOUT_MS = 4000
const VERSION_KEY = '/__range_build'

// For trying the offline mode on a machine that is online: a page of ours can
// send {type: 'simulate-offline', on: true} and every request that would go to
// the network then fails, as with no connection at all.
let simulateOffline = false
const netFetch = (...args) => (simulateOffline ? Promise.reject(new TypeError('offline (simulated)')) : fetch(...args))

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(syncAssets().catch(() => {}))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(names.filter((n) => n.startsWith('range-') && !KEEP.has(n)).map((n) => caches.delete(n)))
      await self.clients.claim()
    })()
  )
})

self.addEventListener('message', (event) => {
  if (!event.data) return
  if (event.data.type === 'sync') event.waitUntil(syncAssets(event.data.urls).catch(() => {}))
  if (event.data.type === 'simulate-offline') simulateOffline = !!event.data.on
})

// ---------------------------------------------------------------- assets

// The app's files for this build, kept in STATIC; what an older build left is
// removed. Skipped when this build is already in (one tiny request).
async function syncAssets(seen) {
  // A phone on the data saver doesn't get ten megabytes pushed at it.
  if (self.navigator && self.navigator.connection && self.navigator.connection.saveData) return
  const cache = await caches.open(STATIC)
  // The page itself, so a launch with no network has something to open.
  await refreshShell()

  let manifest = null
  try {
    const res = await netFetch('/_next/static/precache.json', { cache: 'no-store' })
    if (res.ok) manifest = await res.json()
  } catch {
    // no network, or no list in this deploy: below
  }

  if (!manifest) {
    // No list of the build's files: keep at least what the page itself loaded
    // (it sends the addresses of its scripts, styles, fonts and pictures).
    for (const u of Array.isArray(seen) ? seen : []) {
      if (typeof u !== 'string' || !u.startsWith('/') || (await cache.match(u, { ignoreSearch: true }))) continue
      try {
        const r = await netFetch(u)
        if (r.ok) await cache.put(u, r)
      } catch {
        return
      }
    }
    return
  }

  const { version, urls } = manifest
  const marker = await cache.match(VERSION_KEY)
  const have = marker ? await marker.text() : null
  if (have === version) return

  const wanted = new Set(urls)
  const todo = []
  for (const u of urls) if (!(await cache.match(u, { ignoreSearch: true }))) todo.push(u)
  let next = 0
  const worker = async () => {
    while (next < todo.length) {
      const u = todo[next++]
      try {
        const r = await netFetch(u)
        if (r.ok) await cache.put(u, r)
      } catch {
        // offline halfway: the next launch continues
        return
      }
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker))

  // All in? Drop the files of the old build and mark this one done.
  let complete = true
  for (const u of urls) if (!(await cache.match(u, { ignoreSearch: true }))) complete = false
  if (!complete) return
  for (const req of await cache.keys()) {
    const path = new URL(req.url).pathname
    if (path !== VERSION_KEY && !wanted.has(path) && !wanted.has(encodeURI(decodeURI(path)))) await cache.delete(req)
  }
  await cache.put(VERSION_KEY, new Response(version))
}

async function refreshShell() {
  try {
    const r = await netFetch('/', { cache: 'no-store' })
    if (r.ok) await (await caches.open(SHELL)).put('/', r)
  } catch {
    // offline: the copy already there stays
  }
}

// ---------------------------------------------------------------- requests

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)

  // The game's own data (Supabase, /api, other sites): ours to keep nothing of,
  // but in the simulation it fails like everything else.
  if (simulateOffline && url.origin !== self.location.origin && !/api\.mapbox\.com|\.tiles\.mapbox\.com|\/storage\/v1\//.test(req.url)) {
    event.respondWith(Response.error())
    return
  }
  if (simulateOffline && url.origin === self.location.origin && url.pathname.startsWith('/api/')) {
    event.respondWith(Response.error())
    return
  }

  if (url.origin === self.location.origin) {
    const path = url.pathname
    if (path.startsWith('/api/') || path === '/sw.js' || path === '/_next/static/precache.json') return
    if (req.mode === 'navigate') {
      event.respondWith(navigation(req, url))
      return
    }
    if (path.startsWith('/_next/static/')) {
      event.respondWith(fromStatic(req))
      return
    }
    if (/^\/(brand|skins|slots|welcome|data)\//.test(path) || /^\/(icon-\d+\.png|apple-icon|favicon)/.test(path)) {
      event.respondWith(fromStatic(req))
      return
    }
    return
  }

  // Map: vector tiles, styles, sprites, fonts of the Mapbox API (not its stats).
  if (url.hostname === 'api.mapbox.com' || url.hostname.endsWith('.tiles.mapbox.com')) {
    if (url.pathname.startsWith('/events')) return
    event.respondWith(staleWhileRevalidate(req, TILES))
    return
  }
  // Avatars and catch photos from storage.
  if (url.hostname.endsWith('.supabase.co') && /^\/storage\/v1\/(render\/image|object)\/public\//.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(req, IMAGES))
  }
})

// The page: the server first (a new version must not be held back), the copy
// kept on the phone when there is no network — or the network is so slow that
// waiting is worse than opening what we have.
async function navigation(req, url) {
  const shell = await caches.open(SHELL)
  const isHome = url.pathname === '/'
  const live = netFetch(req).then(
    (res) => {
      if (res.ok && isHome) shell.put('/', res.clone())
      return res
    },
    () => null
  )
  const timeout = new Promise((resolve) => setTimeout(() => resolve('slow'), NAV_TIMEOUT_MS))
  const first = await Promise.race([live, timeout])
  if (first && first !== 'slow') return first
  const copy = await shell.match('/')
  if (copy) return copy
  const late = await live
  return late || new Response('Offline', { status: 503, statusText: 'Offline', headers: { 'Content-Type': 'text/plain' } })
}

async function fromStatic(req) {
  const cache = await caches.open(STATIC)
  const hit = await cache.match(req, { ignoreSearch: true })
  if (hit) return hit
  const res = await netFetch(req)
  if (res.ok) cache.put(req, res.clone())
  return res
}

// What is on the phone at once, refreshed behind it. An <img> asks without CORS
// and gets an opaque answer that cannot be kept sensibly (it weighs ~7 MB of
// quota whatever its size), so the same address is asked again with CORS.
async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName)
  const key = req.url
  const hit = await cache.match(key)
  const fresh = fetchReadable(req).then(
    (res) => {
      if (res && res.ok) {
        cache.put(key, res.clone())
        trim(cacheName)
      }
      return res
    },
    () => null
  )
  if (hit) return hit
  const res = await fresh
  return res || Response.error()
}

function fetchReadable(req) {
  if (req.mode === 'no-cors') return netFetch(new Request(req.url, { mode: 'cors', credentials: 'omit' }))
  return netFetch(req)
}

async function trim(cacheName) {
  const max = LIMITS[cacheName]
  if (!max || Math.random() > 0.05) return
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i])
}
