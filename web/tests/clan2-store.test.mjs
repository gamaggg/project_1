import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import * as S from '@/lib/clan2/demoStore.ts'
import { BUILD_CLAN_LEVEL, BUILD_HOURS, CLAN_SKINS, DAY, HOURS, DEFENSE_MAX, HQ_LOOT_MAX, HQ_RUINS_HOURS, PROJECTS, PROJECT_EFFECTS, SIEGE_MINUTES, dailyRent, speedupCost, treasuryCap } from '@/lib/clan2/rules.ts'
import { buildLiveState, syncLiveState, liveSectors } from '@/lib/clan2/live/seed.ts'

// The mechanics of the clan update, on the demo store (the same one the real app's live mode runs on).

const st = () => S.getDemoState()
const ok = (r, msg) => assert.equal(r.ok, true, `${msg ?? ''} -> ${JSON.stringify(r)}`)
const no = (r, reason) => {
  assert.equal(r.ok, false, `expected refusal ${reason}`)
  assert.equal(r.reason, reason)
}

beforeEach(() => {
  S.resetDemo()
})

test('the start world is consistent: defence 0-3, an HQ on a clan sector', () => {
  const s = st()
  for (const x of s.sectors) assert.ok(x.defense >= 0 && x.defense <= DEFENSE_MAX, `${x.id} defence ${x.defense}`)
  const hq = s.sectors.find((x) => x.id === s.hq.sectorId)
  assert.equal(hq.owner, 'mine')
  assert.equal(hq.hq, 'mine')
  assert.equal(s.sectors.filter((x) => x.hq === 'mine').length, 1)
})

test('deposit: coins move wallet -> treasury, the rules refuse bad deposits', () => {
  const w = st().wallet
  const b = st().treasury.balance
  ok(S.deposit(100))
  assert.equal(st().wallet, w - 100)
  assert.equal(st().treasury.balance, b + 100)
  assert.equal(st().members.find((m) => m.id === st().myId).weekDeposit >= 100, true)
  no(S.deposit(5), 'minDeposit')
  no(S.deposit(NaN), 'minDeposit')
  no(S.deposit(w * 10), 'wallet')
})

test('deposit over the cap: what does not fit goes back to the wallet and the entry says so', () => {
  const cap = S.capOf(st())
  S.mutateForTest?.()
  // fill the treasury up to 20 below the cap with deposits
  while (cap - st().treasury.balance > 500) {
    S.updateSettings({}) // no-op (leader is not admin) just to exercise the refusal path
    const room = cap - st().treasury.balance
    const give = Math.min(500, room - 20)
    if (give < 10) break
    // wallet may run out: top it up through the live store is not possible, so stop when it does
    if (st().wallet < give) break
    ok(S.deposit(give))
  }
  const room = cap - st().treasury.balance
  if (room >= 0 && st().wallet >= 100 && room < 100) {
    const w = st().wallet
    ok(S.deposit(100))
    assert.equal(st().treasury.balance, cap)
    assert.equal(st().wallet, w - room, 'the rest came back')
    const last = st().treasury.entries.at(-1)
    assert.match(last.note, /lost:\d+/)
  }
})

test('tax: only a manager sets it, the rate is capped, and a catch pays it into the treasury', () => {
  S.setPersona('member')
  no(S.setTaxRate(5), 'notManager')
  S.setPersona('leader')
  no(S.setTaxRate(7), 'badRate')
  ok(S.setTaxRate(10))
  const before = st().treasury.balance
  const w = st().wallet
  const r = S.simulateCatch({ memberId: st().myId, species: 'katran' })
  ok(r)
  assert.equal(r.summary.tax, Math.floor((r.summary.coins * 10) / 100))
  assert.equal(st().treasury.balance, before + r.summary.tax)
  assert.equal(st().wallet, w + r.summary.coins - r.summary.tax)
})

test('goal: needs enough coins, spends them, owns and wears the skin on every clan sector', () => {
  ok(S.setGoal('skin_clan_tide'))
  const cost = 5000
  assert.ok(st().treasury.balance < cost)
  no(S.buyGoal(), 'notEnough')
  S.advanceTime(60 * DAY)
  assert.ok(st().treasury.balance >= cost, `balance ${st().treasury.balance}`)
  const b = st().treasury.balance
  ok(S.buyGoal())
  assert.equal(st().treasury.balance, b - cost)
  assert.ok(st().owned.includes('clan_tide'))
  assert.equal(st().equippedSkin, 'clan_tide')
  assert.ok(st().sectors.filter((x) => x.owner === 'mine').every((x) => x.skin === 'clan_tide'))
  assert.equal(st().treasury.goalId, null)
})

test('a skin can be worn only once owned, and taken off', () => {
  no(S.equipSkin('clan_aurora'), 'notOwned')
  ok(S.equipSkin(null))
  assert.equal(st().equippedSkin, null)
  assert.ok(st().sectors.every((x) => x.skin === null))
})

test('buildings: paid at once, built over time, one at a time, effects only when ready', () => {
  S.advanceTime(150 * DAY)
  const s0 = st()
  assert.equal(S.levelOf(s0, 'dock'), 1)
  assert.equal(S.extraSlotsOf(s0), PROJECT_EFFECTS.dock.slots[1])
  const before = st().treasury.balance
  ok(S.upgradeProject('beacon'))
  assert.equal(st().treasury.balance, before - PROJECTS.beacon.costs[0])
  assert.ok(st().build)
  assert.equal(st().projects.beacon, 0, 'not ready yet')
  assert.equal(S.siegeMinutesOf(st()), SIEGE_MINUTES, 'no effect until it is ready')
  no(S.upgradeProject('storage'), 'buildBusy')
  S.advanceTime(BUILD_HOURS.beacon[0] * HOURS + 1000)
  assert.equal(st().build, null)
  assert.equal(st().projects.beacon, 1)
  assert.equal(S.siegeMinutesOf(st()), SIEGE_MINUTES + PROJECT_EFFECTS.beacon.siegeMinutes[1])
  assert.ok(st().alerts.some((a) => a.kind === 'project_done'))
})

test('buildings: a level opens only with the clan level', () => {
  S.advanceTime(150 * DAY)
  // the demo clan is level 5: level 3 needs 6
  assert.equal(st().clan.level, 5)
  ok(S.upgradeProject('storage'))
  S.advanceTime(BUILD_HOURS.storage[0] * HOURS + 1000)
  ok(S.upgradeProject('storage'))
  S.advanceTime(BUILD_HOURS.storage[1] * HOURS + 1000)
  assert.equal(st().projects.storage, 2)
  assert.ok(BUILD_CLAN_LEVEL[2] > st().clan.level)
  no(S.upgradeProject('storage'), 'levelLow')
})

test('buildings: the longest build is about five days, and the whole base costs what the pacing note says', () => {
  const longest = Math.max(...Object.values(BUILD_HOURS).map((h) => h[2]))
  assert.ok(longest >= 96 && longest <= 120, `longest ${longest} h`)
  for (const id of Object.keys(BUILD_HOURS)) {
    assert.ok(BUILD_HOURS[id][0] < BUILD_HOURS[id][1] && BUILD_HOURS[id][1] < BUILD_HOURS[id][2])
    assert.ok(PROJECTS[id].costs[0] < PROJECTS[id].costs[1] && PROJECTS[id].costs[1] < PROJECTS[id].costs[2])
  }
  const total = Object.values(PROJECTS).reduce((n, p) => n + p.costs.reduce((a, b) => a + b, 0), 0)
  assert.equal(total, 35_000)
})

test('speed-up: costs a share of the building price by the time left, finishes the build, needs money and a manager', () => {
  S.advanceTime(150 * DAY)
  no(S.speedUpBuild(), 'buildNone')
  ok(S.upgradeProject('fort'))
  const b = st().build
  const full = speedupCost(st().settings, PROJECTS.fort.costs[0], b.startedAt, b.endsAt, b.startedAt)
  assert.equal(full, Math.ceil((PROJECTS.fort.costs[0] * 35) / 100))
  // half of the time gone: half of the price
  S.advanceTime((BUILD_HOURS.fort[0] * HOURS) / 2)
  const half = S.speedupPrice(st())
  assert.ok(Math.abs(half - full / 2) <= 1, `half ${half} full ${full}`)
  S.setPersona('member')
  no(S.speedUpBuild(), 'notManager')
  S.setPersona('leader')
  const money = st().treasury.balance
  ok(S.speedUpBuild())
  assert.equal(st().treasury.balance, money - half)
  assert.equal(st().build, null)
  assert.equal(st().projects.fort, 1)
  // a build is never free to skip
  assert.ok(speedupCost(st().settings, 100, 0, 1000, 999) >= 20)
})

test('buildings need the money and a manager', () => {
  S.setPersona('member')
  no(S.upgradeProject('fort'), 'notManager')
  S.setPersona('leader')
  S.resetDemo()
  const bal = st().treasury.balance
  assert.ok(bal < PROJECTS.dock.costs[1], 'the start treasury is below the dock level 2')
  no(S.upgradeProject('dock'), 'notEnough')
})

test('market: rent is higher by its percent', () => {
  const s = st()
  const base = dailyRent(s.settings, 5, 2, true, 0)
  assert.equal(dailyRent(s.settings, 5, 2, true, 3), Math.round(base * 1.15))
})

test('clan skins: price and the level that opens them; the treasury cap at that level is above the price', () => {
  for (const k of CLAN_SKINS) assert.ok(treasuryCap(k.minLevel, 0) >= k.price, `${k.id} price ${k.price} cap ${treasuryCap(k.minLevel, 0)}`)
  S.resetDemo()
  // the demo clan is level 5: the lanterns (level 9) are locked
  no(S.setGoal('skin_clan_lanterns'), 'levelLow')
  ok(S.setGoal('skin_clan_aurora'))
})

test('treasury cap by clan level', () => {
  assert.equal(treasuryCap(1, 0), 3000)
  assert.equal(treasuryCap(3, 0), 5000)
  assert.equal(treasuryCap(5, 0), 8000)
  assert.equal(treasuryCap(7, 0), 12000)
  assert.equal(treasuryCap(9, 3), 25000)
})

test('HQ: only on a captured clan sector, one per sector, cost, cooldown, defence at least 1', () => {
  const s = st()
  const free = s.sectors.find((x) => x.owner === 'free')
  const enemy = s.sectors.find((x) => x.owner === 'enemy' && !x.hq)
  const other = s.sectors.find((x) => x.owner === 'mine' && !x.hq)
  no(S.placeHq(free.id), 'hqNotMine')
  no(S.placeHq(enemy.id), 'hqNotMine')
  no(S.placeHq('nope'), 'hqNotMine')
  no(S.placeHq(s.hq.sectorId), 'hqTaken')
  // moving too soon
  no(S.placeHq(other.id), 'hqCooldown')
  S.advanceTime(20 * DAY)
  const b = st().treasury.balance
  ok(S.placeHq(other.id))
  assert.equal(st().treasury.balance, b - st().settings.hqMoveCost)
  assert.equal(st().hq.sectorId, other.id)
  assert.equal(st().sectors.filter((x) => x.hq === 'mine').length, 1)
  assert.ok(st().sectors.find((x) => x.id === other.id).defense >= 1)
  S.setPersona('member')
  no(S.placeHq(s.hq.sectorId), 'notManager')
})

test('siege: defence runs down, then a siege starts; a clan catch breaks it', () => {
  const id = st().hq.sectorId
  assert.equal(st().sectors.find((x) => x.id === id).defense, 3)
  ok(S.attackHq())
  ok(S.attackHq())
  ok(S.attackHq())
  assert.equal(st().sectors.find((x) => x.id === id).defense, 0)
  assert.equal(st().hq.siege, null)
  ok(S.attackHq())
  assert.ok(st().hq.siege)
  assert.equal(st().hq.siege.endsAt - st().hq.siege.startedAt, S.siegeMinutesOf(st()) * 60_000)
  no(S.attackHq(), 'hqSiege')
  const w = st().wallet
  const r = S.defendHq()
  ok(r)
  assert.equal(r.info, 'siegeBroken')
  assert.equal(st().hq.siege, null)
  assert.equal(st().wallet, w + 20)
  assert.equal(st().sectors.find((x) => x.id === id).defense, 1)
  assert.ok(st().alerts.some((a) => a.kind === 'hq_saved'))
})

test('defence never goes over 3', () => {
  for (let i = 0; i < 6; i++) S.defendHq()
  assert.equal(st().sectors.find((x) => x.id === st().hq.sectorId).defense, DEFENSE_MAX)
})

test('a fallen HQ: loot, the sector lost, ruins, sleeping buildings, no new HQ for a day', () => {
  const id = st().hq.sectorId
  for (let i = 0; i < 4; i++) S.attackHq()
  const balance = st().treasury.balance
  S.advanceTime(31 * 60_000)
  const s = st()
  assert.equal(s.hq.sectorId, null)
  assert.equal(s.hq.siege, null)
  assert.ok(s.hq.ruins)
  assert.equal(s.hq.ruins.sectorId, id)
  const loot = Math.min(HQ_LOOT_MAX, Math.floor(balance * 0.2))
  assert.equal(s.hq.ruins.loot, loot)
  assert.equal(s.treasury.balance, balance - loot)
  assert.equal(s.sectors.find((x) => x.id === id).owner, 'enemy')
  assert.ok(s.alerts.some((a) => a.kind === 'hq_fallen'))
  assert.ok(s.treasury.entries.some((e) => e.kind === 'looted' && e.amount === -loot))
  // the buildings sleep
  assert.equal(S.buildingsOn(s), false)
  assert.equal(S.levelOf(s, 'dock'), 0)
  assert.equal(S.capOf(s), treasuryCap(s.clan.level, 0))
  no(S.upgradeProject('board'), 'noHqBuild')
  // a new HQ: not for 24 hours
  const another = s.sectors.find((x) => x.owner === 'mine')
  no(S.placeHq(another.id), 'hqRuins')
  S.advanceTime(HQ_RUINS_HOURS * HOURS + 5 * DAY)
  ok(S.placeHq(another.id))
  assert.equal(st().hq.ruins, null)
  assert.equal(S.buildingsOn(st()), true)
})

test('the HQ defence wears down by itself, slower with the fort', () => {
  const id = st().hq.sectorId
  const d0 = st().sectors.find((x) => x.id === id).defense
  S.advanceTime(1.2 * DAY)
  assert.equal(st().sectors.find((x) => x.id === id).defense, Math.max(0, d0 - 1))
  // with the fort at level 3 (decays every 5 days) the next 4 days cost nothing
  S.resetDemo()
  // the third level needs clan level 6: play it up (a catch is 2 xp)
  for (let i = 0; i < 80; i++) S.simulateCatch({ memberId: st().myId })
  assert.ok(st().clan.level >= 6, `clan level ${st().clan.level}`)
  S.advanceTime(400 * DAY)
  for (let k = 0; k < 3; k++) {
    ok(S.upgradeProject('fort'), `fort level ${k + 1}`)
    S.advanceTime(BUILD_HOURS.fort[k] * HOURS + 1000)
  }
  assert.equal(st().projects.fort, 3)
  S.defendHq()
  S.defendHq()
  S.defendHq()
  assert.equal(st().sectors.find((x) => x.id === st().hq.sectorId).defense, 3)
  S.advanceTime(4 * DAY)
  assert.equal(st().sectors.find((x) => x.id === st().hq.sectorId).defense, 3)
})

test('buff: costs the treasury, needs three «иду», refunds when it falls through, then cools down', () => {
  const b = st().treasury.balance
  ok(S.planBuff(30))
  assert.equal(st().treasury.balance, b - st().settings.buffPrice)
  assert.equal(st().buff.phase, 'planned')
  no(S.planBuff(30), 'buffBusy')
  // nobody joins: the price comes back
  S.advanceTime(31 * 60_000)
  assert.equal(st().buff.phase, 'idle')
  assert.equal(st().treasury.balance, b)
  // with enough people it runs
  ok(S.planBuff(30))
  ok(S.othersRsvp(3))
  S.advanceTime(31 * 60_000)
  assert.equal(st().buff.phase, 'active')
  const r = S.simulateCatch({ memberId: st().myId, species: 'katran' })
  assert.equal(r.summary.buff, true)
  S.advanceTime(2 * HOURS)
  assert.equal(st().buff.phase, 'cooldown')
  no(S.planBuff(5), 'buffCooldown')
  S.advanceTime(st().settings.buffCooldownHours * HOURS + 1000)
  assert.equal(st().buff.phase, 'idle')
})

test('buff: only a manager launches it, anyone can say «иду» once it is planned', () => {
  S.setPersona('member')
  no(S.planBuff(5), 'notManager')
  S.setPersona('leader')
  ok(S.planBuff(60))
  S.setPersona('member')
  ok(S.rsvpBuff(true))
  assert.ok(st().buff.rsvp.includes(st().myId))
  ok(S.rsvpBuff(false))
  assert.ok(!st().buff.rsvp.includes(st().myId))
})

test('rent comes in once a whole day, as much as the sectors earn, never past the cap', () => {
  const rent = S.rentPerDay(st())
  assert.ok(rent > 0)
  const b = st().treasury.balance
  S.advanceTime(DAY)
  assert.equal(st().treasury.balance, Math.min(S.capOf(st()), b + rent) , 'one day of rent')
  S.advanceTime(200 * DAY)
  assert.equal(st().treasury.balance, S.capOf(st()))
  assert.ok(st().treasury.entries.some((e) => /lost:\d+/.test(e.note)))
})

test('rent: the HQ sector pays double, a shared sector one and a half times', () => {
  const s = st()
  const per = s.settings.rentPerSectorDay
  const c = S.sectorCounts(s)
  const hot = s.sectors.filter((x) => x.owner === 'mine' && x.hot).length
  const expected = Math.round(c.plain * per + c.shared * per * s.settings.sharedRentFactor + (c.hq ? per * 2 : 0) + hot * per * 2)
  assert.equal(S.rentPerDay(s), expected)
})

test('weekly task: claim only when done, the board adds to the reward', () => {
  no(S.claimQuest(), 'questOpen')
  const q = st().quest
  S.simulateCatch({ memberId: st().myId })
  // fill the progress by catches
  for (let i = 0; i < q.target; i++) S.simulateCatch({ memberId: st().myId })
  assert.ok(st().quest.progress >= q.target)
  const b = st().treasury.balance
  ok(S.claimQuest())
  assert.equal(st().quest.claimed, true)
  assert.ok(st().treasury.balance > b)
  no(S.claimQuest(), 'questOpen')
})

test('call to the water once a day per member; only a manager calls', () => {
  const other = st().members.find((m) => m.id !== st().myId)
  ok(S.nudge(other.id))
  no(S.nudge(other.id), 'nudgeOnce')
  S.advanceTime(DAY + 1000)
  ok(S.nudge(other.id))
  S.setPersona('member')
  no(S.nudge(other.id), 'notManager')
})

test('leadership: transfer by the leader only; the co-leader takes over by himself after 14 days', () => {
  S.setPersona('member')
  no(S.transferLeadership('m2'), 'notLeader')
  S.setPersona('leader')
  ok(S.transferLeadership('m2'))
  assert.equal(st().members.find((m) => m.id === 'm2').role, 'leader')
  assert.equal(st().members.find((m) => m.id === 'm1').role, 'co_leader')
  S.resetDemo()
  ok(S.leaderAway())
  assert.equal(st().members.filter((m) => m.role === 'leader').length, 1)
  assert.equal(st().members.find((m) => m.id === 'm2').role, 'leader')
})

test('recruit reward: a recruit becomes a catch, then the clan is paid', () => {
  const b = st().treasury.balance
  const r1 = S.recruitCatch()
  ok(r1)
  assert.equal(r1.info, 'paid')
  assert.equal(st().treasury.balance, b + st().settings.recruitReward)
  const r2 = S.recruitCatch()
  ok(r2)
  assert.equal(r2.info, 'caught')
  ok(S.recruitCatch())
  no(S.recruitCatch(), 'recruitNone')
})

test('week settlement: a quarter of the chest and the battle goes to the treasury, the task resets', () => {
  const b = st().treasury.balance
  ok(S.settleWeek())
  assert.ok(st().treasury.balance > b)
  assert.equal(st().quest.progress, 0)
  assert.equal(st().quest.claimed, false)
  assert.ok(st().treasury.entries.some((e) => e.kind === 'chest_share'))
})

test('admin: only the admin changes numbers and reverses entries', () => {
  no(S.updateSettings({ buffPrice: 100 }), 'notAdmin')
  S.setPersona('admin')
  ok(S.updateSettings({ buffPrice: 100 }))
  assert.equal(st().settings.buffPrice, 100)
  S.setPersona('leader')
  S.deposit(100)
  const last = st().treasury.entries.at(-1)
  S.setPersona('admin')
  const b = st().treasury.balance
  ok(S.reverseEntry(last.id))
  assert.equal(st().treasury.balance, b - last.amount)
  no(S.reverseEntry(last.id), 'badEntry')
})

test('a hot sector pays extra rent, and the clan buff and hot add up to x3, not x4', async () => {
  const { coinMultiplier } = await import('@/lib/clan2/rules.ts')
  assert.equal(coinMultiplier(false, false), 1)
  assert.equal(coinMultiplier(true, false), 2)
  assert.equal(coinMultiplier(false, true), 2)
  assert.equal(coinMultiplier(true, true), 3)
})

// ───────────── live mode ─────────────

const crest = { shape: 'shield', symbol: 'anchor', primary: '#1D5C80', secondary: '#F0A93E' }
const clan = (over = {}) => ({
  id: 34,
  city: 'batumi',
  name: 'BFC',
  motto: null,
  announcement: null,
  crest,
  background: 'waves',
  joinType: 'open',
  minSectors: 0,
  xp: 395,
  level: 3,
  capacity: 20,
  trophies: 125,
  createdAt: '',
  renamedAt: null,
  disbanded: false,
  myRole: 'co_leader',
  myRequestPending: false,
  myInvite: false,
  raceWins: 0,
  wonLastWeek: false,
  sectorsHeld: 3,
  members: [
    { userId: 'u1', displayName: 'Me', avatarUrl: null, nameStyle: null, role: 'co_leader', joinedAt: '', weekCatches: 4, sectors: 2 },
    { userId: 'u2', displayName: 'Ruslan', avatarUrl: null, nameStyle: null, role: 'member', joinedAt: '', weekCatches: 0, sectors: 1 },
  ],
  requests: null,
  events: [],
  ...over,
})
const terr = (id, ownerClanId, over = {}) => ({
  id,
  kind: 'water',
  lat: 0,
  lng: 0,
  corners: [],
  status: ownerClanId ? 'other' : 'free',
  ownerId: ownerClanId ? 'u' + ownerClanId : null,
  ownerAvatarUrl: null,
  ownerDisplayName: null,
  catchCount: 0,
  lastCatchAt: null,
  shieldUntil: null,
  ownerEquippedSkin: null,
  ownerColor: null,
  ownerClanId,
  ownerClanName: ownerClanId ? 'C' + ownerClanId : null,
  ownerClanCrest: null,
  coHolders: [],
  capturerId: null,
  hotUntil: null,
  legendId: null,
  defense: 2,
  ...over,
})
const territories = () => [terr('B1', 34), terr('B2', 34, { coHolders: [{ id: 'u2' }] }), terr('B3', 34, { defense: 0 }), terr('B4', 99), terr('B5', null)]
const input = (over = {}) => ({ clan: clan(), userId: 'u1', coins: 1817, isSuperAdmin: true, territories: territories(), ...over })

test('live: the state is built from the real clan, read only', () => {
  const s = buildLiveState(input(), 1_000_000)
  assert.equal(s.live.clanId, 34)
  assert.equal(s.myId, 'u1')
  assert.equal(s.persona, 'leader')
  assert.equal(s.wallet, 1817)
  assert.equal(s.clan.name, 'BFC')
  assert.equal(s.members.length, 2)
  assert.deepEqual(s.sectors.map((x) => x.id), ['B1', 'B2', 'B3'])
  assert.equal(s.sectors.find((x) => x.id === 'B2').shared, 2)
  assert.equal(s.hq.sectorId, null)
  assert.equal(s.treasury.balance, 3000)
  assert.ok(s.sectors.every((x) => x.defense <= DEFENSE_MAX))
})

test('live: a plain member is a member; the sectors of other clans and free ones are not the clan\'s', () => {
  const s = buildLiveState(input({ clan: clan({ myRole: 'member', members: clan().members.map((m) => (m.userId === 'u1' ? { ...m, role: 'member' } : m)) }) }), 1)
  assert.equal(s.persona, 'member')
  assert.equal(liveSectors(34, territories(), 1).length, 3)
})

test('live: bind, then place the HQ on a real sector; a sector the game takes away drops the HQ', () => {
  const i = input()
  S.bindLive('test-key-1', () => buildLiveState(i), (d) => syncLiveState(d, i))
  assert.equal(st().live.clanId, 34)
  ok(S.placeHq('B1'))
  assert.equal(st().hq.sectorId, 'B1')
  assert.equal(st().treasury.balance, 3000 - st().settings.hqPlaceCost)
  no(S.placeHq('B4'), 'hqNotMine')
  no(S.placeHq('B5'), 'hqNotMine')
  // the real game takes B1 from the clan: the HQ falls by itself
  const lost = { ...i, territories: territories().map((t) => (t.id === 'B1' ? terr('B1', 99) : t)) }
  S.bindLive('test-key-1', () => buildLiveState(lost), (d) => syncLiveState(d, lost))
  assert.equal(st().hq.sectorId, null)
  assert.ok(st().hq.ruins)
  assert.equal(st().hq.ruins.sectorId, 'B1')
})

test('live: view as a member loses the manager rights; the real role comes back', () => {
  const i = input()
  S.bindLive('test-key-2', () => buildLiveState(i), (d) => syncLiveState(d, i))
  assert.equal(S.canManage(st()), true)
  ok(S.setViewAs('member'))
  assert.equal(S.canManage(st()), false)
  no(S.placeHq('B2'), 'notManager')
  // a sync (new data from the server) keeps the chosen view
  S.bindLive('test-key-2', () => buildLiveState(i), (d) => syncLiveState(d, i))
  assert.equal(S.canManage(st()), false)
  ok(S.setViewAs(null))
  assert.equal(S.canManage(st()), true)
  ok(S.setViewAs('admin'))
  assert.equal(st().persona, 'admin')
})
