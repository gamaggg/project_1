'use client'

import { CoinIcon } from '@/components/app-shell/CoinIcon'
import { C2Avatar, C2Card, C2Coins } from '@/components/clan2/C2Common'
import { inClan, meOf, useDemoState } from '@/lib/clan2/demoStore'
import { tn } from '@/lib/i18n/runtime'

// The profile of the preview: the player's wallet, what the update changed in
// plain words (the personal Kazna and the personal double coins are gone),
// the player's part in the treasury and the daily reward that stays.

export function ProfileTab() {
  const s = useDemoState()
  const me = meOf(s)
  const player = me ?? { name: 'Саша', hue: 200 }
  const ranked = [...s.members].sort((a, b) => b.weekDeposit - a.weekDeposit)
  const place = me ? ranked.findIndex((m) => m.id === me.id) + 1 : 0
  const patron = !!me && ranked[0]?.id === me.id && me.weekDeposit > 0

  return (
    <div className="c2-pad c2-stack">
      <C2Card>
        <div className="c2-me">
          <C2Avatar member={player} size={56} />
          <div>
            <div className="c2-me-name">{player.name}</div>
            <div className="c2-muted small">{tn('clan2.profile.wallet')}</div>
            <C2Coins n={s.wallet} className="c2-me-coins" />
          </div>
        </div>
        {!inClan(s) && <p className="c2-hint" style={{ marginTop: 12 }}>{tn('clan2.profile.noClan')}</p>}
      </C2Card>

      <C2Card title={tn('clan2.profile.changedTitle')} tour="profile-changed">
        <ul className="c2-changes">
          {(['c1', 'c2', 'c3', 'c4'] as const).map((k, i) => (
            <li key={k} className={i < 2 ? 'gone' : i === 2 ? 'stays' : 'new'}>
              <strong>{tn(`clan2.profile.${k}t`)}</strong>
              <span>{tn(`clan2.profile.${k}d`)}</span>
            </li>
          ))}
        </ul>
      </C2Card>

      {inClan(s) && me && (
        <C2Card title={tn('clan2.profile.myPart')}>
          <div className="c2-me-part">
            <C2Coins n={me.weekDeposit} />
            <span className="c2-muted small">{tn('clan2.profile.myPartWeek')}</span>
          </div>
          {place > 0 && me.weekDeposit > 0 && <p className="c2-muted small">{tn('clan2.profile.myRank', { n: place })}</p>}
          <p className={patron ? 'c2-ok' : 'c2-hint'} style={{ marginTop: 8 }}>
            {patron ? tn('clan2.profile.patronOn') : tn('clan2.profile.patronOff')}
          </p>
        </C2Card>
      )}

      <C2Card title={tn('clan2.profile.shopTitle')}>
        <div className="c2-shop-old">
          <span>{tn('clan2.profile.shopOld')}</span>
          <em>{tn('clan2.profile.shopGone')}</em>
        </div>
        <p className="c2-hint">{tn('clan2.profile.shopNew')}</p>
      </C2Card>

      <C2Card title={tn('clan2.profile.dailyTitle')}>
        <div className="c2-daily-row">
          <CoinIcon size={28} />
          <span className="c2-muted">{tn('clan2.profile.dailyText')}</span>
        </div>
      </C2Card>
    </div>
  )
}
