'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useClanList, useProfile, useMyClanInvites, useClanEligibility } from '@/lib/supabase/queries'
import { BackButton } from '@/components/app-shell/BackButton'
import { ClanCrest } from '@/components/app-shell/ClanCrest'
import { CITIES, type CityId } from '@/lib/data/city'
import { CLAN_PRICE, JOIN_TYPE_LABEL, leagueFor } from '@/lib/data/clanLevels'

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

// Every clan of the player's city: their own clan and pending invites on
// top, then the create card, then the rest ranked by trophies.
export function ClanListScreen({
  city,
  onBack,
  onOpenClan,
  onCreate,
}: {
  city: CityId
  onBack: () => void
  onOpenClan: (id: number) => void
  onCreate: () => void
}) {
  const { user } = useAuth()
  const { data: me } = useProfile(user?.id ?? null)
  const [query, setQuery] = useState('')
  const debounced = useDebounced(query, 300)
  const { data: clans = [], isLoading } = useClanList(city, debounced)
  const { data: invites = [] } = useMyClanInvites(true)
  const inClan = !!me?.clanId
  const { data: eligibility } = useClanEligibility(!inClan)

  const sectorsOk = !!eligibility && eligibility.sectors >= eligibility.sectorsNeeded
  const coinsOk = !!eligibility && eligibility.coins >= CLAN_PRICE

  return (
    <>
      <div className="header-row">
        <BackButton onClick={onBack} registerNative={false} />
        <div style={{ fontWeight: 800, fontSize: 15 }}>Кланы · {CITIES[city].name}</div>
        <div style={{ width: 36 }} />
      </div>
      <div className="screen-inner">
        <div className="clan-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Название или ID клана" />
        </div>

        {inClan && me?.clanId && (
          <button className="clan-mine tap-scale" onClick={() => onOpenClan(me.clanId!)}>
            <ClanCrest crest={me.clanCrest} size={48} />
            <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
              <span className="clan-mine-kicker">Твой клан</span>
              <span className="clan-mine-name">{me.clanName}</span>
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        )}

        {!inClan && invites.length > 0 && (
          <div className="clan-card" style={{ marginTop: 12 }}>
            <div className="clan-card-title">Приглашения · {invites.length}</div>
            {invites.map((inv) => (
              <button key={inv.clanId} className="clan-list-row tap-scale" onClick={() => onOpenClan(inv.clanId)}>
                <ClanCrest crest={inv.crest} size={40} />
                <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <span className="clan-list-name">{inv.name}</span>
                  <span className="clan-list-meta">Зовёт {inv.invitedByName ?? 'участник клана'}</span>
                </span>
                <span className="clan-mini-btn ok">Открыть</span>
              </button>
            ))}
          </div>
        )}

        {!inClan && (
          <div className="clan-create-card">
            <div className="clan-create-kicker">Свой клан</div>
            <div className="clan-create-title">Собери команду, выбери герб и побеждай в битве кланов</div>
            <div className="clan-create-reqs">
              <span className={`clan-create-req${sectorsOk ? ' ok' : ''}`}>
                {sectorsOk ? '✓ 3+ сектора захвачено' : `✕ Сектора: ${eligibility?.sectors ?? '…'} из ${eligibility?.sectorsNeeded ?? 3}`}
              </span>
              <span className={`clan-create-req${coinsOk ? ' ok' : ''}`}>
                {coinsOk ? `✓ ${CLAN_PRICE} монет есть` : `✕ Монеты: ${eligibility?.coins ?? '…'} из ${CLAN_PRICE}`}
              </span>
            </div>
            <button className="btn-primary" style={{ marginTop: 14 }} onClick={onCreate}>
              {sectorsOk && coinsOk ? 'Создать клан' : 'Посмотреть конструктор'}
            </button>
          </div>
        )}

        <div className="section-title-row" style={{ marginTop: 22 }}>
          <div className="section-title">{debounced ? 'Найдено' : 'Все кланы'}</div>
        </div>
        {isLoading ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5 }}>Загрузка…</div>
        ) : clans.length === 0 ? (
          <div className="clan-empty">
            {debounced ? 'Клана с таким названием или ID нет' : 'В городе пока нет ни одного клана — стань первым'}
          </div>
        ) : (
          <div className="clan-card">
            {clans.map((c, i) => {
              const league = leagueFor(c.trophies)
              return (
                <button key={c.id} className="clan-list-row tap-scale" style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }} onClick={() => onOpenClan(c.id)}>
                  <span className="clan-list-rank">{i + 1}</span>
                  <ClanCrest crest={c.crest} size={44} />
                  <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <span className="clan-list-name">{c.name}</span>
                    <span className="clan-list-meta">
                      ID {c.id} · {c.members}/{c.capacity} · {JOIN_TYPE_LABEL[c.joinType]}
                      {c.minSectors > 0 ? ` · от ${c.minSectors} сект.` : ''}
                    </span>
                  </span>
                  <span className="clan-list-trophies">
                    <span>
                      <span className="clan-league-dot" style={{ background: league.color }} /> {c.trophies}
                    </span>
                    <span className="clan-list-league">{league.label}</span>
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
