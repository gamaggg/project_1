import { test } from 'node:test'
import assert from 'node:assert/strict'
import { encodeStartParam, decodeStartParam } from '@/lib/telegram/startParam.ts'

test('a share query goes through Telegram’s startapp alphabet and back', () => {
  for (const q of ['ref=12345', 'clan=3&invite=AbC9&ref=12345', 'achievement=12345:%F0%9F%8F%86&ref=999', 'catch=77&ref=1', 'geo=1&ref=22']) {
    const e = encodeStartParam(q)
    assert.match(e, /^[A-Za-z0-9_-]+$/)
    assert.equal(decodeStartParam(e), q)
  }
})

test('anything that is not a plain query is refused', () => {
  assert.equal(decodeStartParam(''), null)
  assert.equal(decodeStartParam('!!!'), null)
  assert.equal(decodeStartParam(encodeStartParam('x=<script>')), null)
  assert.equal(decodeStartParam('A'.repeat(600)), null)
})
