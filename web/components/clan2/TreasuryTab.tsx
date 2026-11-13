'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CoinIcon } from '@/components/app-shell/CoinIcon'
import { C2Bar, C2Card, C2Coins, C2Count, C2Sheet, fmtAgo, speciesName, useC2, useDemoNow } from '@/components/clan2/C2Common'
import { ItemPreview, itemName } from '@/components/clan2/ClanItems'
import { HowItWorks, NextStep, type Go } from '@/components/clan2/Guide'
import { alertText } from '@/components/clan2/alertText'
import { buyGoal, canManage, capOf, deposit, goalOf, levelOf, rentPerDay, setTaxRate, siegeLocked, useDemoState } from '@/lib/clan2/demoStore'
import { requestMap, setLiveUi } from '@/lib/clan2/live/ui'
import { readWeekLog } from '@/lib/clan2/live/server'
import { DAY, PROJECT_EFFECTS, TAX_RATES, fmt, treasuryCap } from '@/lib/clan2/rules'
import type { AlertKind, QuestKind, TreasuryEntry, TreasuryKind } from '@/lib/clan2/types'
import { questLabel } from '@/components/clan2/WeekTab'
import { tn, tnd } from '@/lib/i18n/runtime'

// «Общак»: what is in the clan's treasury and what it is saving for, where the coins of the week came from, the catch
// tax (the leaders' setting), and the clan's one journal — the coins, the clan's events and its alarms in one list.

const SOURCE_GROUPS: { id: 'srcRent' | 'srcTax' | 'srcDeposit' | 'srcShares' | 'srcOther'; kinds: TreasuryKind[] }[] = [
  { id: 'srcRent', kinds: ['rent', 'hot_rent'] },
  { id: 'srcTax', kinds: ['tax'] },
  { id: 'srcDeposit', kinds: ['deposit'] },
  { id: 'srcShares', kinds: ['chest_share', 'race_share'] },
  { id: 'srcOther', kinds: ['recruit', 'quest', 'tournament', 'refund'] },
]

const PRESETS = [50, 100, 250, 500]

// A line of the clan's own journal (who joined, left, changed role), as the clan screen words it.
export type ClanEventLine = { text: string; at: number }

export function TreasuryTab({ onGo, events, onTour }: { onGo?: (to: Go) => void; events?: ClanEventLine[]; onTour?: () => void } = {}) {
  const s = useDemoState()
  const now = useDemoNow()
  const { act, say } = useC2()
  const [depositOpen, setDepositOpen] = useState(false)
  // The field's own text: an emptied field stays empty (a number state put a «0» in front of what was typed next).
  const [amountText, setAmountText] = useState('100')
  const amount = Number(amountText) || 0
  const [rentOpen, setRentOpen] = useState(false)
  const [capOpen, setCapOpen] = useState(false)
  // The source opened to its lines: one of the week's groups, or what was spent.
  const [info, setInfo] = useState<'srcTax' | 'srcDeposit' | 'srcShares' | 'srcOther' | 'spent' | null>(null)

  const manage = canManage(s)
  const cap = capOf(s)
  const rent = rentPerDay(s)
  const goal = goalOf(s)
  // The week in full from the server (the state's journal is only its last 50 lines); refreshed with every change of
  // the balance. The browser-only preview counts its own entries.
  const clanId = s.live?.clanId ?? null
  const { data: weekLog } = useQuery({
    queryKey: ['clan2-week-log', clanId, s.treasury.balance, s.treasury.entries.at(-1)?.id ?? 0],
    enabled: !!clanId && s.settings.enabled,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
    queryFn: () => readWeekLog(clanId!),
  })
  const allEntries = weekLog ?? s.treasury.entries
  const week = useMemo(() => allEntries.filter((e) => e.at >= now - 7 * DAY), [allEntries, now])
  const income = (kinds: TreasuryKind[]) => week.filter((e) => kinds.includes(e.kind) && e.amount > 0).reduce((n, e) => n + e.amount, 0)
  const sources = SOURCE_GROUPS.map((g) => ({ ...g, sum: income(g.kinds) }))
  const maxSource = Math.max(1, ...sources.map((x) => x.sum))
  // Every coin that left, the HQ's loot taken by attackers included (it is not a purchase, but it is gone).
  const isOut = (e: TreasuryEntry) => e.amount < 0
  const spent = week.filter(isOut).reduce((n, e) => n + -e.amount, 0)
  const flow = useMemo(() => {
    const days = Array.from({ length: 7 }, () => 0)
    for (const e of allEntries) {
      const back = Math.floor((now - e.at) / DAY)
      if (back >= 0 && back < 7 && e.amount > 0) days[6 - back] += e.amount
    }
    return days
  }, [allEntries, now])
  const maxFlow = Math.max(1, ...flow)
  const wallet = s.wallet
  const goalLeft = goal ? Math.max(0, goal.cost - s.treasury.balance) : 0
  const isMember = s.members.some((m) => m.id === s.myId)
  // Why the deposit cannot go in as typed (the button stays off and says nothing else).
  const room = Math.max(0, cap - s.treasury.balance)
  const depositProblem =
    room === 0
      ? tn('clan2.treasury.depositFull')
      : amount > wallet
        ? tn('clan2.treasury.depositWalletShort', { n: fmt(wallet) })
        : amount > 0 && amount < 10
          ? tn('clan2.treasury.depositMin')
          : amount > room
            ? tn('clan2.treasury.depositRoom', { n: fmt(room) })
            : null

  return (
    <div className="c2-stack">
      <C2Card style={{ padding: 0 }}>
        <div className="c2-balance" data-focus="treasury-top">
          {/* The tour's first step lights up just the balance, not the whole card. */}
          <div className="c2-balance-core" data-tour="treasury-balance">
            <div className="c2-balance-label">{tn('clan2.treasury.balance')}</div>
            <div className="c2-balance-num">
              <C2Count value={s.treasury.balance} />
              <CoinIcon size={28} />
            </div>
            <C2Bar value={s.treasury.balance / cap} tone={s.treasury.balance / cap > 0.9 ? 'warn' : 'accent'} label={tn('clan2.treasury.balance')} />
            <button type="button" className="c2-balance-cap" onClick={() => setCapOpen(true)}>
              {tn('clan2.treasury.capOf', { cap: fmt(cap) })}
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="m9 6 6 6-6 6" />
              </svg>
            </button>
          </div>
          <div className="c2-flow-label">{tn('clan2.treasury.weekFlow')}</div>
          <div className="c2-flow" aria-label={tn('clan2.treasury.weekFlow')}>
            {flow.map((v, i) => (
              <i key={i} style={{ height: `${Math.max(6, (v / maxFlow) * 100)}%` }} className={i === 6 ? 'now' : undefined} />
            ))}
          </div>
          <button type="button" className="c2-chip accent c2-chip-btn" onClick={() => setRentOpen(true)} aria-label={tn('clan2.treasury.tapForMore')}>
            {tn('clan2.treasury.rentToday', { n: fmt(rent) })}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>
          <p className="c2-hint">{tn('clan2.treasury.rentNote')}</p>
        </div>
        <div className="c2-balance-actions">
          <button className="btn-primary" onClick={() => setDepositOpen(true)} disabled={!isMember}>
            {tn('clan2.treasury.deposit')}
          </button>
          {siegeLocked(s) && <p className="c2-short">{tn('clan2.siegeLock.text')}</p>}
        </div>
        {/* The goal of the treasury, chosen in the shop: what the clan is saving for, seen by everybody. */}
        {goal ? (
          <div className={`c2-goal-strip${goalLeft === 0 ? ' ready' : ''}`}>
            <span className="c2-goal-pic">
              <ItemPreview item={goal} crest={s.clan.crest} size={goal.kind === 'boat' ? 104 : 72} />
            </span>
            <div className="c2-goal-main">
              <small>{tn('clan2.treasury.savingFor')}</small>
              <b>{itemName(goal.id)}</b>
              <C2Bar value={s.treasury.balance / goal.cost} tone="accent" label={itemName(goal.id)} />
              <span className="c2-goal-left">
                {goalLeft === 0 ? tn('clan2.treasury.goalReady') : tn('clan2.treasury.goalLeft', { n: fmt(goalLeft) })}
                <span>
                  {fmt(Math.min(s.treasury.balance, goal.cost))} / {fmt(goal.cost)}
                </span>
              </span>
              {manage && (
                <div className="c2-goal-btns">
                  {goalLeft === 0 && s.clan.level >= goal.minLevel && (
                    <button className="btn-primary" disabled={siegeLocked(s)} onClick={() => act(buyGoal(), 'bought')}>
                      {siegeLocked(s) ? tn('clan2.siegeLock.btn') : tn('clan2.shop.buyFor', { n: fmt(goal.cost) })}
                    </button>
                  )}
                  <button className="c2-link" onClick={() => onGo?.('shop')}>
                    {tn('clan2.treasury.goalChange')}
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          manage && (
            <button type="button" className="c2-goal-strip empty" onClick={() => onGo?.('shop')}>
              <span>{tn('clan2.treasury.goalPickInShop')}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="m9 6 6 6-6 6" />
              </svg>
            </button>
          )
        )}
      </C2Card>

      <NextStep onGo={onGo} />

      <C2Card title={tn('clan2.treasury.sourcesTitle')} tour="treasury-sources">
        <ul className="c2-sources">
          {sources.map((x) => (
            <li key={x.id}>
              <button type="button" className="c2-source-btn" onClick={() => (x.id === 'srcRent' ? setRentOpen(true) : setInfo(x.id))} aria-label={`${tn(`clan2.treasury.${x.id}`)}. ${tn('clan2.treasury.tapForMore')}`}>
                <div className="c2-sources-top">
                  <span>{tn(`clan2.treasury.${x.id}`)}</span>
                  <C2Coins n={x.sum} sign />
                </div>
                <C2Bar value={x.sum / maxSource} tone="accent" />
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="c2-sources-spent" onClick={() => setInfo('spent')} aria-label={`${tn('clan2.treasury.spentTitle')}. ${tn('clan2.treasury.tapForMore')}`}>
          <span>{tn('clan2.treasury.spentTitle')}</span>
          <span className="c2-sources-spent-n">
            <C2Coins n={-spent} />
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m9 6 6 6-6 6" />
            </svg>
          </span>
        </button>
      </C2Card>

      {/* The catch tax is the leaders' setting: the others meet it on every catch, not here. */}
      {manage && (
        <C2Card title={tn('clan2.treasury.taxTitle')} hint={tn('clan2.treasury.taxHint')} tour="treasury-tax">
          <div className="c2-seg" role="radiogroup" aria-label={tn('clan2.treasury.taxTitle')}>
            {TAX_RATES.filter((r) => r <= s.settings.taxMax).map((r) => (
              <button key={r} role="radio" aria-checked={s.treasury.taxRate === r} className={s.treasury.taxRate === r ? 'on' : undefined} onClick={() => act(setTaxRate(r), 'taxSet')}>
                {r === 0 ? tn('clan2.treasury.taxOff') : tn('clan2.treasury.taxPct', { n: r })}
              </button>
            ))}
          </div>
        </C2Card>
      )}

      <ClanJournal events={events} />

      <HowItWorks onTour={onTour} />

      <C2Sheet open={depositOpen} onClose={() => setDepositOpen(false)} title={tn('clan2.treasury.depositTitle')}>
        <p className="c2-muted">{tn('clan2.treasury.depositWallet', { n: fmt(wallet) })}</p>
        <div className="c2-presets">
          {PRESETS.map((p) => (
            <button key={p} className={`filter-chip${amount === p ? ' active' : ''}`} onClick={() => setAmountText(String(p))}>
              {fmt(p)}
            </button>
          ))}
        </div>
        <input
          className="c2-input"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          value={amountText}
          placeholder="0"
          onChange={(e) => setAmountText(e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 7))}
          aria-label={tn('clan2.treasury.depositTitle')}
        />
        {depositProblem && <p className="c2-short">{depositProblem}</p>}
        <p className="c2-hint faint">{tn('clan2.treasury.depositNote')}</p>
        <button
          className="btn-primary"
          disabled={!!depositProblem || amount === 0}
          onClick={() => {
            if (act(deposit(amount))) {
              say(tn('clan2.ok.deposited', { n: fmt(amount) }))
              setDepositOpen(false)
            }
          }}
        >
          {tn('clan2.treasury.depositGo', { n: fmt(amount) })}
        </button>
      </C2Sheet>

      <C2Sheet open={rentOpen} onClose={() => setRentOpen(false)} title={tn('clan2.treasury.rentSheetTitle')}>
        <RentDetail />
      </C2Sheet>
      <C2Sheet open={capOpen} onClose={() => setCapOpen(false)} title={tn('clan2.cap.title')}>
        <CapDetail
          onStorage={() => {
            setCapOpen(false)
            onGo?.('storage')
          }}
        />
      </C2Sheet>
      <C2Sheet open={!!info} onClose={() => setInfo(null)} title={info ? (info === 'spent' ? tn('clan2.treasury.spentTitle') : tn(`clan2.treasury.${info}`)) : ''}>
        {info && <SourceDetail id={info} lines={info === 'spent' ? week.filter(isOut) : week.filter((e) => SOURCE_GROUPS.find((g) => g.id === info)!.kinds.includes(e.kind) && e.amount > 0)} />}
      </C2Sheet>
    </div>
  )
}

// A source of the week opened up: what it is in one line, its total, and every entry — what, when, who, how much.
function SourceDetail({ id, lines }: { id: 'srcTax' | 'srcDeposit' | 'srcShares' | 'srcOther' | 'spent'; lines: TreasuryEntry[] }) {
  const s = useDemoState()
  const total = lines.reduce((n, e) => n + e.amount, 0)
  const sorted = [...lines].sort((a, b) => b.at - a.at)
  return (
    <div className="c2-stack c2-source-detail">
      <div className="c2-cap-total">
        <C2Coins n={total} sign />
        <small>{tn('clan2.treasury.weekTotal')}</small>
      </div>
      <p className="c2-muted">{tn(`clan2.treasury.info${id === 'spent' ? 'Spent' : id.slice(3)}` as 'clan2.treasury.infoTax')}</p>
      {sorted.length === 0 ? (
        <p className="c2-source-none">{tn('clan2.treasury.weekNone')}</p>
      ) : (
        <ul className="c2-journal">
          {sorted.map((e) => {
            const l = moneyLine(e, s.members)
            return (
              <li key={e.id} className={l.tone}>
                <span className="c2-journal-dot" aria-hidden>
                  {l.tone === 'in' ? '+' : '−'}
                </span>
                <div className="c2-journal-main">
                  <div>{l.text}</div>
                  <div className="c2-muted small">
                    {l.meta}
                    {whenOf(e.at)}
                  </div>
                </div>
                <C2Coins n={e.amount} sign />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// «пт, 14:30» — the day of the week and the time of an entry.
const whenOf = (at: number) => new Date(at).toLocaleString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

// Where the treasury's cap comes from: the clan's level, and the «Склад» of the base on top; what the next level and
// the next level of the «Склад» would give.
function CapDetail({ onStorage }: { onStorage: () => void }) {
  const s = useDemoState()
  const level = s.clan.level
  const storage = levelOf(s, 'storage')
  const base = treasuryCap(level, 0)
  const extra = PROJECT_EFFECTS.storage.cap[storage]
  let nextLevel = level + 1
  while (nextLevel <= 10 && treasuryCap(nextLevel, 0) === base) nextLevel++
  const nextBase = nextLevel <= 10 ? treasuryCap(nextLevel, 0) : null
  const nextStorage = storage < 3 ? PROJECT_EFFECTS.storage.cap[storage + 1] : null
  return (
    <div className="c2-stack c2-cap">
      <div className="c2-cap-total">
        <C2Coins n={base + extra} />
        <small>{tn('clan2.cap.total')}</small>
      </div>
      <ul className="c2-cap-rows">
        <li>
          <span>{tn('clan2.cap.fromLevel', { n: level })}</span>
          <b>{fmt(base)}</b>
        </li>
        <li className={extra > 0 ? undefined : 'off'}>
          <span>{storage > 0 ? tn('clan2.cap.fromStorage', { n: storage }) : tn('clan2.cap.noStorage')}</span>
          <b>+{fmt(extra)}</b>
        </li>
      </ul>
      <div className="c2-cap-next">
        {nextBase !== null && <p>{tn('clan2.cap.nextLevel', { n: nextLevel, cap: fmt(nextBase + extra) })}</p>}
        {nextStorage !== null && <p>{tn('clan2.cap.nextStorage', { n: storage + 1, plus: fmt(nextStorage - extra) })}</p>}
      </div>
      <p className="c2-hint faint">{tn('clan2.cap.over')}</p>
      {nextStorage !== null && (
        <button className="btn-secondary" onClick={onStorage}>
          {tn('clan2.cap.toStorage')}
        </button>
      )}
    </div>
  )
}

// ───────────── the clan's journal ─────────────

const DANGER: AlertKind[] = ['sector_attack', 'hq_siege', 'hq_fallen']
type Line = { key: string; at: number; kind: 'money' | 'event'; tone: 'in' | 'out' | 'danger' | 'event'; text: string; meta: string; amount?: number }

// One list for everything that happens to the clan: the coins of the treasury, the alarms (attacks, sieges, the
// outing, buildings) and the clan's own events (who joined, left, changed role). Filters split coins from events.
function ClanJournal({ events }: { events?: ClanEventLine[] }) {
  const s = useDemoState()
  const now = useDemoNow()
  const [filter, setFilter] = useState<'all' | 'money' | 'event'>('all')
  const [shown, setShown] = useState(8)
  const lines = useMemo(() => {
    const out: Line[] = []
    for (const e of s.treasury.entries) out.push(moneyLine(e, s.members))
    for (const a of s.alerts) {
      // The coins of a bought item are already a line of the treasury; its alert would only repeat it.
      if (a.kind === 'project_done' && !a.text.includes(':')) continue
      out.push({ key: `a${a.id}`, at: a.at, kind: 'event', tone: DANGER.includes(a.kind) ? 'danger' : 'event', text: alertText(a), meta: '' })
    }
    for (const [i, e] of (events ?? []).entries()) out.push({ key: `e${i}`, at: e.at, kind: 'event', tone: 'event', text: e.text, meta: '' })
    return out.sort((a, b) => b.at - a.at)
  }, [s.treasury.entries, s.alerts, s.members, events])
  const list = lines.filter((l) => filter === 'all' || l.kind === filter)
  return (
    <C2Card title={tn('clan2.journal.title')} tour="treasury-journal">
      <div className="c2-journal-filter" role="tablist">
        {(['all', 'money', 'event'] as const).map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            className={`filter-chip${filter === f ? ' active' : ''}`}
            onClick={() => {
              setFilter(f)
              setShown(8)
            }}
          >
            {tn(`clan2.journal.filter_${f}`)}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="c2-muted">{tn('clan2.treasury.journalEmpty')}</p>
      ) : (
        <ul className="c2-journal">
          {list.slice(0, shown).map((l) => (
            <li key={l.key} className={l.tone}>
              <span className="c2-journal-dot" aria-hidden>
                {l.tone === 'in' ? '+' : l.tone === 'out' ? '−' : l.tone === 'danger' ? '!' : '•'}
              </span>
              <div className="c2-journal-main">
                <div>{l.text}</div>
                <div className="c2-muted small">
                  {l.meta}
                  {fmtAgo(now - l.at)}
                </div>
              </div>
              {l.amount !== undefined && <C2Coins n={l.amount} sign />}
            </li>
          ))}
        </ul>
      )}
      {list.length > shown && (
        <button className="btn-secondary" onClick={() => setShown((n) => n + 10)}>
          {tn('clan2.treasury.journalMore')}
        </button>
      )}
    </C2Card>
  )
}

function moneyLine(e: TreasuryEntry, members: { id: string; name: string }[]): Line {
  const lost = /\|lost:(\d+)/.exec(e.note)?.[1]
  const raw = e.note.replace(/\|lost:\d+/, '').replace(/^reversed:?/, '')
  const actor = members.find((m) => m.id === e.actor)
  const bought = e.kind === 'spend_goal' || e.kind === 'spend_skin'
  // The weekly task says which one it was (its kind and target sit in the entry's note: «catches:25»).
  const [questKind, questTarget] = raw.split(':')
  const text =
    bought && raw
      ? tn('clan2.journal.boughtItem', { name: itemName(raw) })
      : e.kind === 'quest' && questTarget
        ? tn('clan2.journal.questDone', { name: questLabel(questKind as QuestKind, Number(questTarget)) })
        : e.kind === 'refund' && raw === 'buff'
          ? tn('clan2.journal.refundBuff')
          : e.kind === 'spend_project' && raw.includes(':')
            ? tn('clan2.journal.projectLevel', { name: raw.startsWith('speedup:') ? tn('clan2.journal.speedup', { name: tnd(`clan2.project.${raw.split(':')[1]}.name`) }) : tnd(`clan2.project.${raw.split(':')[0]}.name`), n: raw.split(':').at(-1) ?? '' })
            : tnd(`clan2.journal.${e.kind}`, { species: e.kind === 'tax' ? speciesName(raw) : '', name: raw })
  const meta = [actor?.name, lost ? tn('clan2.treasury.lost', { n: lost }) : '', e.note.startsWith('reversed') ? tn('clan2.treasury.reversed') : ''].filter(Boolean).join(' · ')
  return { key: `m${e.id}`, at: e.at, kind: 'money', tone: e.amount < 0 ? 'out' : 'in', text, meta: meta ? `${meta} · ` : '', amount: e.amount }
}

// The rent of the clan, seen from three sides: how much it is (per day, week or month), what it is made of (one bar
// with a legend), and every sector with its own share — a tap on a sector shows it on the map (live mode).
type RentKind = 'plain' | 'shared' | 'hq' | 'hot'
// The app's own colours: the HQ in ink, a shared sector in the accent, a hot one in its flame orange, a plain one grey.
const RENT_COLOR: Record<RentKind | 'market', string> = { plain: '#C9C5BB', shared: '#FC5200', hq: '#17181B', hot: '#FFA25C', market: '#E0A63A' }

function RentDetail() {
  const s = useDemoState()
  const [period, setPeriod] = useState<1 | 7 | 30>(1)
  const [filter, setFilter] = useState<'all' | RentKind>('all')
  const per = s.settings.rentPerSectorDay
  const rows = s.sectors
    .filter((x) => x.owner === 'mine')
    .map((x) => {
      const hq = x.hq === 'mine'
      const kind: RentKind = hq ? 'hq' : x.hot ? 'hot' : x.shared > 1 ? 'shared' : 'plain'
      const base = per * (x.shared > 1 && !hq ? s.settings.sharedRentFactor : 1) * (hq ? 2 : 1)
      const hot = x.hot ? per * 2 : 0
      return { id: x.id, kind, shared: x.shared, hot: x.hot, base, day: Math.round(base + hot) }
    })
    .sort((a, b) => b.day - a.day)
  const total = rentPerDay(s)
  const parts: { kind: RentKind | 'market'; sum: number }[] = (['hq', 'shared', 'hot', 'plain'] as RentKind[]).map((kind) => ({ kind, sum: rows.filter((r) => r.kind === kind).reduce((n, r) => n + r.day, 0) }))
  const market = Math.max(0, total - parts.reduce((n, x) => n + x.sum, 0))
  parts.push({ kind: 'market', sum: market })
  const shown = rows.filter((r) => filter === 'all' || r.kind === filter)
  const max = Math.max(1, ...rows.map((r) => r.day))
  const mult = period
  const live = !!s.live
  return (
    <div className="c2-stack c2-rent">
      <div className="c2-rent-hero">
        <div className="c2-seg" role="tablist" aria-label={tn('clan2.treasury.rentSheetTitle')}>
          {([1, 7, 30] as const).map((p) => (
            <button key={p} role="tab" aria-selected={period === p} className={period === p ? 'on' : undefined} onClick={() => setPeriod(p)}>
              {tn(p === 1 ? 'clan2.treasury.rentDay' : p === 7 ? 'clan2.treasury.rentWeek' : 'clan2.treasury.rentMonth')}
            </button>
          ))}
        </div>
        <div className="c2-rent-big" key={period}>
          <C2Count value={total * mult} />
          <CoinIcon size={28} />
        </div>
        <small>{tn('clan2.treasury.rentHour', { n: Math.round((total / 24) * 10) / 10 })}</small>
      </div>

      <div className="c2-rent-compose" role="img" aria-label={tn('clan2.treasury.rentCompose')}>
        {parts
          .filter((x) => x.sum > 0)
          .map((x) => (
            <i key={x.kind} style={{ flexGrow: x.sum, background: RENT_COLOR[x.kind] }} />
          ))}
      </div>
      <ul className="c2-rent-legend">
        {parts
          .filter((x) => x.sum > 0)
          .map((x) => (
            <li key={x.kind}>
              <button type="button" className={filter === x.kind ? 'on' : undefined} onClick={() => x.kind !== 'market' && setFilter(filter === x.kind ? 'all' : x.kind)} disabled={x.kind === 'market'}>
                <i style={{ background: RENT_COLOR[x.kind] }} />
                <span>{tn(`clan2.treasury.rentPart_${x.kind}`)}</span>
                <b>+{fmt(x.sum * mult)}</b>
              </button>
            </li>
          ))}
      </ul>

      <div className="c2-rent-rules">
        <div>
          <b>{per}</b>
          <small>{tn('clan2.treasury.rentTilePlain')}</small>
        </div>
        <div>
          <b>{Math.round(per * s.settings.sharedRentFactor)}</b>
          <small>{tn('clan2.treasury.rentTileShared')}</small>
        </div>
        <div>
          <b>{per * 2}</b>
          <small>{tn('clan2.treasury.rentTileHq')}</small>
        </div>
        <div>
          <b>+{per * 2}</b>
          <small>{tn('clan2.treasury.rentTileHot')}</small>
        </div>
      </div>
      <p className="c2-hint faint">{tn('clan2.treasury.rentNote')}</p>

      {rows.length === 0 ? (
        <p className="c2-muted">{tn('clan2.treasury.rentNoSectors')}</p>
      ) : (
        <>
          <div className="c2-rent-filter">
            {(['all', 'hq', 'shared', 'hot', 'plain'] as const)
              .filter((f) => f === 'all' || rows.some((r) => r.kind === f))
              .map((f) => (
                <button key={f} type="button" className={`filter-chip${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>
                  {tn(`clan2.treasury.rentFilter_${f}`)}
                  <small>{f === 'all' ? rows.length : rows.filter((r) => r.kind === f).length}</small>
                </button>
              ))}
          </div>
          <ul className="c2-rent-rows">
            {shown.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  disabled={!live}
                  onClick={() => {
                    if (live) {
                      setLiveUi({ toolsOpen: false })
                      requestMap({ sectorId: r.id })
                    }
                  }}
                >
                  <span className="c2-hexdot hex-aspect hex-shape" style={{ background: RENT_COLOR[r.kind] }} aria-hidden />
                  <span className="c2-rent-id">
                    <b>{r.id}</b>
                    <small>
                      {r.kind === 'hq' ? tn('clan2.treasury.rentKindHq') : r.kind === 'shared' || r.shared > 1 ? tn('clan2.treasury.rentKindShared', { n: r.shared }) : tn('clan2.treasury.rentKindPlain')}
                      {r.hot ? ` · ${tn('clan2.treasury.rentKindHot')}` : ''}
                    </small>
                  </span>
                  <span className="c2-rent-bar">
                    <i style={{ width: `${(r.day / max) * 100}%`, background: RENT_COLOR[r.kind] }} />
                  </span>
                  <b className="c2-rent-sum">{fmt(r.day * mult)}</b>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
