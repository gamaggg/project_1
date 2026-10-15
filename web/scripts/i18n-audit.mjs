// How much Russian is still written straight into the code (and so would stay
// Russian in English and Georgian). Counts lines with Cyrillic letters in
// app/, components/ and lib/ outside the dictionaries, comments excluded.
// Admin-only screens are listed separately: they stay Russian (the super
// admin reads Russian).
//
//   node scripts/i18n-audit.mjs            totals by area
//   node scripts/i18n-audit.mjs --files    + every file, biggest first
//   node scripts/i18n-audit.mjs --file=components/app-shell/screens/ClanScreen.tsx   the lines of one file

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(import.meta.url), '..', '..')
const ADMIN = /(Admin|UsersList|GrantCoins|GrantSpins|DeleteUser|DeleteTerritory|BulkAdd|BulkDelete|PostAnnouncement|ChangeUserId|EditCatchSheet|MoveCatchSheet|ReportPhotoModal)/
const only = process.argv.find((a) => a.startsWith('--file='))?.slice(7)

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) yield* walk(p)
    else if (/\.(ts|tsx)$/.test(name)) yield p
  }
}

const rows = []
for (const top of ['app', 'components', 'lib']) {
  for (const file of walk(join(root, top))) {
    const rel = relative(root, file)
    if (rel.startsWith('lib/i18n/') || rel === 'lib/types.ts') continue
    const lines = []
    readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      const s = line.trim()
      if (s.startsWith('//') || s.startsWith('*') || s.startsWith('/*') || s.startsWith('{/*')) return
      if (/[А-Яа-яЁё]/.test(line.replace(/\s\/\/.*$/, ''))) lines.push(`${i + 1}: ${s.slice(0, 140)}`)
    })
    if (lines.length) rows.push({ rel, n: lines.length, admin: ADMIN.test(rel), lines })
  }
}

if (only) {
  const r = rows.find((x) => x.rel === only)
  console.log(r ? r.lines.join('\n') : 'nothing left in that file')
  process.exit(0)
}
rows.sort((a, b) => b.n - a.n)
const sum = (xs) => xs.reduce((s, x) => s + x.n, 0)
const player = rows.filter((r) => !r.admin)
console.log(`to translate: ${sum(player)} lines in ${player.length} files   (admin screens, staying Russian: ${sum(rows.filter((r) => r.admin))})`)
const groups = {}
for (const r of player) {
  const g = r.rel.split('/').slice(0, r.rel.startsWith('components/app-shell/screens') ? 3 : 2).join('/')
  groups[g] = (groups[g] ?? 0) + r.n
}
for (const [g, n] of Object.entries(groups).sort((a, b) => b[1] - a[1])) console.log(String(n).padStart(5), g)
if (process.argv.includes('--files')) for (const r of player) console.log(String(r.n).padStart(5), r.rel)
