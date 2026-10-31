import { test } from 'node:test'
import assert from 'node:assert/strict'
import { groupHeldSectors, sectorForecastItems } from '@/lib/forecast/sectorForecast.ts'
import { bestMorning } from '@/lib/forecast/bite.ts'

// «Завтра утром хороший клёв у твоего сектора»: which points get a forecast and who is asked about.

test('sectors a few hundred metres apart share one forecast point; sea and land do not', () => {
  const groups = groupHeldSectors(
    [
      { id: 'B1', kind: 'shore', lat: 41.6512, lng: 41.6331, owner_id: 'u1' },
      { id: 'B2', kind: 'shore', lat: 41.6538, lng: 41.6302, owner_id: 'u2' },
      { id: 'B3', kind: 'sea', lat: 41.6538, lng: 41.6302, owner_id: 'u1' },
      { id: 'B4', kind: 'shore', lat: 41.5, lng: 41.6, owner_id: null },
    ],
    [{ territory_id: 'B2', user_id: 'u3' }]
  )
  assert.equal(groups.length, 2)
  const land = groups.find((g) => !g.sea)
  assert.deepEqual(land.sectors.map((s) => s.id), ['B1', 'B2'])
  assert.deepEqual(land.sectors[1].holders, ['u2', 'u3'])
  assert.deepEqual(groups.find((g) => g.sea).sea, { lat: 41.7, lng: 41.6 })
})

test('a sector held only through a clan share still counts', () => {
  const [g] = groupHeldSectors([{ id: 'B5', kind: 'shore', lat: 41.6, lng: 41.6, owner_id: null }], [{ territory_id: 'B5', user_id: 'u9' }])
  assert.deepEqual(g.sectors, [{ id: 'B5', holders: ['u9'] }])
})

test('items only for a morning of 4–5, every holder of every sector', () => {
  const g = { point: { lat: 0, lng: 0 }, sea: null, sectors: [{ id: 'B1', holders: ['u1', 'u2'] }, { id: 'B2', holders: ['u1'] }] }
  assert.deepEqual(sectorForecastItems(g, { score: 3, from: 5, to: 8 }), [])
  assert.deepEqual(sectorForecastItems(g, null), [])
  const items = sectorForecastItems(g, { score: 5, from: 5, to: 8 })
  assert.equal(items.length, 3)
  assert.deepEqual(items[0], { user_id: 'u1', territory_id: 'B1', score: 5, from: '05:00', to: '08:00' })
})

test('the morning window starts 04–09 and ignores the evening', () => {
  const hours = Array(24).fill(0.3)
  hours[6] = hours[7] = hours[8] = 1.2
  hours[19] = hours[20] = hours[21] = 2
  const m = bestMorning({ hours })
  assert.equal(m.from, 6)
  assert.equal(m.to, 9)
  const calm = bestMorning({ hours: Array(24).fill(0.3) })
  assert.ok(calm.score <= bestMorning({ hours }).score)
})
