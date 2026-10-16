// Run after `next build` (see package.json "build"): writes
// <distDir>/static/precache.json — the list of every file the app needs to
// open with no network (the built scripts, styles and fonts, plus the
// pictures in public/), served at /_next/static/precache.json. The service
// worker (public/sw.js) reads it on each launch and keeps those files on the
// phone, replacing the ones of an older build.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

try {
const root = join(fileURLToPath(import.meta.url), '..', '..')
const dist = join(root, process.env.NEXT_DIST_DIR || '.next')
const staticDir = join(dist, 'static')

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) yield* walk(p)
    else yield p
  }
}

const enc = (path) => path.split(sep).map(encodeURIComponent).join('/')

const urls = []
let bytes = 0
for (const file of walk(staticDir)) {
  if (file.endsWith('.map') || file.endsWith('precache.json')) continue
  urls.push('/_next/static/' + enc(relative(staticDir, file)))
  bytes += statSync(file).size
}

// What the app reads from public/: not the pictures for the Telegram bot's
// messages (public/telegram) — the app itself never shows them.
for (const dir of ['brand', 'skins', 'slots', 'welcome', 'data']) {
  const abs = join(root, 'public', dir)
  try {
    for (const file of walk(abs)) {
      if (file.endsWith('.DS_Store')) continue
      urls.push('/' + enc(relative(join(root, 'public'), file)))
      bytes += statSync(file).size
    }
  } catch {
    // no such folder in this checkout
  }
}
for (const file of ['icon-512.png', 'icon-192.png']) {
  try {
    statSync(join(root, 'public', file))
    urls.push('/' + file)
  } catch {
    // not there
  }
}

let version = 'dev'
try {
  version = readFileSync(join(dist, 'BUILD_ID'), 'utf8').trim()
} catch {
  // no BUILD_ID: the time stands in
  version = String(Date.now())
}

writeFileSync(join(staticDir, 'precache.json'), JSON.stringify({ version, urls }))
console.log(`precache.json: ${urls.length} files, ${(bytes / 1024 / 1024).toFixed(1)} MB (build ${version})`)
} catch (e) {
  // The offline file list is a nice-to-have: never let it fail a deploy.
  console.warn('precache-manifest: skipped —', e && e.message)
}
