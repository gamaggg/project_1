'use client'

import { thumbUrl } from '@/lib/supabase/imageUrl'
import { useClanRace } from '@/lib/supabase/queries'
import { BackButton } from '@/components/app-shell/BackButton'
import { ClanCrest } from '@/components/app-shell/ClanCrest'
import { ChallengeCountdown } from '@/components/app-shell/ChallengeCountdown'
import { RaceRiver, RaceRulesCard, formatMeters, raceHeadline, raceProgress } from '@/components/app-shell/ClanRace'
import type { CityId } from '@/lib/data/city'

function finishTime(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
}

// Full regatta: the whole city's river, the viewer's own day and clan crew,
// the standings and last week's podium. One RPC (get_clan_race), refetched
// when the screen is opened again after a minute (staleTime).
export function ClanRaceScreen({
  city,
  onBack,
  onOpenClan,
  onOpenUser,
  onOpenClans,
}: {
  city: CityId
  onBack: () => void
  onOpenClan: (id: number) => void
  onOpenUser: (id: string) => void
  onOpenClans: () => void
}) {
  const { data: race, isLoading } = useClanRace(city, true)
  const mine = race?.clans.find((c) => c.id === race.myClanId) ?? null
  const todayPct = race ? Math.min(1, race.myToday / Math.max(1, race.dailyCap)) : 0
  const maxRower = Math.max(1, ...(race?.myRowers.map((r) => r.meters) ?? []))

  return (
    <>
      <div className="header-row">
        <BackButton onClick={onBack} registerNative={false} />
        <div style={{ fontWeight: 800, fontSize: 15 }}>Битва кланов</div>
        <div style={{ width: 36 }} />
      </div>
      <div className="screen-inner race-screen">
        {isLoading || !race ? (
          <div className="clan-soon">{isLoading ? 'Загрузка…' : 'Нет данных'}</div>
        ) : (
          <>
            <div className="race-card race-hero">
              <div className="race-card-head">
                <div>
                  <div className="race-kicker">Эта неделя</div>
                  <div className="race-hero-title">{mine ? raceHeadline(mine, race) : 'Кто первым доплывёт?'}</div>
                </div>
                <ChallengeCountdown endsAt={race.weekEnd} />
              </div>
              <p className="race-hero-sub">Лови и захватывай — лодка твоего клана плывёт вперёд. Все кланы города в одной битве.</p>
              <RaceRiver clans={race.clans} highlightId={race.myClanId} onOpenClan={onOpenClan} />
            </div>

            {mine ? (
              <div className="race-today">
                <div className="race-today-ring">
                  <svg viewBox="0 0 44 44" width="56" height="56" aria-hidden>
                    <circle cx="22" cy="22" r="18" fill="none" stroke="#E9EEF1" strokeWidth="5" />
                    {todayPct > 0 && (
                      <circle className="race-today-arc" cx="22" cy="22" r="18" fill="none" stroke="#1E8FB5" strokeWidth="5" strokeLinecap="round" pathLength={100} strokeDasharray={`${todayPct * 100} 100`} />
                    )}
                  </svg>
                  <span>{race.myToday}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="race-today-title">
                    Сегодня ты принёс <b>{race.myToday} м</b> из {race.dailyCap}
                  </div>
                  <div className="race-today-sub">
                    {race.myToday >= race.dailyCap
                      ? 'Лимит на сегодня выбран — завтра лодка снова ждёт твоих вёсел'
                      : race.myToday === 0
                        ? 'Один улов — и лодка клана проплывёт 10 м'
                        : `Ещё ${race.dailyCap - race.myToday} м сегодня пойдут в зачёт`}
                  </div>
                </div>
              </div>
            ) : (
              <div className="race-join">
                <div style={{ flex: 1 }}>
                  <div className="race-today-title">Ты пока не в клане</div>
                  <div className="race-today-sub">Вступи в клан своего города — и твои уловы начнут двигать его лодку</div>
                </div>
                <button className="clan-mini-btn ok" onClick={onOpenClans}>
                  Кланы
                </button>
              </div>
            )}

            {race.clans.length > 0 && (
              <div className="clan-card">
                <div className="clan-card-title">Таблица битвы кланов</div>
                {race.clans.map((c, i) => (
                  <button key={c.id} className={`race-standing${c.id === race.myClanId ? ' mine' : ''}`} style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }} onClick={() => onOpenClan(c.id)}>
                    <span className="clan-list-rank">{c.rank}</span>
                    <ClanCrest crest={c.crest} size={34} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="clan-list-name">{c.name}</span>
                      <span className="race-standing-bar">
                        <span className="race-standing-fill" style={{ transform: `scaleX(${raceProgress(c)})` }} />
                      </span>
                    </span>
                    <span className="race-standing-meters">
                      {c.finishedAt ? (
                        <>
                          <span className="race-finished-chip">Финиш</span>
                          <span>{finishTime(c.finishedAt)}</span>
                        </>
                      ) : (
                        <>
                          <b>{formatMeters(c.meters)}</b>
                          <span>из {formatMeters(c.finish)}</span>
                        </>
                      )}
                    </span>
                  </button>
                ))}
                {race.clans.length === 1 && <div className="race-solo-note">Соперников пока нет — плывите наперегонки с финишем, награда за него всё равно ваша</div>}
              </div>
            )}

            {mine && (
              <div className="clan-card">
                <div className="clan-card-title">Гребцы клана за неделю</div>
                {race.myRowers.length === 0 ? (
                  <div className="clan-empty" style={{ padding: '14px 0' }}>
                    Пока никто не грёб — начни первым
                  </div>
                ) : (
                  race.myRowers.map((r, i) => (
                    <button key={r.userId} className="clan-member-row race-rower" style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }} onClick={() => onOpenUser(r.userId)}>
                      <span className="avatar clan-member-avatar">
                        {r.avatarUrl ? <img src={thumbUrl(r.avatarUrl, 96)} alt="" loading="lazy" decoding="async" /> : r.displayName.slice(0, 1).toUpperCase()}
                      </span>
                      <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                        <span className="clan-member-name">{r.displayName}</span>
                        <span className="clan-contrib-bar" style={{ display: 'block' }}>
                          <span className="race-rower-fill" style={{ transform: `scaleX(${r.meters / maxRower})` }} />
                        </span>
                      </span>
                      <span className="clan-member-stats">
                        <b>{r.meters}</b>
                        <span>м</span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}

            {race.lastWeek.length > 0 && (
              <div className="clan-card">
                <div className="clan-card-title">Прошлая неделя</div>
                <div className="clan-podium" style={{ marginTop: 22 }}>
                  {[race.lastWeek.find((c) => c.place === 2), race.lastWeek.find((c) => c.place === 1), race.lastWeek.find((c) => c.place === 3)].map((c, i) =>
                    c ? (
                      <button key={c.id} className={`clan-podium-item${i === 1 ? ' first' : ''}`} onClick={() => onOpenClan(c.id)}>
                        <ClanCrest crest={c.crest} size={i === 1 ? 64 : 48} shine={i === 1} />
                        <span className="clan-podium-place">{c.place}</span>
                        <span className="clan-podium-name">{c.name}</span>
                        <span className="clan-podium-trophies">{c.finished ? 'доплыли' : `${Math.floor((c.meters / Math.max(1, c.finish)) * 100)}% пути`}</span>
                      </button>
                    ) : (
                      <div key={`empty-${i}`} className="clan-podium-item" aria-hidden />
                    )
                  )}
                </div>
              </div>
            )}

            <RaceRulesCard />
          </>
        )}
      </div>
    </>
  )
}
