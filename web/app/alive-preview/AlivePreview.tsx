'use client'

import { useEffect, useState } from 'react'
import type { Catch, Territory } from '@/lib/data/types'
import { territoryFromRow } from '@/lib/data/territoryMerge'
import { SECTOR_GEOMETRY_VERSION } from '@/lib/data/sectorGeometryVersion'
import { DEFAULT_TERRITORY_COLOR, OTHER_TERRITORY_COLOR } from '@/lib/data/territoryColors'
import { AVATAR_FRAMES } from '@/lib/data/shopItems'
import { TerritoryThumbnailMapView } from '@/components/app-shell/TerritoryThumbnailMapView'
import { LegendRace } from '@/components/app-shell/SectorInsights'
import { DefenseShields } from '@/components/app-shell/SectorDefense'
import { CountUp, LiveCoinBalance } from '@/components/app-shell/CoinCountUp'
import { CoinIcon } from '@/components/app-shell/CoinIcon'
import { AvatarFrameRing } from '@/components/app-shell/AvatarFrameRing'
import { SlotSymbol } from '@/components/app-shell/SlotSymbol'
import { FishingCalendar, HourChart, type Day } from '@/components/app-shell/Diary'
import { SwipeSectorRow } from '@/components/app-shell/ProfileSectors'
import { RouteModal } from '@/components/app-shell/RouteModal'
import { PullIndicator, pullShift, usePullToRefresh } from '@/components/app-shell/PullToRefresh'
import { useNow } from '@/lib/useNow'

// Batumi's real sectors, with made-up holders and numbers: the same
// components and styles the app uses, so what plays here is what plays there.
type Sector = { id: string; kind: Territory['kind']; lat: number; lng: number; corners: [number, number][] }
const IDS = ['B1126', 'B1173', 'B1174', 'B0783', 'B2672']

function held(t: Territory, i: number): Territory {
  return {
    ...t,
    status: i === 0 ? 'mine' : 'other',
    ownerId: i === 0 ? 'me' : `rival-${i}`,
    ownerDisplayName: i === 0 ? 'Ты' : 'Сосед',
    ownerColor: i === 0 ? null : OTHER_TERRITORY_COLOR,
    catchCount: [39, 257, 21, 7, 4][i] ?? 3,
    lastCatchAt: new Date(Date.now() - i * 86_400_000).toISOString(),
    defense: [1, 3, 0, 2, 0][i] ?? 0,
    shieldUntil: i === 1 ? new Date(Date.now() + 5 * 3_600_000).toISOString() : null,
    hotUntil: i === 2 ? new Date(Date.now() + 2 * 86_400_000).toISOString() : null,
  }
}

const pad2 = (n: number) => String(n).padStart(2, '0')
const dayKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

// Twelve weeks of made-up fishing days for the calendar, newest first.
function fakeDays(now: number): Day[] {
  const out: Day[] = []
  const today = new Date(now)
  for (let i = 0; i < 84; i++) {
    const n = (i * 7) % 5 < 2 ? (i % 5) : i % 11 === 0 ? -1 : 0
    if (n === 0) continue
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)
    const count = n < 0 ? 0 : [1, 2, 4, 7, 3][n % 5]
    out.push({ day: dayKey(d), catches: Array.from({ length: count }, () => ({}) as Catch), gallery: [], note: null, hasEntry: true, places: [] })
  }
  return out
}
const HOURS = [0, 0, 0, 0, 1, 3, 6, 5, 3, 2, 1, 0, 0, 1, 2, 2, 3, 4, 6, 9, 11, 10, 6, 1]
const PERIODS = [
  { label: 'Всё время', nums: [20, 93, 19, 32] },
  { label: '7 дней', nums: [3, 11, 5, 4] },
  { label: '30 дней', nums: [9, 38, 12, 14] },
]
const DIARY_LABELS = ['рыбалок', 'уловов', 'видов', 'места']

const REPLAY_BTN: React.CSSProperties = { width: 'auto', flex: '0 0 auto', display: 'inline-flex', flexDirection: 'row', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', padding: '8px 14px', fontSize: 13 }

function Section({ title, about, onReplay, children }: { title: string; about: string; onReplay?: () => void; children: React.ReactNode }) {
  return (
    <section style={{ margin: '0 0 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, margin: '0 0 4px' }}>
        <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>{title}</h2>
        {onReplay && (
          <button className="btn-secondary tap-scale" style={REPLAY_BTN} onClick={onReplay}>
            ↻ Повторить
          </button>
        )}
      </div>
      <p style={{ fontSize: 12.5, lineHeight: 1.45, color: 'var(--ink-soft)', margin: '0 0 10px' }}>{about}</p>
      {children}
    </section>
  )
}

export function AlivePreview() {
  const now = useNow(3_600_000)
  const [sectors, setSectors] = useState<Territory[]>([])
  // Bumped by a section's «Повторить»: the key that remounts it, so its
  // animations start over; «Повторить всё» bumps every one.
  const [runs, setRuns] = useState<Record<string, number>>({})
  const replay = (id: string) => setRuns((r) => ({ ...r, [id]: (r[id] ?? 0) + 1 }))
  const replayAll = () => setRuns((r) => Object.fromEntries(['map', 'standing', 'profile', 'shop', 'diary', 'list', 'feed'].map((k) => [k, (r[k] ?? 0) + 1])))
  const k = (id: string) => `${id}-${runs[id] ?? 0}`

  const [coins, setCoins] = useState(1077)
  const [worn, setWorn] = useState('frame_aurora')
  const [period, setPeriod] = useState(0)
  const [diaryTab, setDiaryTab] = useState(1)
  const [swiped, setSwiped] = useState<string | null>(null)
  const [routeTo, setRouteTo] = useState<Territory | null>(null)
  const [note, setNote] = useState('')

  useEffect(() => {
    fetch(`/data/sectors-B.${SECTOR_GEOMETRY_VERSION}.json`)
      .then((r) => r.json())
      .then((d: { sectors: Sector[] }) => {
        const list = IDS.map((id) => d.sectors.find((s) => s.id === id)).filter((s): s is Sector => !!s)
        setSectors(list.map((s, i) => held(territoryFromRow(undefined, s.id, s.kind, s.lat, s.lng, s.corners, undefined), i)))
      })
  }, [])

  const days = fakeDays(now)
  const sector = sectors[0]

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', overflowY: 'auto', height: '100dvh' }}>
      <div style={{ maxWidth: 420, margin: '0 auto', padding: '18px 16px 60px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Живые экраны</h1>
          <button className="btn-primary tap-scale" style={REPLAY_BTN} onClick={replayAll}>
            ↻ Повторить всё
          </button>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.45, margin: '6px 0 22px' }}>
          Страница только для разработки: те же компоненты и стили, что в приложении, на настоящих секторах Батуми, но с выдуманными владельцами и числами. Ничего не сохраняется.
        </p>

        <Section title="1. Сектор: карта прилетает" about="Карта отъезжает на место, контур сектора обводится цветом владельца, заливка вспыхивает, номер и аватар появляются после." onReplay={() => replay('map')}>
          <div className="sector-hero-map" style={{ borderRadius: 18, overflow: 'hidden' }}>
            {sector ? (
              <TerritoryThumbnailMapView key={k('map')} territory={sector} myTerritoryColor={DEFAULT_TERRITORY_COLOR} ownerInitials="ТЫ" claimFx />
            ) : (
              <div style={{ height: 230, background: '#DCE7E9' }} />
            )}
          </div>
        </Section>

        <Section title="2. Сектор: легенда, трофей, защита" about="Полоска «твои уловы против легенды» растёт (сверху 4 из 13, снизу легенды нет — 0 из 10), щиты появляются по одному, по фото трофея проходит блик, число уловов отсчитывается." onReplay={() => replay('standing')}>
          <div key={k('standing')} className="sector-dock-card" style={{ margin: 0 }}>
            <div className="sector-standing">
              <div className="standing-col standing-col-legend">
                <span className="standing-head">Легенда сектора</span>
                <span className="standing-main">
                  <span className="standing-avatar">RU</span>
                  <b>Ruslan</b>
                </span>
                <span className="standing-hint">
                  <span className="standing-legend-count">13 уловов за 90 дней</span>
                  <br />У тебя здесь 4 улова
                </span>
                <LegendRace mine={4} of={13} />
              </div>
              <div className="standing-col standing-col-trophy">
                <span className="standing-head">Трофей сектора</span>
                <span className="standing-main">
                  <span className="standing-trophy-photo" style={{ background: '#E8F1F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <SlotSymbol symbol="lufar" city="batumi" size={22} />
                  </span>
                  <b>Луфарь</b>
                </span>
                <span className="standing-hint">
                  <span className="standing-trophy-size">48 см · 1,6 кг</span>
                  <br />Это ты · 9 окт.
                </span>
              </div>
              <div className="standing-wide">
                <div className="standing-col standing-col-defense">
                  <span className="standing-head">Защита</span>
                  <span className="standing-main">
                    <DefenseShields value={2} size={20} />
                    <b>2 из 3</b>
                  </span>
                  <span className="standing-hint">Твой улов здесь — +1 к защите</span>
                </div>
              </div>
            </div>
            <div className="sector-standing solo" style={{ marginTop: 10 }}>
              <div className="standing-col standing-col-legend empty">
                <span className="standing-head">Легенда сектора</span>
                <span className="standing-main">
                  <b>0 из 10</b>
                </span>
                <span className="standing-hint">Нужно 10 уловов за 90 дней</span>
                <LegendRace mine={0} of={10} />
              </div>
            </div>
            <div className="sector-stat-strip" style={{ marginTop: 12 }}>
              <div>
                <div className="value">
                  <CountUp value={39} />
                </div>
                <div className="label">уловов</div>
              </div>
              <div>
                <div className="value">Море</div>
                <div className="label">тип</div>
              </div>
            </div>
          </div>
        </Section>

        <Section title="3. Профиль: цифры" about="Цифры отсчитываются от нуля, плашки поднимаются лесенкой (в приложении — при каждом заходе на вкладку). Баланс перещёлкивается — нажми «+100» или «−300»." onReplay={() => replay('profile')}>
          <div id="screen-profile" className="active">
            <div key={k('profile')} className="hero-stat-grid">
              {[
                [18, 'секторов'],
                [93, 'улова'],
                [19, 'видов рыб'],
                [43, 'подписчика'],
              ].map(([n, label]) => (
                <button key={label} className="hero-stat">
                  <b>
                    <CountUp value={n as number} />
                  </b>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
            <span className="coin-pill" style={{ background: '#17181B', color: '#fff' }}>
              <CoinIcon size={16} className="coin-pill-icon" />
              <LiveCoinBalance value={coins} />
            </span>
            <button className="btn-secondary tap-scale" style={{ width: 'auto', padding: '7px 12px', fontSize: 13 }} onClick={() => setCoins((c) => c + 100)}>
              +100
            </button>
            <button className="btn-secondary tap-scale" style={{ width: 'auto', padding: '7px 12px', fontSize: 13 }} onClick={() => setCoins((c) => Math.max(0, c - 300))}>
              −300
            </button>
          </div>
        </Section>

        <Section title="4. Магазин" about="Карточки раскладываются, у эпической блик, у легендарной и джекпотной вращается рамка. «Надеть» — вещь подпрыгивает. «Купить» — над балансом всплывает «−N», монета переворачивается. Барабаны слотов крутятся раз в несколько секунд." onReplay={() => replay('shop')}>
          <ShopDemo key={k('shop')} coins={coins} onSpend={(n) => setCoins((c) => Math.max(0, c - n))} worn={worn} onWear={setWorn} />
        </Section>

        <Section title="5. Дневник" about="Переключатели плавно переезжают, цифры перетекают. Нажми «Лучшее время» — откроется график по часам: веди по нему пальцем (или мышью с зажатой кнопкой) или просто нажми на час. Нажми на цветной день в календаре — прокрутит к записи ниже и подсветит её." onReplay={() => replay('diary')}>
          <div className="diary-tabs" role="tablist" style={{ '--i': diaryTab } as React.CSSProperties}>
            {['Уловы', 'Дневник'].map((label, i) => (
              <button key={label} role="tab" aria-selected={diaryTab === i} className={diaryTab === i ? 'on' : undefined} onClick={() => setDiaryTab(i)}>
                {label}
              </button>
            ))}
          </div>
          <DiaryDemo key={k('diary')} period={period} onPeriod={setPeriod} days={days} now={now} />
        </Section>

        <Section title="6. Сектора: смахни строку влево" about="Сзади «Маршрут» (окно выбора карт) и «На карте». Нажатие на открытую строку закрывает её. Первая строка при появлении сама сдвигается, подсказывая жест." onReplay={() => replay('list')}>
          <div key={k('list')} className="card sector-list swipe-hint-on" style={{ overflow: 'hidden' }}>
            {sectors.map((t, i) => (
              <SwipeSectorRow
                key={t.id}
                t={t}
                last={i === sectors.length - 1}
                open={swiped === t.id}
                onSwipe={setSwiped}
                onOpen={(id) => setNote(`Открылся бы экран сектора ${id}`)}
                onRoute={setRouteTo}
                onShowOnMap={(id) => setNote(`Карта показала бы сектор ${id}`)}
                style={{ animationDelay: `${i * 28}ms` }}
              />
            ))}
          </div>
          {note && <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--ink-soft)' }}>{note}</div>}
          {routeTo && <RouteModal lat={routeTo.lat} lng={routeTo.lng} onClose={() => setRouteTo(null)} />}
        </Section>

        <Section title="7. Активность: потяни вниз" about="Потяни ленту вниз от самого верха (пальцем, или мышью с зажатой кнопкой): лента съезжает, на леске опускается крючок, у порога он выпрямляется и загорается оранжевым, отпусти — покачивается, пока лента «обновляется». Записи раскладываются лесенкой." onReplay={() => replay('feed')}>
          <FeedDemo key={k('feed')} />
        </Section>
      </div>
    </div>
  )
}

const SHOP_CARDS = [
  { id: 'frame_silver', name: 'Серебряная рамка', price: 150, tier: 'shop-card-common' },
  { id: 'frame_platinum', name: 'Платиновая рамка', price: 600, tier: 'shop-card-epic' },
  { id: 'frame_aurora', name: 'Рамка «Северное сияние»', price: 800, tier: 'shop-card-legendary' },
  { id: 'frame_katran', name: 'Рамка «Катран»', price: 0, tier: 'shop-card-jackpot' },
]

function ShopDemo({ coins, onSpend, worn, onWear }: { coins: number; onSpend: (n: number) => void; worn: string; onWear: (id: string) => void }) {
  // Same delta as ShopScreen: the last change to the balance floats off it.
  const [prev, setPrev] = useState(coins)
  const [delta, setDelta] = useState<{ n: number; amount: number } | null>(null)
  if (coins !== prev) {
    setPrev(coins)
    setDelta({ n: (delta?.n ?? 0) + 1, amount: coins - prev })
  }
  return (
    <>
      <div className="shop-wallet">
        <div className="shop-wallet-balance">
          <span key={delta?.n ?? 0} className={`shop-wallet-coin${delta ? ' flip' : ''}`}>
            <CoinIcon size={28} />
          </span>
          <span className="shop-wallet-num">
            <LiveCoinBalance value={coins} />
            {delta && (
              <span key={delta.n} className={`shop-wallet-delta${delta.amount < 0 ? ' minus' : ''}`}>
                {delta.amount < 0 ? '−' : '+'}
                {Math.abs(delta.amount)}
              </span>
            )}
          </span>
          <span className="shop-wallet-label">монет на счету</span>
        </div>
        <div className="slots-card" style={{ cursor: 'default' }}>
          <span className="slots-card-shine" aria-hidden />
          <span className="slots-card-reels" aria-hidden>
            {(['katran', 'hook', 'hex'] as const).map((s) => (
              <span key={s} className="slots-card-reel">
                <SlotSymbol symbol={s} city="batumi" size={22} />
              </span>
            ))}
          </span>
          <span className="slots-card-text">
            <span className="slots-card-title">Рыбацкие слоты</span>
            <span className="slots-card-sub">Прокрутов: 2</span>
          </span>
        </div>
      </div>
      <div className="shop-grid">
        {SHOP_CARDS.map((c) => (
          <div key={c.id} className={`shop-card ${c.tier}`} data-tag={c.price === 0 ? 'Джекпот' : undefined}>
            <div className="shop-card-preview">
              <div className="shop-card-avatar">
                <AvatarFrameRing frame={AVATAR_FRAMES.find((f) => f.id === c.id)} />
                <div className="shop-card-avatar-inner">ТЫ</div>
              </div>
            </div>
            <div className="shop-card-name">{c.name}</div>
            {worn === c.id ? (
              <button className="btn-secondary shop-equipped">Снять</button>
            ) : (
              <button className="btn-primary" onClick={() => onWear(c.id)}>
                Надеть
              </button>
            )}
            {c.price > 0 && (
              <button className="section-link" onClick={() => onSpend(c.price)}>
                Купить за {c.price}
              </button>
            )}
          </div>
        ))}
      </div>
    </>
  )
}

function DiaryDemo({ period, onPeriod, days, now }: { period: number; onPeriod: (i: number) => void; days: Day[]; now: number }) {
  const [dialOpen, setDialOpen] = useState(false)
  const fmt = new Intl.DateTimeFormat('ru', { weekday: 'long', day: 'numeric', month: 'long' })
  return (
    <>
      <div className="diary-stats">
        <div className="diary-stats-periods" role="tablist" style={{ '--i': period } as React.CSSProperties}>
          {PERIODS.map((p, i) => (
            <button key={p.label} type="button" role="tab" aria-selected={period === i} className={period === i ? 'on' : undefined} onClick={() => onPeriod(i)}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="diary-stats-nums">
          {PERIODS[period].nums.map((n, i) => (
            <button key={i} type="button" className="tap-scale">
              <b>
                <CountUp value={n} />
              </b>
              <span>{DIARY_LABELS[i]}</span>
            </button>
          ))}
        </div>
        <div className="diary-stats-lines">
          <button type="button" className={`diary-stats-line tap-scale${dialOpen ? ' open' : ''}`} onClick={() => setDialOpen(!dialOpen)}>
            <span className="diary-stats-icon" aria-hidden>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
            </span>
            <span className="diary-stats-label">Лучшее время</span>
            <b>19:00–22:00</b>
            <svg className="diary-stats-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {dialOpen && <HourChart hours={HOURS} best={19} />}
        </div>
        <FishingCalendar days={days} now={now} />
      </div>
      {days.slice(0, 4).map((d) => (
        <section key={d.day} id={`diary-day-${d.day}`} className="diary-day">
          <b style={{ fontSize: 14 }}>{fmt.format(new Date(`${d.day}T12:00:00`))}</b>
          <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 4 }}>
            {d.catches.length ? `${d.catches.length} ${d.catches.length === 1 ? 'улов' : d.catches.length < 5 ? 'улова' : 'уловов'}` : 'Рыбалка без улова'}
          </div>
        </section>
      ))}
    </>
  )
}

const FEED = [
  { title: 'Выполнен челлендж: Картограф', coins: '+20 монет', when: 'Сегодня · 12:43' },
  { title: 'Клан «BFC» в битве — ты в составе', coins: null, when: 'Сегодня · 10:00' },
  { title: 'Выполнен челлендж: Анкета рыбака', coins: '+20 монет', when: 'Сегодня · 09:32' },
  { title: 'Все челленджи недели выполнены', coins: '+150 монет за неделю', when: 'Вчера · 21:10' },
  { title: 'Ruslan поймал Луфаря в B1173', coins: null, when: 'Вчера · 19:05' },
]

function FeedDemo() {
  const [round, setRound] = useState(0)
  // A pretend refresh: a second on the water, then the feed deals in again.
  const { ref, pull, dragging, refreshing } = usePullToRefresh(() => new Promise((r) => setTimeout(r, 1000)).then(() => setRound((n) => n + 1)))
  return (
    <div style={{ position: 'relative', height: 420, borderRadius: 22, overflow: 'hidden', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--line)' }}>
      <div className="screen active" style={{ paddingTop: 0 }}>
        <div className="screen-inner" ref={ref} style={pullShift(pull, dragging)}>
          <PullIndicator pull={pull} refreshing={refreshing} />
          <div className="page-title">Активность</div>
          <div className="page-sub">Тяни вниз отсюда</div>
          <div key={round} className="activity-list">
            {FEED.map((f) => (
              <div key={f.title} className="activity-item">
                <span style={{ width: 40, height: 40, borderRadius: 12, background: '#FFE9D6', flex: '0 0 auto' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.35 }}>{f.title}</div>
                  {f.coins && <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2 }}>{f.coins}</div>}
                  <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 6 }}>{f.when}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
