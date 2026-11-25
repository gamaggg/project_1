'use client'

import { useEffect, useState } from 'react'
import '@/app/clan2.css'
import type { Territory } from '@/lib/data/types'
import { territoryFromRow, withCorners, type SectorGeometryFileOnDisk } from '@/lib/data/territoryMerge'
import { SECTOR_GEOMETRY_VERSION } from '@/lib/data/sectorGeometryVersion'
import { DEFAULT_TERRITORY_COLOR, OTHER_TERRITORY_COLOR } from '@/lib/data/territoryColors'
import { AVATAR_FRAMES } from '@/lib/data/shopItems'
import { NAME_STYLES } from '@/lib/data/nameStyles'
import { TERRITORY_SKINS } from '@/lib/data/territorySkins'
import { HERO_BACKGROUNDS } from '@/lib/data/heroBackgrounds'
import { TerritoryThumbnailMapView } from '@/components/app-shell/TerritoryThumbnailMapView'
import { AvatarFrameRing } from '@/components/app-shell/AvatarFrameRing'
import { HeroBgLive } from '@/components/app-shell/HeroBgLive'
import { StyledName } from '@/components/app-shell/StyledName'
import { SkinPreview } from '@/components/app-shell/SkinPreview'
import { SecretBoxArt } from '@/components/app-shell/SecretBox'
import { SecretBoxScreen, type BoxItem, type BoxResult } from '@/components/app-shell/SecretBoxScreen'
import { SectorHoldersCard } from '@/components/app-shell/SectorHoldersCard'
import { SectorBadgeInfo, type SectorBadgeKind } from '@/components/app-shell/SectorBadgeInfo'
import { SectorDefenseAside } from '@/components/app-shell/SectorDefense'
import { RouteModal } from '@/components/app-shell/RouteModal'
import { PlayersDirectory } from '@/components/app-shell/screens/PlayersDirectory'
import { CoinIcon } from '@/components/app-shell/CoinIcon'
import { statusBadge } from '@/components/app-shell/screens/TerritoryScreen'
import { SlotsCard } from '@/components/app-shell/SlotsCard'
import { EmptyPrizePlace, PodiumItem, WEEK_PRIZES } from '@/components/app-shell/screens/WeeklyLeaderboard'
import { StarsShop } from '@/components/app-shell/StarsShop'
import { GL_FAMILIES, familyName, glPresetOf } from '@/components/app-shell/glFamilies'
import { KitsSection } from '@/components/app-shell/GlShop'
import { GL_KITS } from '@/lib/data/glKits'
import { ShopClosed } from '@/components/app-shell/screens/ShopScreen'
import { tn } from '@/lib/i18n/runtime'
import { formatWeekLeft, formatWeekOfMonth } from '@/lib/format'

// The 24.11.2026 update on one page, with the app's own components and styles on Batumi's real sectors — made-up
// players and coins, and nothing is saved: buying, putting on and the box live only on this page until it reloads.
type Cat = 'avatar_frame' | 'hero_bg' | 'name_style' | 'territory_skin'
type Item = { id: string; cat: Cat; name: string; price: number; isNew: boolean }
// The whole Shop as it is in the database (24.11.2026: sold for coins, no free backgrounds or slot prizes) plus the 16
// new items — so the box here draws from the same catalogue as the real one.
const NEW_IDS = new Set(['frame_line', 'frame_coral', 'frame_scales', 'frame_storm', 'snow', 'fog', 'floats', 'sunset', 'name_sticker', 'name_neon_sign', 'name_wave', 'name_bubbles', 'skin_ice', 'skin_lilies', 'skin_bubbles', 'skin_whirlpool'])
const PRICES: [string, Cat, number][] = [
  ['frame_line', 'avatar_frame', 300], ['frame_coral', 'avatar_frame', 700], ['frame_scales', 'avatar_frame', 1100], ['frame_storm', 'avatar_frame', 1900],
  ['frame_bronze', 'avatar_frame', 150], ['frame_silver', 'avatar_frame', 250], ['frame_emerald', 'avatar_frame', 300], ['frame_sapphire', 'avatar_frame', 350],
  ['frame_gold', 'avatar_frame', 400], ['frame_platinum', 'avatar_frame', 600], ['frame_aurora', 'avatar_frame', 800], ['frame_flame', 'avatar_frame', 1000],
  ['frame_comet', 'avatar_frame', 1200], ['frame_holo', 'avatar_frame', 1500], ['frame_royal', 'avatar_frame', 2000],
  ['snow', 'hero_bg', 300], ['fog', 'hero_bg', 700], ['floats', 'hero_bg', 1100], ['sunset', 'hero_bg', 1900],
  ['aurora-light-blue', 'hero_bg', 300], ['aurora-light', 'hero_bg', 300], ['aurora-blue', 'hero_bg', 300], ['aurora-pink', 'hero_bg', 300],
  ['aurora-orange', 'hero_bg', 300], ['aurora', 'hero_bg', 300], ['waves-pink', 'hero_bg', 300], ['waves-purple', 'hero_bg', 300], ['waves-ocean', 'hero_bg', 300],
  ['aurora-light-orange', 'hero_bg', 300], ['aurora-light-pink', 'hero_bg', 300], ['waves', 'hero_bg', 300], ['halftone', 'hero_bg', 400], ['circles', 'hero_bg', 400],
  ['deepwater', 'hero_bg', 800], ['moonpath', 'hero_bg', 1000], ['school', 'hero_bg', 1500], ['golddust', 'hero_bg', 2000],
  ['name_sticker', 'name_style', 300], ['name_neon_sign', 'name_style', 700], ['name_wave', 'name_style', 1100], ['name_bubbles', 'name_style', 1800],
  ['name_fire', 'name_style', 200], ['name_ocean', 'name_style', 200], ['name_rose', 'name_style', 200], ['name_emerald', 'name_style', 200], ['name_gold', 'name_style', 200],
  ['name_neon', 'name_style', 350], ['name_aurora', 'name_style', 800], ['name_lava', 'name_style', 1000], ['name_holo', 'name_style', 1300], ['name_gold_shine', 'name_style', 1600],
  ['skin_ice', 'territory_skin', 300], ['skin_lilies', 'territory_skin', 600], ['skin_bubbles', 'territory_skin', 900], ['skin_whirlpool', 'territory_skin', 2000],
  ['skin_stripes', 'territory_skin', 300], ['skin_horizon', 'territory_skin', 300], ['skin_zigzag', 'territory_skin', 350], ['skin_diagonal', 'territory_skin', 350],
  ['skin_rain', 'territory_skin', 400], ['skin_herringbone', 'territory_skin', 400], ['skin_scribble', 'territory_skin', 450], ['skin_wave', 'territory_skin', 450],
  ['skin_net', 'territory_skin', 500], ['skin_grass', 'territory_skin', 550], ['skin_scales', 'territory_skin', 800], ['skin_depth', 'territory_skin', 1000],
  ['skin_compass', 'territory_skin', 1300], ['skin_school', 'territory_skin', 1600], ['skin_sonar', 'territory_skin', 2200], ['skin_aquarium', 'territory_skin', 2400],
  ['skin_lighthouse', 'territory_skin', 2600], ['skin_lightning', 'territory_skin', 3000],
]
const labelOf = (id: string, cat: Cat) =>
  (cat === 'avatar_frame' ? AVATAR_FRAMES : cat === 'hero_bg' ? HERO_BACKGROUNDS : cat === 'name_style' ? NAME_STYLES : TERRITORY_SKINS).find((x) => x.id === id)?.label ?? id
const ITEMS: Item[] = PRICES.map(([id, cat, price]) => ({ id, cat, price, name: labelOf(id, cat), isNew: NEW_IDS.has(id) }))
const CATS: { id: Cat; label: string }[] = [
  { id: 'avatar_frame', label: 'Рамки' },
  { id: 'hero_bg', label: 'Фоны' },
  { id: 'name_style', label: 'Имя' },
  { id: 'territory_skin', label: 'Скины' },
]
const TIER = (p: number) => (p <= 400 ? 1 : p <= 900 ? 2 : p <= 1700 ? 3 : 4)
// The same rule as open_secret_box: the group by 70/22/6/2, any item of it; one the player has turns into half its price.
function rollBox(tier: number): { item: Item; tier: number } {
  const pool = ITEMS.filter((i) => TIER(i.price) === tier)
  return { item: pool[Math.floor(Math.random() * pool.length)], tier }
}
const rarity = (p: number) => (p >= 800 ? 'shop-card-legendary' : p > 500 ? 'shop-card-epic' : p > 200 ? 'shop-card-rare' : 'shop-card-common')

type Sector = { id: string; kind: Territory['kind']; lat: number; lng: number; corners: [number, number][] }

function Section({ title, about, children }: { title: string; about: string; children: React.ReactNode }) {
  return (
    <section style={{ margin: '0 0 30px' }}>
      <h2 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 4px' }}>{title}</h2>
      <p style={{ fontSize: 12.5, lineHeight: 1.45, color: 'var(--ink-soft)', margin: '0 0 10px' }}>{about}</p>
      {children}
    </section>
  )
}

function Preview({ item, color }: { item: Item; color: string }) {
  if (item.cat === 'avatar_frame')
    return (
      <div className="shop-card-preview">
        <div className="shop-card-avatar">
          <AvatarFrameRing frame={AVATAR_FRAMES.find((f) => f.id === item.id)} />
          <div className="shop-card-avatar-inner">ГР</div>
        </div>
      </div>
    )
  if (item.cat === 'hero_bg') {
    const bg = HERO_BACKGROUNDS.find((b) => b.id === item.id)!
    return (
      <div className="shop-card-bg-preview" style={{ background: bg.base }}>
        <HeroBgLive bg={bg} variant="swatch" />
      </div>
    )
  }
  if (item.cat === 'name_style')
    return (
      <div className="shop-card-name-preview">
        <StyledName name="Гоша" styleId={item.id} />
      </div>
    )
  return <SkinPreview skinId={item.id} color={color} />
}

// The secret box's onboarding note as SpotlightTours draws it in the app (same classes and texts), around the card here.
function BoxTourPreview({ onClose }: { onClose: () => void }) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  useEffect(() => {
    const el = document.querySelector('[data-tour="secret-box-card"]')
    el?.scrollIntoView({ block: 'center' })
    const id = window.setTimeout(() => setRect(el ? el.getBoundingClientRect() : null), 250)
    return () => window.clearTimeout(id)
  }, [])
  if (!rect) return null
  const PAD = 6
  const hole = { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }
  const tipW = Math.min(300, window.innerWidth - 32)
  const center = rect.left + rect.width / 2
  const tipLeft = Math.max(16, Math.min(center - tipW / 2, window.innerWidth - 16 - tipW))
  return (
    <div className="tour-root" role="dialog" aria-modal="true">
      <div className="tour-hole" style={hole} />
      <div className="tour-tip below" style={{ left: tipLeft, width: tipW, top: hole.top + hole.height + 14 }}>
        <span className="tour-arrow" style={{ left: Math.max(20, Math.min(center - tipLeft, tipW - 20)) - 7 }} />
        <div className="tour-kicker">{tn('tour.kickerNewOne')}</div>
        <div className="tour-title">{tn('tour.secretBox.title')}</div>
        <div className="tour-text">{tn('tour.secretBox.text')}</div>
        <div className="tour-actions">
          <span />
          <button className="btn-primary tour-next" onClick={onClose}>{tn('tour.done')}</button>
        </div>
      </div>
    </div>
  )
}

export function UpdatePreview() {
  const [sectors, setSectors] = useState<Territory[]>([])
  const [coins, setCoins] = useState(20000)
  // Free box openings won on the slots (three chests) — the demo starts with three.
  const [free, setFree] = useState(3)
  const [glFamily, setGlFamily] = useState('aurora')
  const [glPreset, setGlPreset] = useState('borealis')
  const [owned, setOwned] = useState<Set<string>>(new Set())
  const [worn, setWorn] = useState<Partial<Record<Cat, string>>>({ hero_bg: 'floats', avatar_frame: 'frame_storm', name_style: 'name_wave' })
  const [cat, setCat] = useState<Cat>('avatar_frame')
  // As in the Shop: a tab's dot goes out once the tab has been opened.
  const [seenTabs, setSeenTabs] = useState<Set<Cat>>(new Set(['avatar_frame']))
  const [boxOpen, setBoxOpen] = useState(false)
  const [tourOn, setTourOn] = useState(false)
  const [badge, setBadge] = useState<SectorBadgeKind | null>(null)
  const [route, setRoute] = useState(false)
  const [whyOpen, setWhyOpen] = useState(false)
  const [amount, setAmount] = useState(100)

  useEffect(() => {
    fetch(`/data/sectors-B.${SECTOR_GEOMETRY_VERSION}.json`)
      .then((r) => r.json())
      .then((raw: SectorGeometryFileOnDisk) => {
        const d: { sectors: Sector[] } = withCorners(raw)
        const s = d.sectors.find((x) => x.id === 'B1173')
        if (!s) return
        const base = territoryFromRow(undefined, s.id, s.kind, s.lat, s.lng, s.corners, undefined)
        setSectors([
          {
            ...base,
            status: 'other',
            ownerId: 'u1',
            ownerDisplayName: 'ViktDo',
            ownerColor: OTHER_TERRITORY_COLOR,
            ownerClanId: 7,
            ownerClanName: 'BFC',
            ownerClanCrest: null,
            capturerId: 'u1',
            coHolders: ['Ruslan', 'AxeLn', 'Борис'].map((n, i) => ({ id: `u${i + 2}`, avatarUrl: null, displayName: n, isMe: false, equippedSkin: null, color: ['#E3C64B', '#D28BE0', '#7CC24A'][i] })),
            catchCount: 257,
            defense: 2,
            shieldUntil: new Date(Date.now() + 12 * 3_600_000).toISOString(),
          },
        ])
      })
  }, [])
  const sector = sectors[0]

  const bg = HERO_BACKGROUNDS.find((b) => b.id === worn.hero_bg) ?? HERO_BACKGROUNDS[0]
  async function openBox(): Promise<BoxResult> {
    await new Promise((r) => setTimeout(r, 300))
    // A free opening (three chests on the slots, 09) goes first, instead of the 500.
    const cost = free > 0 ? 0 : 500
    if (free > 0) setFree((f) => f - 1)
    // One prize in four is coins (06): 150 or 250, 500, 1 000, 2 500 by the group.
    const r = Math.random()
    const t = r < 0.7 ? 1 : r < 0.92 ? 2 : r < 0.98 ? 3 : 4
    if (Math.random() < 0.25) {
      const coins = t === 1 ? (Math.random() < 0.5 ? 150 : 250) : t === 2 ? 500 : t === 3 ? 1000 : 2500
      setCoins((c) => c - cost + coins)
      return { itemId: null, tier: t, duplicate: false, refund: 0, coins }
    }
    const { item, tier } = rollBox(t)
    const duplicate = owned.has(item.id)
    const refund = duplicate ? Math.floor(item.price / 20) * 10 : 0
    if (!duplicate) setOwned((o) => new Set(o).add(item.id))
    setCoins((c) => c - cost + refund)
    return { itemId: item.id, tier, duplicate, refund, coins: 0 }
  }
  const asBox = (i: Item): BoxItem => ({ id: i.id, category: i.cat, name: i.name, price: i.price })

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', overflowY: 'auto', height: '100dvh' }}>
      <div style={{ maxWidth: 420, margin: '0 auto', padding: '18px 16px 80px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Обновление 24 ноября</h1>
        <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.45, margin: '6px 0 22px' }}>
          Демо: те же компоненты и стили, что в приложении, на настоящем секторе Батуми, но с выдуманными игроками и монетами. Ничего не сохраняется — после перезагрузки всё как было.
        </p>

        <Section title="0. Платные живые фоны: выбери фон и пресет" about="Каждый фон — семейство готовых пресетов (как на shadcn.io). Игрок покупает фон и выбирает пресет, тонкой настройки нет. Сейчас семь: северное сияние, градиент, звёзды, частицы, лучи, матрица, туман.">
          <div className="aur-cz">
            <div className="aur-presets">
              {GL_FAMILIES.map((f) => (
                <button key={f.id} type="button" className={`filter-chip${glFamily === f.id ? ' active' : ''}`} onClick={() => { setGlFamily(f.id); setGlPreset(f.presets[0].id) }}>
                  {familyName(f)}
                </button>
              ))}
            </div>
            <div className="aur-preview">
              {(GL_FAMILIES.find((f) => f.id === glFamily) ?? GL_FAMILIES[0]).render(glPreset)}
              <div className="aur-preview-avatar">ГР</div>
              <div className="aur-preview-name">Гоша Рыбак</div>
            </div>
            <div className="aur-presets">
              {(GL_FAMILIES.find((f) => f.id === glFamily) ?? GL_FAMILIES[0]).presets.map((p) => (
                <button key={p.id} type="button" className={`filter-chip${glPreset === p.id ? ' active' : ''}`} onClick={() => setGlPreset(p.id)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </Section>

        <Section title="0б. Комплекты: фон + рамка + имя" about="Вкладка «Комплекты» в магазине: у каждого фона своя рамка и свой стиль имени в одном стиле, всё вместе 300 ⭐ вместо 350. Пресет выбирается тут же, до покупки. Здесь кнопки ничего не покупают.">
          <KitsSection
            kits={GL_KITS}
            products={new Map(GL_KITS.map((k) => [k.kit, { id: k.kit, kind: 'kit' as const, amount: 0, itemId: null, stars: 300, owned: false, ownedAny: false }]))}
            owned={new Set<string>()}
            wornKit={() => false}
            presetFor={(f) => glPresetOf(f, undefined)}
            displayName="Гоша Рыбак"
            avatarUrl={null}
            onBuy={() => {}}
            onEquip={() => {}}
            onTryOn={() => {}}
            busy={false}
            kitTitle={(k) => `Комплект «${familyName(GL_FAMILIES.find((f) => f.id === k.family)!)}»`}
          />
        </Section>

        <Section title="1. Профиль: примерь новинки" about="Купи и надень вещь ниже — здесь сразу видно, как она смотрится в шапке профиля.">
          <div style={{ position: 'relative', isolation: 'isolate', borderRadius: 20, overflow: 'hidden', background: bg.base, padding: '26px 18px', display: 'flex', alignItems: 'center', gap: 16, minHeight: 130 }}>
            <HeroBgLive bg={bg} variant="hero" />
            <div className="shop-card-avatar" style={{ width: 76, height: 76 }}>
              <AvatarFrameRing frame={AVATAR_FRAMES.find((f) => f.id === worn.avatar_frame)} />
              <div className="shop-card-avatar-inner">ГР</div>
            </div>
            <div className="profile-hero-name" style={{ margin: 0 }}>
              <StyledName name="Гоша Рыбак" styleId={worn.name_style} />
            </div>
          </div>
        </Section>

        <Section title="2. Магазин: секретный бокс и NEW" about="Слоты и бокс — две плитки под балансом. Бокс открывается сколько угодно раз за 500. У новинок — значок NEW, у вкладок с новинками — точка.">
          <div className="shop-wallet">
            <div className="shop-wallet-balance">
              <CoinIcon size={28} />
              <span className="shop-wallet-num">{coins.toLocaleString('ru-RU')}</span>
              <span className="shop-wallet-label">монет</span>
            </div>
          </div>
          <div className="shop-games">
            <SlotsCard city="batumi" onOpen={() => {}} />
            <button type="button" data-tour="secret-box-card" className="secret-box-card tap-scale" onClick={() => setBoxOpen(true)}>
              <span className="slots-card-shine" aria-hidden />
              <span className="secret-box-card-art"><SecretBoxArt size={52} /><span className="secret-box-card-new">NEW</span></span>
              <span className="secret-box-card-text">
                <span className="secret-box-card-title">Секретный бокс</span>
                <span className="secret-box-card-sub">Случайная вещь из магазина</span>
              </span>
              <span className="secret-box-card-go" aria-hidden>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h13M13 6l6 6-6 6" /></svg>
              </span>
            </button>
          </div>
          <div className="shop-tabs" style={{ marginTop: 12 }}>
            {CATS.map((c) => (
              <button key={c.id} className={`shop-tab${cat === c.id ? ' active' : ''}`} onClick={() => { setCat(c.id); setSeenTabs((v) => new Set(v).add(c.id)) }}>
                {c.label}
                {!seenTabs.has(c.id) && <span className="shop-tab-new" />}
              </button>
            ))}
          </div>
          <div className="shop-grid" style={{ marginTop: 14 }}>
            {ITEMS.filter((i) => i.cat === cat).map((item) => {
              const has = owned.has(item.id)
              const on = worn[item.cat] === item.id
              return (
                <div key={item.id} className={`shop-card ${rarity(item.price)}`}>
                  {item.isNew && <span className="shop-new-tag">NEW</span>}
                  <Preview item={item} color={DEFAULT_TERRITORY_COLOR} />
                  <div className="shop-card-name">{item.name}</div>
                  {on ? (
                    <button className="btn-secondary shop-equipped" onClick={() => setWorn((w) => ({ ...w, [item.cat]: undefined }))}>Снять</button>
                  ) : has ? (
                    <button className="btn-secondary" onClick={() => setWorn((w) => ({ ...w, [item.cat]: item.id }))}>Надеть</button>
                  ) : (
                    <button
                      className="btn-primary shop-price-btn"
                      disabled={coins < item.price}
                      onClick={() => {
                        setCoins((c) => c - item.price)
                        setOwned((o) => new Set(o).add(item.id))
                      }}
                    >
                      {item.price}
                      <CoinIcon size={16} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn-secondary" onClick={() => setCoins((c) => c + 2000)}>+2 000 монет</button>
            <button className="btn-secondary" onClick={() => setOwned(new Set())}>Сбросить купленное</button>
            <button className="btn-secondary" onClick={() => setTourOn(true)}>Подсказка бокса</button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: '6px 0 0' }}>Кнопки выше — только в демо. Уже есть: {ITEMS.filter((i) => owned.has(i.id)).length} из {ITEMS.length} вещей.</p>
        </Section>

        <Section title="3. Экран сектора" about="Карта выше, сектор не перекрыт кнопками, внизу мягкий переход. Плашки нажимаются. Владельцы — одна карточка (нажми: список). Защита — молнии; под щитом её всё равно можно снять.">
          {sector && (
            <>
              <div className="sector-hero-map" style={{ borderRadius: 18, overflow: 'hidden' }}>
                <TerritoryThumbnailMapView territory={sector} myTerritoryColor={DEFAULT_TERRITORY_COLOR} ownerInitials="VI" fit={{ baseHeight: 320, gap: 60, bottomCover: 26 }} />
                <div className="sector-hero-map-chips">
                  <button type="button" className="sector-hero-map-chip" onClick={() => setRoute(true)}>Маршрут</button>
                  <button type="button" className="sector-hero-map-chip">На карте</button>
                </div>
              </div>
              <div className="sector-dock-card" style={{ position: 'relative', zIndex: 5, marginTop: -26 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div className="page-title" style={{ marginTop: 2, flexShrink: 0 }}>Сектор<br />{sector.id}</div>
                  <div className="sector-head-badges">
                    <button type="button" className="badge-tap" onClick={() => setBadge('status')}>{statusBadge('other', DEFAULT_TERRITORY_COLOR)}</button>
                    <button type="button" className="badge-tap" onClick={() => setBadge('shield')}><span className="badge badge-shield"><span>Щит · 12 ч</span></span></button>
                    <button type="button" className="badge-tap" onClick={() => setBadge('popular')}><span className="badge badge-accent"><span>🔥 Популярный</span></span></button>
                  </div>
                </div>
                <div className="page-sub" style={{ marginBottom: 0 }}>Море</div>
                <SectorHoldersCard territory={sector} onOpenUser={() => {}} onOpenClan={() => {}} />
                <div className="sector-standing" style={{ marginTop: 14 }}>
                  <SectorDefenseAside territory={sector} myClanId={null} />
                </div>
                <button className="btn-primary shield-locked" style={{ marginTop: 12 }} disabled>
                  Поставить щит · В запасе: 2
                </button>
                <div className="shield-hot-note">Щит уже стоит. Новый можно поставить, когда этот закончится</div>
              </div>
            </>
          )}
        </Section>

        <Section title="4. Окно маршрута" about="Настоящие значки карт, координаты копируются прямо в окне.">
          <button className="btn-secondary" onClick={() => setRoute(true)}>Открыть «Маршрут до сектора»</button>
        </Section>

        <Section title="5. Взнос в общак" about="Сколько можно внести видно сразу полоской, «Почему?» — подсказка поверх, «Все» — вся доступная сумма.">
          <div className="c2-card" style={{ background: 'var(--surface)', borderRadius: 20, padding: 18 }}>
            <b style={{ fontSize: 18 }}>Взнос в общак</b>
            <p className="c2-muted" style={{ margin: '6px 0 0' }}>Монет на счету: 312</p>
            <div className="c2-dep-split">
              <div className="c2-dep-bar"><span className="can" style={{ width: '52%' }} /><span className="gift" /></div>
              <div className="c2-dep-legend">
                <span className="c2-dep-item"><i className="can" />Можно внести <b>162</b></span>
                <button type="button" className="c2-dep-why" onClick={() => setWhyOpen((o) => !o)}>Почему?</button>
                {whyOpen && <span className="c2-dep-tip">Ещё 150 — бонус на старт: приветственный и за приглашение. Его тратят в магазине, но в общак не вносят. В общак идут монеты, заработанные в игре: за улов, задания, сундук.</span>}
              </div>
            </div>
            <div className="c2-presets">
              {[50, 100, 250, 500].map((p) => (
                <button key={p} className={`filter-chip${amount === p ? ' active' : ''}`} onClick={() => setAmount(p)}>{p}</button>
              ))}
              <button className={`filter-chip${amount === 162 ? ' active' : ''}`} onClick={() => setAmount(162)}>Все</button>
            </div>
            {amount > 162 && <p className="c2-short">Внести можно не больше 162</p>}
            <button className="btn-primary" style={{ marginTop: 12 }} disabled={amount > 162}>Внести {amount}</button>
          </div>
        </Section>

        <Section title="6. Все игроки: фильтр и сортировка" about="Фильтр — шторка: страна, под ней её города, высота не прыгает. В сортировке — «По уловам». Список пуст: на демо нет входа в аккаунт.">
          <PlayersDirectory onOpenUser={() => {}} />
        </Section>

        <Section title="8. Рейтинг недели: призы на пьедестале" about="Под каждым местом — его приз, у первого золотой и с ключом. Свободное место ждёт с призом. У плашки недели — сколько дней осталось.">
          <div className="filter-row">
            <span className="rating-week-badge rating-week-badge-inline">{formatWeekOfMonth(0, 'Asia/Tbilisi')} · {formatWeekLeft('Asia/Tbilisi')}</span>
          </div>
          <div className="rating-podium prized">
            <PodiumItem entry={{ userId: 'd2', displayName: 'istepkin', avatarUrl: null, sectorsThisWeek: 2, catchesThisWeek: 9, rank: 2 }} rank={2} onOpenUser={() => {}} prize={{ ...WEEK_PRIZES[1], rank: 2 }} />
            <PodiumItem entry={{ userId: 'd1', displayName: 'AxeLn', avatarUrl: null, sectorsThisWeek: 3, catchesThisWeek: 4, rank: 1 }} rank={1} onOpenUser={() => {}} prize={{ ...WEEK_PRIZES[0], rank: 1 }} />
            <EmptyPrizePlace rank={3} />
          </div>
        </Section>

        <Section title="9. Магазин: вкладка «Звёзды»" about="Монеты, ключи и три скина только за Звёзды Telegram. Покупка работает только в Telegram; здесь кнопки лишь показывают подсказку.">
          <StarsShop
            demo={[
              { id: 'coins_500', kind: 'coins', amount: 500, itemId: null, stars: 50, owned: false, ownedAny: false },
              { id: 'coins_1500', kind: 'coins', amount: 1500, itemId: null, stars: 125, owned: false, ownedAny: false },
              { id: 'coins_5000', kind: 'coins', amount: 5000, itemId: null, stars: 350, owned: false, ownedAny: false },
              { id: 'keys_1', kind: 'keys', amount: 1, itemId: null, stars: 40, owned: false, ownedAny: false },
              { id: 'keys_3', kind: 'keys', amount: 3, itemId: null, stars: 100, owned: false, ownedAny: false },
              { id: 'keys_5', kind: 'keys', amount: 5, itemId: null, stars: 150, owned: false, ownedAny: false },
            ]}
          />
        </Section>

        <Section title="10. Заглушка магазина" about="Что видят игроки, пока в «Управление» включена «Заглушка магазина». Ты (суперадмин) видишь магазин как обычно, с красной полоской сверху.">
          <div style={{ borderRadius: 20, overflow: 'hidden', background: 'var(--bg)', border: '1px solid var(--line)', padding: '0 0 16px' }}>
            <ShopClosed onBack={() => {}} />
          </div>
        </Section>

        <Section title="7. Значок двойных монет" about="Между «×2» и временем — тонкая черта.">
          <div style={{ display: "flex" }}>
            <button type="button" className="double-coins-chip"><b>×2</b><i className="double-coins-sep" aria-hidden /><span>23 ч</span></button>
          </div>
        </Section>
      </div>

      {boxOpen && (
        <div className="sbx-demo-host">
          <SecretBoxScreen
            all={ITEMS.map(asBox)}
            owned={owned}
            state={{ price: 500, free }}
            coins={coins}
            color={DEFAULT_TERRITORY_COLOR}
            displayName="Гоша"
            onOpen={openBox}
            onEquip={(it) => setWorn((w) => ({ ...w, [it.category]: it.id }))}
            onBack={() => setBoxOpen(false)}
            onAgain={() => setCoins((c) => c + 2000)}
          />
        </div>
      )}
      {tourOn && <BoxTourPreview onClose={() => setTourOn(false)} />}
      {badge && sector && <SectorBadgeInfo kind={badge} territory={sector} myShare={false} onClose={() => setBadge(null)} />}
      {route && sector && <RouteModal lat={sector.lat} lng={sector.lng} onClose={() => setRoute(false)} />}
    </div>
  )
}
