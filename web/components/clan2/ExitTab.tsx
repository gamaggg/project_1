'use client'

import { useState } from 'react'
import { C2Avatar, C2Card, fmtAgo, fmtLeft, useC2, useDemoNow } from '@/components/clan2/C2Common'
import { alertText } from '@/components/clan2/alertText'
import { canManage, markAlertsRead, planBuff, rsvpBuff, siegeLocked, useDemoState } from '@/lib/clan2/demoStore'
import type { AlertKind, ClanAlert } from '@/lib/clan2/types'
import { tn } from '@/lib/i18n/runtime'

// «Выход»: the clan's two-hour buff. The leader sets it and pays from the
// treasury; members tap «иду» — only those who did get ×2 coins per catch and
// ×1,5 metres of the chest and the battle. If too few tap by the start, the
// outing is cancelled and the coins go back. (The clan's alerts are lines of the clan journal on «Общак».)

const STARTS = [
  { minutes: 10, key: 'now' },
  { minutes: 30, key: 'in30' },
  { minutes: 60, key: 'in1h' },
  { minutes: 180, key: 'in3h' },
] as const

export function ExitTab() {
  const s = useDemoState()
  const now = useDemoNow()
  const { act } = useC2()
  const [startIn, setStartIn] = useState<number>(30)
  const b = s.buff
  const manage = canManage(s)
  const price = s.settings.buffPrice
  const need = s.settings.buffMinRsvp
  const going = b.rsvp.map((id) => s.members.find((m) => m.id === id)).filter((m): m is NonNullable<typeof m> => !!m)
  const imIn = b.rsvp.includes(s.myId)
  const isMember = s.members.some((m) => m.id === s.myId)

  return (
    <div className="c2-stack">
      <C2Card title={tn('clan2.exit.title')} tour="exit-card" focus="exit-card">
        {b.phase === 'idle' && (
          <>
            <p className="c2-hint">{tn('clan2.exit.idleText')}</p>
            <div className="c2-chips-row">
              <span className="c2-chip accent">{tn('clan2.exit.price', { n: price })}</span>
              <span className="c2-chip">{tn('clan2.exit.need', { n: need })}</span>
            </div>
            <div className="c2-fx">
              <span>{tn('clan2.exit.effectCoins')}</span>
              <span>{tn('clan2.exit.effectMeters')}</span>
            </div>
            {manage ? (
              <>
                <div className="c2-label">{tn('clan2.exit.startIn')}</div>
                <div className="c2-seg c2-seg-wrap">
                  {STARTS.map((x) => (
                    <button key={x.minutes} className={startIn === x.minutes ? 'on' : undefined} onClick={() => setStartIn(x.minutes)}>
                      {tn(`clan2.exit.${x.key}`)}
                    </button>
                  ))}
                </div>
                <button className="btn-primary" style={{ marginTop: 12 }} disabled={siegeLocked(s) || s.treasury.balance < price} onClick={() => act(planBuff(startIn), 'buffPlanned')}>
                  {siegeLocked(s) ? tn('clan2.siegeLock.btn') : tn('clan2.exit.plan')}
                </button>
                {siegeLocked(s) && <p className="c2-short">{tn('clan2.siegeLock.text')}</p>}
                {s.treasury.balance < price && <p className="c2-short">{tn('clan2.base.missing', { n: price - s.treasury.balance })}</p>}
              </>
            ) : (
              <p className="c2-muted">{tn('clan2.exit.waitLeader')}</p>
            )}
          </>
        )}

        {b.phase === 'planned' && b.startsAt !== null && (
          <>
            <div className="c2-big">{tn('clan2.exit.startsIn', { t: fmtLeft(b.startsAt - now) })}</div>
            <div className={`c2-chip ${going.length >= need ? 'accent' : 'warn'}`}>{tn('clan2.exit.going', { n: going.length, need })}</div>
            <Going list={going} />
            <p className="c2-hint faint">{tn('clan2.exit.cancelNote', { n: need })}</p>
            {isMember && (
              <button className={imIn ? 'btn-secondary' : 'btn-primary'} onClick={() => act(rsvpBuff(!imIn), imIn ? 'rsvpOff' : 'rsvpOn')}>
                {imIn ? tn('clan2.exit.imOut') : tn('clan2.exit.imIn')}
              </button>
            )}
          </>
        )}

        {b.phase === 'active' && b.endsAt !== null && (
          <>
            <div className="c2-live">
              <i />
              {tn('clan2.exit.activeTitle')}
            </div>
            <div className="c2-big">{tn('clan2.exit.endsIn', { t: fmtLeft(b.endsAt - now) })}</div>
            <div className="c2-fx on">
              <span>{tn('clan2.exit.effectCoins')}</span>
              <span>{tn('clan2.exit.effectMeters')}</span>
            </div>
            <div className="c2-chip accent">{tn('clan2.exit.bonusSoFar', { n: b.lastBonus })}</div>
            <Going list={going} />
            {isMember && !imIn && (
              <>
                <p className="c2-muted">{tn('clan2.exit.notIn')}</p>
                <button className="btn-primary" onClick={() => act(rsvpBuff(true), 'rsvpOn')}>
                  {tn('clan2.exit.imIn')}
                </button>
              </>
            )}
          </>
        )}

        {b.phase === 'cooldown' && b.cooldownUntil !== null && (
          <>
            <div className="c2-big">{tn('clan2.exit.cooldownTitle')}</div>
            <p className="c2-muted">{tn('clan2.exit.nextIn', { t: fmtLeft(b.cooldownUntil - now) })}</p>
            {b.lastBonus > 0 && <div className="c2-chip accent">{tn('clan2.exit.lastBonus', { n: b.lastBonus })}</div>}
          </>
        )}
      </C2Card>
    </div>
  )
}

function Going({ list }: { list: { id: string; name: string; hue: number }[] }) {
  return (
    <div className="c2-going">
      <div className="c2-label">{tn('clan2.exit.who')}</div>
      {list.length === 0 ? (
        <p className="c2-muted">{tn('clan2.exit.nobody')}</p>
      ) : (
        <div className="c2-going-list">
          {list.map((m) => (
            <span key={m.id} className="c2-going-one">
              <C2Avatar member={m} size={30} />
              <small>{m.name}</small>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

const DANGER: AlertKind[] = ['sector_attack', 'hq_siege', 'hq_fallen']
const GOOD: AlertKind[] = ['hq_saved', 'quest_done', 'project_done', 'recruit']

function AlertIcon({ kind }: { kind: AlertKind }) {
  const tone = DANGER.includes(kind) ? 'danger' : GOOD.includes(kind) ? 'good' : 'info'
  return (
    <span className={`c2-alert-ico ${tone}`} aria-hidden>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        {tone === 'danger' ? <path d="M12 8v5M12 17h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /> : tone === 'good' ? <path d="M5 12.5 10 17.5 19 7" /> : <path d="M12 11v5M12 8h.01" />}
      </svg>
    </span>
  )
}

export function AlertsCard({ onOpenSector }: { onOpenSector?: (id: string) => void }) {
  const s = useDemoState()
  const now = useDemoNow()
  const unread = s.alerts.filter((a) => !a.read).length
  const list: ClanAlert[] = s.alerts.slice(0, 10)
  return (
    <C2Card
      title={tn('clan2.alerts.title')}
      tour="alerts"
      right={
        unread > 0 ? (
          <button className="c2-link" onClick={() => markAlertsRead()}>
            {tn('clan2.alerts.markRead')}
          </button>
        ) : undefined
      }
    >
      {list.length === 0 ? (
        <p className="c2-muted">{tn('clan2.alerts.empty')}</p>
      ) : (
        <ul className="c2-alerts">
          {list.map((a) => (
            <li key={a.id} className={a.read ? undefined : 'unread'}>
              <AlertIcon kind={a.kind} />
              <div className="c2-alert-main">
                <div>{alertText(a)}</div>
                <div className="c2-muted small">{fmtAgo(now - a.at)}</div>
              </div>
              {a.sectorId && onOpenSector && (a.kind === 'sector_attack' || a.kind === 'hq_siege') && (
                <button className="c2-link" onClick={() => onOpenSector(a.sectorId as string)}>
                  {tn('clan2.alerts.route')}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </C2Card>
  )
}

