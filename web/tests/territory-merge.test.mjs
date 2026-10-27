import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeTerritories, geometryCitiesNeeded, touchedRowsFilter } from '@/lib/data/territoryMerge.ts'
import { oldMerge } from './support/oldTerritoryMerge.mjs'

// A tiny world: Batumi (B) and Moscow (M) files built at BUILT, the way scripts/build-sector-geometry.mjs
// would, and the database rows the old load and the new load would each have got.
const BUILT = '2026-10-27T10:00:00.000Z'
const hex = (lat, lng) => [[lat, lng + 0.004], [lat + 0.003, lng + 0.002], [lat + 0.003, lng - 0.002], [lat, lng - 0.004], [lat - 0.003, lng - 0.002], [lat - 0.003, lng + 0.002]]
const sector = (id, kind, lat, lng) => ({ id, kind, lat, lng, corners: hex(lat, lng) })

const ME = '00000000-0000-0000-0000-00000000000a'
const OTHER = '00000000-0000-0000-0000-00000000000b'

const fileB = [sector('B0001', 'sea', 41.65, 41.64), sector('B0002', 'river', 41.66, 41.65), sector('B0003', 'sea', 41.67, 41.66), sector('B0004', 'lake', 41.68, 41.67)]
const fileM = [sector('M0001', 'river', 55.75, 37.61), sector('M0002', 'river', 55.76, 37.62), sector('M0003', 'pond', 55.77, 37.63)]

const blank = {
  kind: null, lat: null, lng: null, corners: null, owner_id: null, owner_avatar_url: null, owner_display_name: null, catch_count: 0, last_catch_at: null,
  is_deleted: false, shield_until: null, owner_equipped_skin: null, owner_territory_color: null, owner_clan_id: null, owner_clan_name: null, owner_clan_crest: null,
  co_holders: null, capturer_id: null, hot_until: null, legend_id: null, defense: 0,
}
const row = (id, over = {}) => ({ ...blank, id, ...over })
const owned = (id, who, over = {}) => row(id, { owner_id: who, owner_display_name: 'Рыбак', catch_count: 2, last_catch_at: '2026-10-26T08:00:00Z', defense: 1, ...over })

// Every row of the database, as the old load would see it (a free sector's row carries only defaults).
const allRows = [
  row('B0001', { kind: 'sea' }),
  owned('B0002', OTHER, { kind: 'river' }),
  row('B0003', { kind: 'sea', is_deleted: true }), // deleted after the file was built
  row('B0004', { kind: 'pond', kind_changed_at: '2026-10-27T12:00:00Z' }), // water type changed after the build: the file says lake
  row('B0100', { kind: 'river', lat: 41.7, lng: 41.7, corners: hex(41.7, 41.7), created_at: '2026-10-27T11:00:00Z' }), // added after the build
  owned('M0001', ME, { kind: 'river', hot_until: '2999-01-01T00:00:00Z' }),
  row('M0002', { kind: 'river' }),
  owned('M0003', OTHER, { kind: 'pond', shield_until: '2999-01-01T00:00:00Z', co_holders: [{ id: ME, display_name: 'Я' }], capturer_id: ME }),
  row('B0900', { kind: 'sea', is_deleted: true }), // deleted before the file was built: not in it
]

// What the new load asks the database for: the rows the filter keeps, plus the deleted ones.
const touched = (r) =>
  !r.is_deleted &&
  (r.owner_id || r.catch_count > 0 || r.last_catch_at || r.shield_until || r.hot_until || r.legend_id || r.capturer_id || r.co_holders || r.defense > 0 || r.kind_changed_at || (r.created_at && r.created_at > BUILT))
const newRows = (city, userId) => {
  const prefix = city === 'batumi' ? 'B' : 'M'
  const keep = allRows.filter((r) => (r.id.startsWith(prefix) && touched(r)) || (userId && r.owner_id === userId))
  const deleted = allRows.filter((r) => r.is_deleted && r.id.startsWith(prefix)).map((r) => ({ id: r.id, is_deleted: true }))
  return [...deleted, ...keep]
}
const oldRows = (city, userId) => {
  const prefix = city === 'batumi' ? 'B' : 'M'
  return allRows.filter((r) => r.id.startsWith(prefix) || (userId && r.owner_id === userId))
}
const legacy = [...fileB, ...fileM]
const files = { batumi: fileB, moscow: fileM }

for (const [label, userId] of [['a guest', undefined], ['a player', ME], ['another player', OTHER]]) {
  for (const city of ['batumi', 'moscow']) {
    test(`${city} for ${label}: the new load draws exactly what the old load drew`, () => {
      const rows = newRows(city, userId)
      const geometry = geometryCitiesNeeded(city, rows).flatMap((c) => files[c])
      const next = mergeTerritories({ city, userId, geometry, rows })
      // The new file of a city is the old one with the sector that was added since the old file excluded, so
      // compare against the old load over the same geometry the old file had (all cities, with B0004 as lake).
      const prev = oldMerge({ city, userId, geometry: legacy, rows: oldRows(city, userId) })
      assert.deepEqual(next, prev)
    })
  }
}

test('a sector with no interesting row is a free sector from the file', () => {
  const t = mergeTerritories({ city: 'batumi', userId: undefined, geometry: fileB, rows: newRows('batumi') }).find((x) => x.id === 'B0001')
  assert.equal(t.status, 'free')
  assert.equal(t.catchCount, 0)
  assert.deepEqual(t.coHolders, [])
})

test('a deleted sector and a changed water type come from the rows', () => {
  const list = mergeTerritories({ city: 'batumi', userId: undefined, geometry: fileB, rows: newRows('batumi') })
  assert.equal(list.find((x) => x.id === 'B0003'), undefined, 'deleted after the build')
  assert.equal(list.find((x) => x.id === 'B0004').kind, 'pond', 'the database type wins over the file')
  assert.ok(list.find((x) => x.id === 'B0100'), 'a sector added after the build is drawn from its row')
})

test('the player’s sectors in another city bring that city’s file', () => {
  const rows = newRows('batumi', ME)
  assert.deepEqual(geometryCitiesNeeded('batumi', rows).sort(), ['batumi', 'moscow'])
  const list = mergeTerritories({ city: 'batumi', userId: ME, geometry: [...fileB, ...fileM], rows })
  assert.ok(list.find((x) => x.id === 'M0001' && x.status === 'mine'))
  assert.ok(!list.find((x) => x.id === 'M0002'), 'only the player’s sectors from the other city')
})

test('the filter names every field a row can differ in', () => {
  const f = touchedRowsFilter(BUILT)
  for (const part of ['owner_id.not.is.null', 'catch_count.gt.0', 'shield_until.not.is.null', 'hot_until.not.is.null', 'legend_id.not.is.null', 'capturer_id.not.is.null', 'co_holders.not.is.null', 'defense.gt.0', 'kind_changed_at.not.is.null', `created_at.gt.${BUILT}`]) {
    assert.ok(f.split(',').includes(part), part)
  }
})
