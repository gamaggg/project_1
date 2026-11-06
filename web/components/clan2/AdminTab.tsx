'use client'

import { useState } from 'react'
import { C2Card, C2Coins, fmtAgo, speciesName, useC2, useDemoNow } from '@/components/clan2/C2Common'
import { reverseEntry, updateSettings, useDemoState } from '@/lib/clan2/demoStore'
import { fmt } from '@/lib/clan2/rules'
import type { EconomySettings, TreasuryEntry } from '@/lib/clan2/types'
import { tn, tnd } from '@/lib/i18n/runtime'

// The admin's view of the clan economy: the master switch, every number the
// economy runs on (changed live), what it means for the coins of the game, the
// real clans' rent from the database, and the treasury journal with a reverse
// button on every entry.

// Clans of the database on 06.11.2026 and the rent their sectors would pay at 8 a day.
const REAL_CLANS = [
  { name: 'Fish-hook', members: 3, sectors: 59 },
  { name: 'BFC', members: 10, sectors: 27 },
  { name: '9-АЯ РОТА', members: 4, sectors: 24 },
  { name: 'MFC', members: 30, sectors: 19 },
  { name: 'Рыбнадзор', members: 7, sectors: 15 },
  { name: 'Рыбные - мафиози', members: 1, sectors: 5 },
  { name: '292CREW', members: 4, sectors: 4 },
  { name: 'Кобулети', members: 1, sectors: 4 },
]

type NumKey = 'rentPerSectorDay' | 'sharedRentFactor' | 'buffPrice' | 'buffCooldownHours' | 'buffMinRsvp' | 'taxMax' | 'chestShare' | 'recruitReward' | 'hqPlaceCost' | 'hqMoveCost'
type LabelKey = 'rent' | 'shared' | 'buffPrice' | 'buffCooldown' | 'buffMin' | 'taxMax' | 'chestShare' | 'recruit' | 'hqPlace' | 'hqMove'
const FIELDS: { key: NumKey; label: LabelKey; min: number; max: number; step: number }[] = [
  { key: 'rentPerSectorDay', label: 'rent', min: 1, max: 16, step: 1 },
  { key: 'sharedRentFactor', label: 'shared', min: 1, max: 2, step: 0.25 },
  { key: 'buffPrice', label: 'buffPrice', min: 100, max: 1000, step: 50 },
  { key: 'buffCooldownHours', label: 'buffCooldown', min: 0, max: 48, step: 2 },
  { key: 'buffMinRsvp', label: 'buffMin', min: 1, max: 6, step: 1 },
  { key: 'taxMax', label: 'taxMax', min: 0, max: 15, step: 5 },
  { key: 'chestShare', label: 'chestShare', min: 0, max: 50, step: 5 },
  { key: 'recruitReward', label: 'recruit', min: 50, max: 300, step: 50 },
  { key: 'hqPlaceCost', label: 'hqPlace', min: 100, max: 1000, step: 50 },
  { key: 'hqMoveCost', label: 'hqMove', min: 100, max: 1500, step: 50 },
]

export function AdminTab({ bare }: { bare?: boolean } = {}) {
  const s = useDemoState()
  const now = useDemoNow()
  const { act, say } = useC2()
  const [shown, setShown] = useState(10)
  if (s.persona !== 'admin') return <div className="c2-pad c2-muted">{tn('clan2.admin.onlyAdmin')}</div>

  const rent = s.settings.rentPerSectorDay
  const totalRent = REAL_CLANS.reduce((n, c) => n + c.sectors * rent, 0)
  const set = (patch: Partial<EconomySettings>) => act(updateSettings(patch))
  const entries = [...s.treasury.entries].reverse().slice(0, shown)

  return (
    <div className={`${bare ? '' : 'c2-pad '}c2-stack`}>
      <C2Card title={tn('clan2.admin.title')}>
        <div className="c2-switch-row" data-tour="admin-switch">
          <div>
            <strong>{tn('clan2.admin.switchTitle')}</strong>
            <p className="c2-hint">{tn('clan2.admin.switchHint')}</p>
          </div>
          <button className={`c2-switch${s.settings.enabled ? ' on' : ''}`} role="switch" aria-checked={s.settings.enabled} onClick={() => set({ enabled: !s.settings.enabled })}>
            <i />
            <span>{s.settings.enabled ? tn('clan2.admin.switchOn') : tn('clan2.admin.switchOff')}</span>
          </button>
        </div>
      </C2Card>

      <C2Card title={tn('clan2.admin.settingsTitle')} hint={tn('clan2.admin.settingsHint')} tour="admin-settings">
        <ul className="c2-fields">
          {FIELDS.map((f) => {
            const v = s.settings[f.key]
            return (
              <li key={f.key}>
                <span>{tn(`clan2.admin.${f.label}`)}</span>
                <span className="c2-stepper">
                  <button aria-label="−" disabled={v <= f.min} onClick={() => set({ [f.key]: Math.max(f.min, +(v - f.step).toFixed(2)) })}>
                    −
                  </button>
                  <b>{v}</b>
                  <button aria-label="+" disabled={v >= f.max} onClick={() => set({ [f.key]: Math.min(f.max, +(v + f.step).toFixed(2)) })}>
                    +
                  </button>
                </span>
              </li>
            )
          })}
        </ul>
      </C2Card>

      <C2Card title={tn('clan2.admin.econTitle')} tour="admin-economy">
        <p className="c2-muted">{tn('clan2.admin.econNow')}</p>
        <p className="c2-big" style={{ fontSize: 18 }}>
          {tn('clan2.admin.econNew', { n: fmt(totalRent) })}
        </p>
        <p className="c2-hint">{tn('clan2.admin.econNote')}</p>
        <div className="c2-label">{tn('clan2.admin.clansTitle')}</div>
        <div className="c2-muted small">{tn('clan2.admin.clansCols')}</div>
        <ul className="c2-realclans">
          {REAL_CLANS.map((c) => (
            <li key={c.name}>
              <span>{c.name}</span>
              <span className="c2-muted small">
                {c.members} · {c.sectors} · <b>{fmt(c.sectors * rent)}</b>
              </span>
            </li>
          ))}
        </ul>
      </C2Card>

      <C2Card title={tn('clan2.admin.journalTitle')} tour="admin-journal">
        <ul className="c2-journal">
          {entries.map((e: TreasuryEntry) => {
            const raw = e.note.replace(/\|lost:\d+/, '').replace(/^reversed:?/, '')
            return (
              <li key={e.id} className={e.amount < 0 ? 'out' : 'in'}>
                <span className="c2-journal-dot" aria-hidden>
                  {e.amount < 0 ? '−' : '+'}
                </span>
                <div className="c2-journal-main">
                  <div>{tnd(`clan2.journal.${e.kind}`, { species: e.kind === 'tax' ? speciesName(raw) : '', name: raw })}</div>
                  <div className="c2-muted small">
                    {fmtAgo(now - e.at)}
                    {e.note.startsWith('reversed') ? ` · ${tn('clan2.treasury.reversed')}` : ''}
                  </div>
                </div>
                <C2Coins n={e.amount} sign />
                {!e.note.startsWith('reversed') && (
                  <button className="c2-link" onClick={() => act(reverseEntry(e.id)) && say(tn('clan2.ok.reversed'))}>
                    {tn('clan2.admin.reverse')}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
        <button className="btn-secondary" onClick={() => setShown((n) => n + 10)}>
          {tn('clan2.treasury.journalMore')}
        </button>
      </C2Card>
    </div>
  )
}
