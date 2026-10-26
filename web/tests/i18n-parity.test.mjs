import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ru } from '@/lib/i18n/ru.ts'
import { en } from '@/lib/i18n/en.ts'
import { ka } from '@/lib/i18n/ka.ts'

// A key added to ru and forgotten in en or ka is a type error already; what the
// types do not catch is an empty string, a placeholder renamed in one language
// («{name}» vs «{user}») or a plural form that vanished.

function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') out[prefix + k] = v
    else flatten(v, `${prefix}${k}.`, out)
  }
  return out
}

const R = flatten(ru)
const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')
// English and Georgian have only «one» and «other»; Russian needs «few» and «many» too.
const russianOnly = (key) => /\.(few|many)$/.test(key)

for (const [name, dict] of [['en', en], ['ka', ka]]) {
  const T = flatten(dict)
  test(`${name}: every Russian key is there, nothing extra`, () => {
    const missing = Object.keys(R).filter((k) => !(k in T) && !russianOnly(k))
    const extra = Object.keys(T).filter((k) => !(k in R))
    assert.deepEqual(missing, [])
    assert.deepEqual(extra, [])
  })
  test(`${name}: no empty texts`, () => {
    const empty = Object.keys(T).filter((k) => T[k].trim() === '' && R[k]?.trim() !== '')
    assert.deepEqual(empty, [])
  })
  test(`${name}: same {placeholders} as Russian`, () => {
    const bad = Object.keys(T).filter((k) => k in R && placeholders(T[k]) !== placeholders(R[k]))
    assert.deepEqual(bad, [])
  })
}
