import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pickAwayEvents } from '@/lib/data/awayEvents.ts'

// «Пока тебя не было»: which unread sector_lost / sector_attacked notifications are replayed.

const sector = (id, status) => ({ id, status })
const row = (id, kind, territory_id, created_at, extra = {}) => ({
  id,
  kind,
  territory_id,
  created_at,
  payload: null,
  actor: { display_name: 'Сосед', avatar_url: null, territory_color: '#123456' },
  ...extra,
})

test('nothing to tell, nothing to play', () => {
  assert.equal(pickAwayEvents([], [sector('B1', 'other')], '#FC5200'), null)
})

test('newest three, told oldest first; newest timestamp kept for «seen»', () => {
  const rows = [
    row(5, 'sector_lost', 'B5', '2026-10-31T10:00:00Z'),
    row(4, 'sector_lost', 'B4', '2026-10-31T09:00:00Z'),
    row(3, 'sector_lost', 'B3', '2026-10-31T08:00:00Z'),
    row(2, 'sector_lost', 'B2', '2026-10-31T07:00:00Z'),
  ]
  const r = pickAwayEvents(rows, ['B2', 'B3', 'B4', 'B5'].map((id) => sector(id, 'other')), '#FC5200')
  assert.deepEqual(r.events.map((e) => e.territoryId), ['B3', 'B4', 'B5'])
  assert.equal(r.newest, '2026-10-31T10:00:00Z')
  assert.equal(r.events[0].byColor, '#123456')
})

test('one story per sector: the loss, not the attack before it', () => {
  const rows = [
    row(2, 'sector_lost', 'B1', '2026-10-31T10:00:00Z'),
    row(1, 'sector_attacked', 'B1', '2026-10-31T09:00:00Z', { payload: { defense: 0 } }),
  ]
  const r = pickAwayEvents(rows, [sector('B1', 'other')], '#FC5200')
  assert.equal(r.events.length, 1)
  assert.equal(r.events[0].kind, 'lost')
})

test('skips sectors won back, attacks on sectors since lost, and sectors not on this map', () => {
  const rows = [
    row(3, 'sector_lost', 'B1', '2026-10-31T10:00:00Z'),
    row(2, 'sector_attacked', 'B2', '2026-10-31T09:00:00Z'),
    row(1, 'sector_lost', 'M9', '2026-10-31T08:00:00Z'),
  ]
  assert.equal(pickAwayEvents(rows, [sector('B1', 'mine'), sector('B2', 'other')], '#FC5200'), null)
})

test('an attack keeps the defense left and the owner has no colour of their own', () => {
  const rows = [row(1, 'sector_attacked', 'B1', '2026-10-31T10:00:00Z', { payload: { defense: 2 }, actor: [{ display_name: null, avatar_url: null, territory_color: null }] })]
  const [e] = pickAwayEvents(rows, [sector('B1', 'mine')], '#FC5200').events
  assert.equal(e.kind, 'attacked')
  assert.equal(e.defense, 2)
  assert.equal(e.byName, null)
  assert.ok(e.byColor)
})
