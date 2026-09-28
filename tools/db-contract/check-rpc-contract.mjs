#!/usr/bin/env node
// Checks that every Supabase RPC the app calls still resolves against the
// live database — for BOTH the version that's deployed right now
// (origin/main) and the working copy about to ship.
//
// Why: a migration goes live the moment it's applied, while client code only
// changes on deploy. On 2026-09-27 confirm_catch was recreated without its
// DEFAULT NULLs; the deployed client omits empty optional fields, PostgREST
// answered 404 «function not found», and nobody could save a catch for 3.5h.
// This would have flagged it before anyone noticed. Run after EVERY
// migration (see DECISIONS.md «Проверка контракта RPC»):
//
//   npm run db:contract        (from web/)
//
// It reads only the catalog (public.admin_rpc_contract_check, service_role
// only) — nothing is executed against real data.
import { execSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..')
const webDir = join(repoRoot, 'web')

function loadEnv() {
  const env = { ...process.env }
  const file = join(webDir, '.env.local')
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
    }
  }
  return env
}

// --- collect source files -------------------------------------------------

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|js|mjs)$/.test(name)) out.push(p)
  }
  return out
}

function localSources() {
  return ['lib', 'components', 'app']
    .map((d) => join(webDir, d))
    .filter(existsSync)
    .flatMap((d) => walk(d))
    .map((p) => ({ path: relative(repoRoot, p), text: readFileSync(p, 'utf8') }))
}

function deployedSources(ref) {
  try {
    execSync(`git -C "${repoRoot}" rev-parse --verify ${ref}`, { stdio: 'ignore' })
  } catch {
    return null
  }
  const files = execSync(`git -C "${repoRoot}" ls-tree -r --name-only ${ref} -- web/lib web/components web/app`, { encoding: 'utf8' })
    .split('\n')
    .filter((f) => /\.(ts|tsx|js|mjs)$/.test(f))
  return files
    .map((f) => ({ path: `${ref}:${f}`, text: execSync(`git -C "${repoRoot}" show "${ref}:${f}"`, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) }))
    .filter((f) => f.text.includes('.rpc('))
}

// --- extract .rpc('name', { ...keys }) calls --------------------------------

// Returns the text of a balanced {...} starting at text[start] === '{'.
function balanced(text, start) {
  let depth = 0
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}

// Top-level keys of an object literal, and which of them may be left out at
// runtime (value is `x ?? undefined` / `x || undefined` / `undefined`) —
// PostgREST then sees the call WITHOUT that argument, which is exactly the
// case that broke.
function objectKeys(obj) {
  const keys = []
  const optional = new Set()
  let depth = 0
  let i = 1
  const body = obj.slice(1, -1)
  const parts = []
  let current = ''
  for (; i < obj.length - 1; i++) {
    const ch = obj[i]
    if ('{[('.includes(ch)) depth++
    if ('}])'.includes(ch)) depth--
    if (ch === ',' && depth === 0) {
      parts.push(current)
      current = ''
    } else current += ch
  }
  if (current.trim()) parts.push(current)
  void body
  for (const raw of parts) {
    const part = raw.trim()
    if (!part) continue
    const m = part.match(/^([A-Za-z_$][\w$]*)\s*(?::([\s\S]*))?$/)
    if (!m) continue
    keys.push(m[1])
    const value = (m[2] ?? '').trim()
    if (/\?\?\s*undefined\s*$|\|\|\s*undefined\s*$|^undefined$/.test(value)) optional.add(m[1])
  }
  return { keys, optional }
}

function extractCalls(files) {
  const calls = []
  for (const f of files) {
    const re = /\.rpc\(\s*['"]([a-z0-9_]+)['"]\s*(,)?/g
    let m
    while ((m = re.exec(f.text))) {
      const name = m[1]
      let keys = []
      let optional = new Set()
      if (m[2]) {
        const braceAt = f.text.slice(re.lastIndex).search(/\S/)
        const start = re.lastIndex + braceAt
        if (f.text[start] === '{') {
          const obj = balanced(f.text, start)
          if (obj) ({ keys, optional } = objectKeys(obj))
        } else {
          // Args passed as a variable — can't see the keys statically.
          calls.push({ name, keys: null, where: f.path })
          continue
        }
      }
      const line = f.text.slice(0, m.index).split('\n').length
      calls.push({ name, keys, where: `${f.path}:${line}` })
      if (optional.size) calls.push({ name, keys: keys.filter((k) => !optional.has(k)), where: `${f.path}:${line} (без необязательных)` })
    }
  }
  return calls
}

// --- check against the database --------------------------------------------

async function check(label, calls, env) {
  const unique = new Map()
  const unknownArgs = []
  for (const c of calls) {
    if (c.keys === null) {
      unknownArgs.push(c)
      continue
    }
    const k = `${c.name}|${[...c.keys].sort().join(',')}`
    if (!unique.has(k)) unique.set(k, { rpc: c.name, keys: c.keys, where: [c.where] })
    else unique.get(k).where.push(c.where)
  }
  const payload = [...unique.values()].map(({ rpc, keys }) => ({ rpc, keys }))
  const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/admin_rpc_contract_check`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_calls: payload }),
  })
  if (!res.ok) throw new Error(`admin_rpc_contract_check: ${res.status} ${await res.text()}`)
  const problems = await res.json()
  const rpcCount = new Set(payload.map((p) => p.rpc)).size
  if (!problems.length) {
    console.log(`✓ ${label}: ${rpcCount} функций, ${payload.length} вариантов вызова — всё находится в базе`)
  } else {
    console.log(`✗ ${label}: ${problems.length} проблем(ы)`)
    for (const p of problems) {
      const entry = unique.get(`${p.rpc}|${[...p.keys].sort().join(',')}`)
      console.log(`   ${p.rpc}(${p.keys.join(', ')}) — ${p.problem}`)
      for (const w of entry?.where ?? []) console.log(`      ${w}`)
    }
  }
  for (const u of unknownArgs) console.log(`   ⚠ ${label}: ${u.name} вызван с аргументами-переменной (${u.where}) — ключи не проверены`)
  return problems.length
}

const env = loadEnv()
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Нужны NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY (web/.env.local)')
  process.exit(2)
}

// Hands the deployed version's calls to the database-side watchdog
// (public.system_health_tick re-checks them every 5 minutes and alerts the
// super admins in-app and on Telegram) — so a migration that breaks the
// live site gets caught even if nobody ran this script afterwards.
async function publishWatchList(calls, env) {
  const unique = new Map()
  for (const c of calls) if (c.keys !== null) unique.set(`${c.name}|${[...c.keys].sort().join(',')}`, { rpc: c.name, keys: c.keys })
  const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/admin_set_rpc_contract_watch`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_calls: [...unique.values()] }),
  })
  if (!res.ok) throw new Error(`admin_set_rpc_contract_watch: ${res.status} ${await res.text()}`)
  console.log(`  сторож в базе теперь следит за ${await res.json()} вызовами опубликованной версии`)
}

let failures = 0
const deployed = deployedSources('origin/main')
if (deployed) {
  const deployedCalls = extractCalls(deployed)
  failures += await check('Опубликованная версия (origin/main)', deployedCalls, env)
  await publishWatchList(deployedCalls, env)
} else console.log('⚠ origin/main не найден — опубликованная версия не проверена')
failures += await check('Рабочая копия', extractCalls(localSources()), env)
process.exit(failures ? 1 : 0)
