// Tests public/sw.js (the offline service worker) against an in-memory Cache API and a scripted network: node scripts/sw-test.mjs
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'

const SRC = new URL('../public/sw.js', import.meta.url)
const ORIGIN = 'http://app.test'

class MemCache {
  constructor() { this.m = new Map() }
  key(r) { return typeof r === 'string' ? new URL(r, ORIGIN).href : r.url }
  async match(r, o = {}) {
    const k = this.key(r)
    if (this.m.has(k)) return this.m.get(k).clone()
    if (o.ignoreSearch) { const base = k.split('?')[0]; for (const [kk, v] of this.m) if (kk.split('?')[0] === base) return v.clone() }
    return undefined
  }
  async put(r, res) { this.m.set(this.key(r), res.clone()) }
  async keys() { return [...this.m.keys()].map((u) => ({ url: u })) }
  async delete(r) { return this.m.delete(typeof r === 'string' ? new URL(r, ORIGIN).href : r.url) }
}

function makeWorker(net) {
  const stores = new Map()
  const handlers = {}
  const self = {
    location: { origin: ORIGIN },
    navigator: {},
    clients: { claim: async () => {} },
    skipWaiting() {},
    addEventListener: (t, f) => { handlers[t] = f },
  }
  const caches = {
    open: async (n) => { if (!stores.has(n)) stores.set(n, new MemCache()); return stores.get(n) },
    keys: async () => [...stores.keys()],
    delete: async (n) => stores.delete(n),
  }
  const ctx = vm.createContext({ self, caches, fetch: (...a) => net(...a), Request, Response, URL, Promise, setTimeout, clearTimeout, Math, TypeError, console, encodeURI, decodeURI })
  vm.runInContext(readFileSync(SRC, 'utf8'), ctx)
  const fire = async (type, ev) => {
    let p
    ev.waitUntil = (x) => { p = x }
    ev.respondWith = (x) => { ev._resp = x }
    handlers[type](ev)
    if (p) await p
    return ev
  }
  const request = async (url, init = {}) => {
    const req = { url: url.startsWith('http') ? url : ORIGIN + url, method: init.method || 'GET', mode: init.mode || 'cors', clone() { return this } }
    const ev = await fire('fetch', { request: req })
    return ev._resp ? await ev._resp : 'passthrough'
  }
  return { fire, request, stores, self }
}

const body = (s, status = 200) => new Response(s, { status })
let online = true
let calls = []
const assets = { version: 'B1', urls: ['/_next/static/chunks/a.js', '/_next/static/chunks/b.css', '/brand/logo.svg'] }
const net = async (input) => {
  const url = typeof input === 'string' ? input : input.url
  const path = url.replace(ORIGIN, '')
  calls.push(path)
  if (!online) throw new TypeError('offline')
  if (path.startsWith('/_next/static/precache.json')) return body(JSON.stringify(assets))
  if (path === '/') return body('<html>shell ' + assets.version + '</html>')
  if (path.startsWith('/_next/static/') || path.startsWith('/brand/')) return body('file ' + path)
  if (url.includes('api.mapbox.com')) return body('tile ' + url)
  if (url.includes('/storage/v1/')) return body('img ' + url)
  return body('other ' + path)
}

let n = 0
const ok = (name) => console.log(`ok ${++n} - ${name}`)

// 1. install fills the caches
const w = makeWorker(net)
await w.fire('install', {})
const st = await w.stores.get('range-static-v1').keys()
assert.equal(st.filter((k) => !k.url.endsWith('__range_build')).length, 3)
assert.ok(await w.stores.get('range-shell-v1').match('/'))
ok('install: files and page kept')

// 2. static files from the phone when offline (and with another ?dpl=)
online = false
let r = await w.request('/_next/static/chunks/a.js?dpl=zzz')
assert.equal(await r.text(), 'file /_next/static/chunks/a.js')
r = await w.request('/brand/logo.svg')
assert.equal(await r.text(), 'file /brand/logo.svg')
ok('offline: static files from the phone, ?dpl ignored')

// 3. navigation offline -> shell
r = await w.request('/', { mode: 'navigate' })
assert.equal(await r.text(), '<html>shell B1</html>')
r = await w.request('/?catch=12#x', { mode: 'navigate' })
assert.equal(await r.text(), '<html>shell B1</html>')
ok('offline: the page opens from the phone (also with a query)')

// 4. online navigation: fresh page, shell updated
online = true
assets.version = 'B2'
r = await w.request('/', { mode: 'navigate' })
assert.equal(await r.text(), '<html>shell B2</html>')
await new Promise((res) => setTimeout(res, 20))
online = false
r = await w.request('/', { mode: 'navigate' })
assert.equal(await r.text(), '<html>shell B2</html>')
ok('online: server first, copy refreshed')

// 5. game data and api are not touched
online = true
for (const u of ['https://x.supabase.co/rest/v1/rpc/get_x', 'https://x.supabase.co/auth/v1/token', ORIGIN + '/api/version', 'https://telegram.org/js/telegram-web-app.js']) {
  assert.equal(await w.request(u), 'passthrough', u)
}
assert.equal(await w.request('/x', { method: 'POST' }), 'passthrough')
ok('Supabase, /api, other sites and POST are never intercepted')

// 6. tiles & images: stale-while-revalidate, offline from cache
const tile = 'https://api.mapbox.com/v4/mapbox.x/1/2/3.vector.pbf?access_token=t'
r = await w.request(tile)
assert.equal(await r.text(), 'tile ' + tile)
online = false
r = await w.request(tile)
assert.equal(await r.text(), 'tile ' + tile)
const img = 'https://abc.supabase.co/storage/v1/render/image/public/avatars/u/1.jpg?width=96'
online = true
r = await w.request(img, { mode: 'no-cors' })
assert.equal(await r.text(), 'img ' + img)
online = false
r = await w.request(img, { mode: 'no-cors' })
assert.equal(await r.text(), 'img ' + img)
r = await w.request('https://api.mapbox.com/events/v2?x=1')
assert.equal(r, 'passthrough')
ok('map tiles and storage pictures served from the phone offline; Mapbox stats ignored')

// 7. a never-seen tile offline -> network error, not a crash
r = await w.request('https://api.mapbox.com/v4/new/9/9/9.pbf')
assert.equal(r.type, 'error')
ok('unknown tile offline fails cleanly')

// 8. slow network: copy after the wait
online = true
assets.version = 'B2'
let slowHome = false
const slowSw = makeWorker(async (u) => { const p = (typeof u === 'string' ? u : u.url).replace(ORIGIN, ''); if (p === '/' && slowHome) { await new Promise((r2) => setTimeout(r2, 6000)); return body('late') } return net(u) })
await slowSw.fire('install', {})
slowHome = true
const t0 = Date.now()
const rs = await slowSw.request('/', { mode: 'navigate' })
const dt = Date.now() - t0
assert.ok(dt >= 3900 && dt < 5200, 'waited ' + dt)
assert.equal(await rs.text(), '<html>shell B2</html>')
ok(`slow network: copy shown after ${Math.round(dt / 100) / 10}s`)

// 9. new build: old files removed, new cached
online = true
assets.version = 'B3'
assets.urls = ['/_next/static/chunks/a.js', '/_next/static/chunks/c.js']
await w.fire('message', { data: { type: 'sync' } })
const keys = (await w.stores.get('range-static-v1').keys()).map((k) => new URL(k.url).pathname)
assert.ok(keys.includes('/_next/static/chunks/c.js') && !keys.includes('/_next/static/chunks/b.css') && !keys.includes('/brand/logo.svg'), keys.join())
ok('new build: new files kept, old ones removed')

// 10. interrupted sync does not drop the old build
const w2 = makeWorker(net)
await w2.fire('install', {})
assets.version = 'B4'
assets.urls = ['/_next/static/chunks/a.js', '/_next/static/chunks/zz.js']
const flaky = async (i) => { const p = (typeof i === 'string' ? i : i.url).replace(ORIGIN, ''); if (p.includes('zz')) throw new TypeError('lost'); return net(i) }
const w3 = makeWorker(flaky)
for (const [n2, c] of w2.stores) { const nc = new MemCache(); for (const [k, v] of c.m) nc.m.set(k, v); w3.stores.set(n2, nc) }
await w3.fire('message', { data: { type: 'sync' } })
const k3 = (await w3.stores.get('range-static-v1').keys()).map((k) => new URL(k.url).pathname)
assert.ok(k3.includes('/_next/static/chunks/b.css') || k3.includes('/_next/static/chunks/c.js'), 'old files must stay: ' + k3.join())
ok('a sync cut off halfway keeps what was there')

// 11. simulate-offline
online = true
const w4 = makeWorker(net)
await w4.fire('install', {})
await w4.fire('message', { data: { type: 'simulate-offline', on: true } })
const rr = await w4.request('https://x.supabase.co/rest/v1/rpc/a')
assert.equal(rr.type, 'error')
const rr2 = await w4.request('/_next/static/chunks/a.js'); assert.equal(await rr2.text(), 'file /_next/static/chunks/a.js')
const rr3 = await w4.request(ORIGIN + '/api/version'); assert.equal(rr3.type, 'error')
const rr4 = await w4.request('/', { mode: 'navigate' }); assert.ok((await rr4.text()).startsWith('<html>'))
ok('simulate-offline accepted')

// 12. data saver: nothing downloaded
const w5 = makeWorker(net)
w5.self.navigator.connection = { saveData: true }
calls = []
await w5.fire('install', {})
assert.equal(calls.length, 0)
ok('data saver: nothing fetched')

// 13. no precache.json in the deploy: the page's own list is kept
const netNoList = async (input) => {
  const path = (typeof input === 'string' ? input : input.url).replace(ORIGIN, '')
  if (path.startsWith('/_next/static/precache.json')) return body('Not Found', 404)
  return net(input)
}
online = true
const w6 = makeWorker(netNoList)
await w6.fire('message', { data: { type: 'sync', urls: ['/_next/static/chunks/x.js', '/brand/logo.svg', 'https://evil.test/a.js', 7] } })
const k6 = (await w6.stores.get('range-static-v1').keys()).map((k) => new URL(k.url).pathname)
assert.deepEqual(k6.sort(), ['/_next/static/chunks/x.js', '/brand/logo.svg'])
assert.ok(await w6.stores.get('range-shell-v1').match('/'))
ok('no file list in the deploy: the page\'s own files and the page itself are kept, foreign addresses ignored')

console.log('ALL OK')
process.exit(0)
