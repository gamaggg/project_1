import { test } from 'node:test'
import assert from 'node:assert/strict'

// guestShare.ts reads localStorage; a plain object stands in for it.
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => void store.set(k, String(v)),
  removeItem: (k) => void store.delete(k),
}
const { parseGuestShare, refParam, rememberRef, peekRememberedRef, forgetRememberedRef, rememberClanInvite } = await import('@/lib/guestShare.ts')

test('parseGuestShare reads every kind of shared link', () => {
  assert.deepEqual(parseGuestShare('?territory=B12&ref=123'), { kind: 'territory', key: 'B12', ref: '123', invite: null })
  assert.deepEqual(parseGuestShare('?catch=77'), { kind: 'catch', key: '77', ref: null, invite: null })
  assert.deepEqual(parseGuestShare('?clan=3&invite=AbC&ref=9'), { kind: 'clan', key: '3', ref: '9', invite: 'AbC' })
  assert.equal(parseGuestShare('?ref=5'), null, 'a bare invite link is not a shared screen')
  assert.equal(parseGuestShare(''), null)
})

test('refParam is empty without an id and escapes it with one', () => {
  assert.equal(refParam(null), '')
  assert.equal(refParam('12345'), '&ref=12345')
  assert.equal(refParam('a b'), '&ref=a%20b')
})

test('a remembered ref survives until the server has answered', () => {
  store.clear()
  rememberRef('777', 'invite')
  assert.deepEqual(peekRememberedRef(), { ref: '777', source: 'invite' })
  assert.deepEqual(peekRememberedRef(), { ref: '777', source: 'invite' }, 'reading it must not remove it')
  forgetRememberedRef()
  assert.equal(peekRememberedRef(), null)
})

test('a ref older than a week is dropped', () => {
  store.clear()
  store.set('fishzone:ref', JSON.stringify({ ref: '1', source: 'invite', at: Date.now() - 8 * 24 * 60 * 60 * 1000 }))
  assert.equal(peekRememberedRef(), null)
  assert.equal(store.has('fishzone:ref'), false)
})

test('a clan invite is kept from the link and found again later', () => {
  store.clear()
  assert.deepEqual(rememberClanInvite('?clan=4&invite=XyZ'), { clanId: 4, code: 'XyZ' })
  assert.deepEqual(rememberClanInvite(''), { clanId: 4, code: 'XyZ' })
})
