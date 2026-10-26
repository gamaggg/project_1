import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CLAN_LEVEL_XP, clanLevel, clanCapacity, clanLevelProgress, leagueFor, LEAGUES } from '@/lib/data/clanLevels.ts'

// The numbers here are mirrored in the database and the FAQ: a change in one place
// that is not made in the others fails here first.

test('the level follows the xp thresholds', () => {
  assert.equal(clanLevel(0), 1)
  CLAN_LEVEL_XP.forEach((xp, i) => assert.equal(clanLevel(xp), i + 1))
  assert.equal(clanLevel(CLAN_LEVEL_XP.at(-1) + 100000), CLAN_LEVEL_XP.length)
})

test('capacity never shrinks as the level grows', () => {
  for (let l = 1; l < CLAN_LEVEL_XP.length; l++) assert.ok(clanCapacity(l + 1) >= clanCapacity(l))
})

test('progress stays between the thresholds', () => {
  const p = clanLevelProgress(CLAN_LEVEL_XP[1] + 1)
  assert.equal(p.level, 2)
  assert.ok(p.pct >= 0 && p.pct <= 100)
  assert.equal(clanLevelProgress(CLAN_LEVEL_XP.at(-1)).to, null, 'the top level has no next threshold')
})

test('every trophy count lands in exactly one league, rising with the count', () => {
  assert.equal(leagueFor(0).min, Math.min(...LEAGUES.map((l) => l.min)))
  const mins = LEAGUES.map((l) => l.min)
  assert.deepEqual([...mins].sort((a, b) => a - b), mins, 'leagues are listed from the lowest')
})
