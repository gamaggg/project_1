'use client'

import { useMemo, useState } from 'react'
import { CoinIcon } from '@/components/app-shell/CoinIcon'
import { C2Avatar, C2Bar, C2Card, C2Coins, C2Sheet, fmtAgo, speciesName, useC2, useDemoNow } from '@/components/clan2/C2Common'
import { buyGoal, canManage, capOf, deposit, goalOf, rentPerDay, setGoal, setTaxRate, useDemoState } from '@/lib/clan2/demoStore'
import { DAY, GOAL_CATALOG, TAX_RATES, fmt, isSpend, taxOf } from '@/lib/clan2/rules'
import type { TreasuryEntry, TreasuryKind } from '@/lib/clan2/types'
import { tn, tnd } from '@/lib/i18n/runtime'

// «Общак»: what is in the clan's treasury, where it comes from, what it is
// saving up for and what has been done with it — the one place the clan's
// money is looked at, and the replacement of the personal Kazna.

const SOURCE_GROUPS: { id: 'srcRent' | 'srcTax' | 'srcDeposit' | 'srcShares' | 'srcOther'; kinds: TreasuryKind[] }[] = [
  { id: 'srcRent', kinds: ['rent', 'hot_rent'] },
  { id: 'srcTax', kinds: ['tax'] },
  { id: 'srcDeposit', kinds: ['deposit'] },
  { id: 'srcShares', kinds: ['chest_share', 'race_share'] },
  { id: 'srcOther', kinds: ['recruit', 'quest', 'tournament', 'refund'] },
]

const PRESETS = [50, 100, 250, 500]

export function TreasuryTab() {
  const s = useDemoState()
  const now = useDemoNow()
  const { act, say } = useC2()
  const [depositOpen, setDepositOpen] = useState(false)
  const [goalOpen, setGoalOpen] = useState(false)
  const [amount, setAmount] = useState(100)
  const [more, setMore] = useState(false)

  const manage = canManage(s)
  const cap = capOf(s)
  const rent = rentPerDay(s)
  const goal = goalOf(s)
  const week = useMemo(() => s.treasury.entries.filter((e) => e.at >= now - 7 * DAY), [s.treasury.entries, now])
  const income = (kinds: TreasuryKind[]) => week.filter((e) => kinds.includes(e.kind) && e.amount > 0).reduce((n, e) => n + e.amount, 0)
  const sources = SOURCE_GROUPS.map((g) => ({ ...g, sum: income(g.kinds) }))
  const maxSource = Math.max(1, ...sources.map((x) => x.sum))
  const spent = week.filter((e) => isSpend(e.kind)).reduce((n, e) => n + -e.amount, 0)
  const flow = useMemo(() => {
    const days = Array.from({ length: 7 }, () => 0)
    for (const e of s.treasury.entries) {
      const back = Math.floor((now - e.at) / DAY)
      if (back >= 0 && back < 7 && e.amount > 0) days[6 - back] += e.amount
    }
    return days
  }, [s.treasury.entries, now])
  const maxFlow = Math.max(1, ...flow)
  const contributors = [...s.members].filter((m) => m.weekDeposit > 0).sort((a, b) => b.weekDeposit - a.weekDeposit).slice(0, 6)
  const maxContribution = Math.max(1, contributors[0]?.weekDeposit ?? 1)
  const entries = [...s.treasury.entries].reverse().slice(0, more ? 24 : 8)
  const wallet = s.wallet
  const goalLeft = goal ? Math.max(0, goal.cost - s.treasury.balance) : 0

  return (
    <div className="c2-stack">
      <C2Card tour="treasury-balance" style={{ padding: 0 }}>
        <div className="c2-balance">
          <div className="c2-balance-label">{tn('clan2.treasury.balance')}</div>
          <div className="c2-balance-num">
            <span>{fmt(s.treasury.balance)}</span>
            <CoinIcon size={28} animated="bounce" />
          </div>
          <C2Bar value={s.treasury.balance / cap} tone={s.treasury.balance / cap > 0.9 ? 'warn' : 'accent'} label={tn('clan2.treasury.balance')} />
          <div className="c2-balance-cap">{tn('clan2.treasury.capOf', { cap: fmt(cap) })}</div>
          <div className="c2-flow" aria-label={tn('clan2.treasury.weekFlow')}>
            {flow.map((v, i) => (
              <i key={i} style={{ height: `${Math.max(6, (v / maxFlow) * 100)}%` }} className={i === 6 ? 'now' : undefined} />
            ))}
          </div>
          <div className="c2-chip good">{tn('clan2.treasury.rentToday', { n: fmt(rent) })}</div>
          <p className="c2-hint">{tn('clan2.treasury.rentNote')}</p>
          <p className="c2-hint faint">{tn('clan2.treasury.capNote')}</p>
        </div>
        <div className="c2-balance-actions">
          <button className="btn-primary" onClick={() => setDepositOpen(true)} disabled={s.persona === 'solo'}>
            {tn('clan2.treasury.deposit')}
          </button>
        </div>
      </C2Card>

      <C2Card title={tn('clan2.treasury.goalTitle')} hint={tn('clan2.treasury.goalExplain')} tour="treasury-goal">
        {goal ? (
          <>
            <div className="c2-goal-row">
              <strong>{tnd(`clan2.goal.${goal.id}`)}</strong>
              <C2Coins n={goal.cost} />
            </div>
            <C2Bar value={s.treasury.balance / goal.cost} tone={goalLeft === 0 ? 'good' : 'accent'} label={tnd(`clan2.goal.${goal.id}`)} />
            <div className="c2-goal-foot">
              <span className={goalLeft === 0 ? 'c2-ok' : 'c2-muted'}>{goalLeft === 0 ? tn('clan2.treasury.goalReady') : tn('clan2.treasury.goalLeft', { n: fmt(goalLeft) })}</span>
              <span className="c2-muted">{Math.min(100, Math.round((s.treasury.balance / goal.cost) * 100))} %</span>
            </div>
          </>
        ) : (
          <p className="c2-muted">{tn('clan2.treasury.goalNone')}</p>
        )}
        {manage && (
          <div className="c2-row-btns">
            <button className="btn-secondary" onClick={() => setGoalOpen(true)}>
              {goal ? tn('clan2.treasury.goalChange') : tn('clan2.treasury.goalPick')}
            </button>
            {goal && (
              <button className="btn-primary" disabled={goalLeft > 0} onClick={() => act(buyGoal(), 'bought')}>
                {tn('clan2.treasury.goalBuy')}
              </button>
            )}
          </div>
        )}
      </C2Card>

      <C2Card title={tn('clan2.treasury.sourcesTitle')} tour="treasury-sources">
        <ul className="c2-sources">
          {sources.map((x) => (
            <li key={x.id}>
              <div className="c2-sources-top">
                <span>{tn(`clan2.treasury.${x.id}`)}</span>
                <C2Coins n={x.sum} sign />
              </div>
              <C2Bar value={x.sum / maxSource} tone="good" />
            </li>
          ))}
        </ul>
        <div className="c2-sources-spent">
          <span>{tn('clan2.treasury.spentTitle')}</span>
          <C2Coins n={-spent} />
        </div>
      </C2Card>

      <C2Card title={tn('clan2.treasury.taxTitle')} hint={tn('clan2.treasury.taxHint')} tour="treasury-tax">
        <div className="c2-seg" role="radiogroup" aria-label={tn('clan2.treasury.taxTitle')}>
          {TAX_RATES.filter((r) => r <= s.settings.taxMax).map((r) => (
            <button
              key={r}
              role="radio"
              aria-checked={s.treasury.taxRate === r}
              className={s.treasury.taxRate === r ? 'on' : undefined}
              disabled={!manage}
              onClick={() => act(setTaxRate(r), 'taxSet')}
            >
              {r === 0 ? tn('clan2.treasury.taxOff') : tn('clan2.treasury.taxPct', { n: r })}
            </button>
          ))}
        </div>
        <p className="c2-muted small">{tn('clan2.treasury.taxExample', { n: taxOf(100, s.treasury.taxRate) })}</p>
      </C2Card>

      <C2Card title={tn('clan2.treasury.contribTitle')} hint={tn('clan2.treasury.contribNote')} tour="treasury-contrib">
        <ul className="c2-contrib">
          {contributors.map((m, i) => (
            <li key={m.id}>
              <C2Avatar member={m} size={32} />
              <div className="c2-contrib-main">
                <div className="c2-contrib-top">
                  <span className="c2-name">
                    {m.name}
                    {m.id === s.myId && <em className="c2-you">{tn('clan2.treasury.you')}</em>}
                  </span>
                  <C2Coins n={m.weekDeposit} />
                </div>
                <C2Bar value={m.weekDeposit / maxContribution} tone={i === 0 ? 'warn' : 'accent'} />
              </div>
              {i === 0 && (
                <span className="c2-patron" title={tn('clan2.treasury.patron')}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M4 18 3 8l5 4 4-7 4 7 5-4-1 10z" />
                  </svg>
                  {tn('clan2.treasury.patron')}
                </span>
              )}
            </li>
          ))}
        </ul>
      </C2Card>

      <C2Card title={tn('clan2.treasury.journalTitle')} tour="treasury-journal">
        {entries.length === 0 ? (
          <p className="c2-muted">{tn('clan2.treasury.journalEmpty')}</p>
        ) : (
          <ul className="c2-journal">
            {entries.map((e) => (
              <JournalRow key={e.id} e={e} now={now} />
            ))}
          </ul>
        )}
        <button className="btn-secondary" onClick={() => setMore((v) => !v)}>
          {more ? tn('clan2.treasury.journalLess') : tn('clan2.treasury.journalMore')}
        </button>
      </C2Card>

      <C2Sheet open={depositOpen} onClose={() => setDepositOpen(false)} title={tn('clan2.treasury.depositTitle')}>
        <p className="c2-muted">{tn('clan2.treasury.depositWallet', { n: fmt(wallet) })}</p>
        <div className="c2-presets">
          {PRESETS.map((p) => (
            <button key={p} className={`filter-chip${amount === p ? ' active' : ''}`} onClick={() => setAmount(p)}>
              {fmt(p)}
            </button>
          ))}
        </div>
        <input className="c2-input" type="number" min={10} step={10} value={amount} onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))} aria-label={tn('clan2.treasury.depositTitle')} />
        <p className="c2-hint faint">{tn('clan2.treasury.depositNote')}</p>
        <button
          className="btn-primary"
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

      <C2Sheet open={goalOpen} onClose={() => setGoalOpen(false)} title={tn('clan2.treasury.goalPick')}>
        <ul className="c2-pick">
          {GOAL_CATALOG.filter((g) => !s.owned.includes(g.id.replace(/^skin_/, ''))).map((g) => (
            <li key={g.id}>
              <button
                className={s.treasury.goalId === g.id ? 'on' : undefined}
                onClick={() => {
                  if (act(setGoal(g.id), 'goalSet')) setGoalOpen(false)
                }}
              >
                <span>{tnd(`clan2.goal.${g.id}`)}</span>
                <C2Coins n={g.cost} />
              </button>
            </li>
          ))}
        </ul>
      </C2Sheet>
    </div>
  )
}

function JournalRow({ e, now }: { e: TreasuryEntry; now: number }) {
  const s = useDemoState()
  const [kind, lost] = [e.kind, /\|lost:(\d+)/.exec(e.note)?.[1]]
  const raw = e.note.replace(/\|lost:\d+/, '').replace(/^reversed:?/, '')
  const actor = s.members.find((m) => m.id === e.actor)
  const text = tnd(`clan2.journal.${kind}`, { species: kind === 'tax' ? speciesName(raw) : '', name: raw })
  return (
    <li className={e.amount < 0 ? 'out' : 'in'}>
      <span className="c2-journal-dot" aria-hidden>
        {e.amount < 0 ? '−' : '+'}
      </span>
      <div className="c2-journal-main">
        <div>{text}</div>
        <div className="c2-muted small">
          {actor ? `${actor.name} · ` : ''}
          {fmtAgo(now - e.at)}
          {lost ? ` · ${tn('clan2.treasury.lost', { n: lost })}` : ''}
          {e.note.startsWith('reversed') ? ` · ${tn('clan2.treasury.reversed')}` : ''}
        </div>
      </div>
      <C2Coins n={e.amount} sign />
    </li>
  )
}
