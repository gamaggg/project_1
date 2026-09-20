'use client'

import { useState } from 'react'
import { BackButton } from '@/components/app-shell/BackButton'
import { CoinIcon } from '@/components/app-shell/CoinIcon'
import { LiveCoinBalance } from '@/components/app-shell/CoinCountUp'
import { RefundConfirmModal } from '@/components/app-shell/RefundConfirmModal'
import { CoinHistoryModal } from '@/components/app-shell/CoinHistoryModal'
import { StyledName } from '@/components/app-shell/StyledName'
import { SHOP_TAB_ICONS } from '@/components/app-shell/icons'
import { usePurchaseFlow } from '@/components/app-shell/usePurchaseFlow'
import { useAuth } from '@/components/providers/AuthProvider'
import { AVATAR_FRAMES } from '@/lib/data/shopItems'
import { HERO_BACKGROUNDS, PREMIUM_HERO_BG_IDS } from '@/lib/data/heroBackgrounds'
import { HeroBgLive } from '@/components/app-shell/HeroBgLive'
import { NAME_STYLES } from '@/lib/data/nameStyles'
import { DEFAULT_TERRITORY_COLOR } from '@/lib/data/territoryColors'
import { SkinPreview } from '@/components/app-shell/SkinPreview'
import { WheelScreen } from '@/components/app-shell/screens/WheelScreen'
import type { CityId } from '@/lib/data/city'
import {
  useProfile,
  useShopItems,
  useMyInventory,
  useBuyShopItem,
  useEquipShopItem,
  useBuffs,
  useMyActiveBuffs,
  useActivateBuff,
  useBuyExtraChallenge,
  useChallengeWeekState,
  useIsSuperAdmin,
  useAdminRefundItem,
  useAdminRefundBuff,
  type ShopItem,
  type Buff,
} from '@/lib/supabase/queries'

// A pending refund, captured at the moment the admin taps "Вернуть" so the
// confirm modal can show its name/price without re-deriving them from
// whichever card/row triggered it.
type PendingRefund = { kind: 'item'; id: string; name: string; price: number } | { kind: 'buff'; activeBuffId: number; name: string; price: number }

// Card border/accent tier by price — a cheap, purely visual "rarity" read
// (not a real game-balance system) so the grid isn't a wall of identical
// cards; the shop's one real premium item (skin_predator, 700) is the only
// one that lands in "epic" territory.
function rarityClass(price: number): string {
  if (price > 500) return 'shop-card-epic'
  if (price > 200) return 'shop-card-rare'
  return 'shop-card-common'
}

type Category = 'avatar_frame' | 'hero_bg' | 'name_style' | 'territory_skin' | 'buffs' | 'wheel'
const CATEGORIES: { id: Category; label: string; icon: React.ReactNode }[] = [
  { id: 'avatar_frame', label: 'Рамки', icon: SHOP_TAB_ICONS.frame },
  { id: 'hero_bg', label: 'Фоны', icon: SHOP_TAB_ICONS.background },
  { id: 'name_style', label: 'Имя', icon: SHOP_TAB_ICONS.sparkle },
  { id: 'territory_skin', label: 'Скины', icon: SHOP_TAB_ICONS.skin },
  { id: 'buffs', label: 'Бафы', icon: SHOP_TAB_ICONS.bolt },
  { id: 'wheel', label: 'ДЭП', icon: SHOP_TAB_ICONS.wheel },
]

export function ShopScreen({ city, onBack }: { city: CityId; onBack: () => void }) {
  const { user } = useAuth()
  const { data: profile } = useProfile(user?.id ?? null)
  const { data: items = [] } = useShopItems()
  const { data: owned = new Set<string>() } = useMyInventory()
  const buyItem = useBuyShopItem()
  const equipItem = useEquipShopItem()
  const coins = profile?.coins ?? 0
  const { request, modal: purchaseModal } = usePurchaseFlow(coins)
  const [category, setCategory] = useState<Category>('avatar_frame')
  const [historyOpen, setHistoryOpen] = useState(false)

  const isSuperAdmin = useIsSuperAdmin()
  const refundItem = useAdminRefundItem()
  const refundBuff = useAdminRefundBuff()
  const [refunding, setRefunding] = useState<PendingRefund | null>(null)
  const refundBusy = refundItem.isPending || refundBuff.isPending

  function confirmRefund() {
    if (!refunding || !user) return
    if (refunding.kind === 'item') refundItem.mutate({ userId: user.id, itemId: refunding.id })
    else refundBuff.mutate({ userId: user.id, activeBuffId: refunding.activeBuffId })
    setRefunding(null)
  }

  const frames = items.filter((i) => i.category === 'avatar_frame')
  // The plain colour presets (Огонь/Океан/Лес/…) aren't in PREMIUM_HERO_BG_IDS
  // — they've always been free, picked straight from ChangeColorModal with no
  // shop_items row needed at all. Listing them here too just gives everyone
  // one place to browse every background, animated or not; ownedBg below is
  // what actually keeps them free (never gated behind a purchase).
  const backgrounds = items.filter((i) => i.category === 'hero_bg')
  function ownedBg(id: string) {
    return owned.has(id) || !PREMIUM_HERO_BG_IDS.has(id)
  }
  const nameStyles = items.filter((i) => i.category === 'name_style')
  const skins = items.filter((i) => i.category === 'territory_skin')

  return (
    <>
      {/* Sticky so the balance and category tabs stay put while the (often
          long) item grid below scrolls under them — the header row is part
          of this same sticky block rather than staying in its usual
          standalone spot, since letting only the tabs stick would leave the
          balance scrolling away oddly between the two. */}
      <div className="shop-sticky-top">
        <div className="header-row">
          <BackButton onClick={onBack} registerNative={false} />
          <div style={{ fontWeight: 800, fontSize: 15 }}>Магазин</div>
          <div style={{ width: 36 }} />
        </div>
        <div className="shop-hero">
          <div className="shop-hero-shine" />
          <CoinIcon size={56} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="shop-hero-balance">
              <LiveCoinBalance value={coins} />
            </div>
            <div className="shop-hero-label">монет на счету</div>
          </div>
          <button className="shop-hero-history-btn" onClick={() => setHistoryOpen(true)}>
            История
          </button>
        </div>

        <div className="shop-tabs">
          {CATEGORIES.map((c) => (
            <button key={c.id} className={`shop-tab${category === c.id ? ' active' : ''}`} onClick={() => setCategory(c.id)}>
              <span>{c.icon}</span>
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <div className="screen-inner">
        {category === 'avatar_frame' && (
          <div className="shop-grid">
            {frames.map((item) => (
              <FrameCard
                key={item.id}
                item={item}
                owned={owned.has(item.id)}
                equipped={profile?.equippedFrame === item.id}
                onBuy={() => request(item.price, item.name, () => buyItem.mutate(item.id))}
                onEquip={() => equipItem.mutate({ itemId: item.id })}
                onUnequip={() => equipItem.mutate({ itemId: null, category: 'avatar_frame' })}
                busy={buyItem.isPending || equipItem.isPending}
                onRefund={isSuperAdmin && owned.has(item.id) ? () => setRefunding({ kind: 'item', id: item.id, name: item.name, price: item.price }) : undefined}
              />
            ))}
          </div>
        )}

        {category === 'hero_bg' && (
          <div className="shop-grid">
            {backgrounds.map((item) => (
              <BgCard
                key={item.id}
                item={item}
                owned={ownedBg(item.id)}
                equipped={profile?.heroBg === item.id}
                onBuy={() => request(item.price, item.name, () => buyItem.mutate(item.id))}
                onEquip={() => equipItem.mutate({ itemId: item.id })}
                busy={buyItem.isPending || equipItem.isPending}
                onRefund={isSuperAdmin && owned.has(item.id) ? () => setRefunding({ kind: 'item', id: item.id, name: item.name, price: item.price }) : undefined}
              />
            ))}
          </div>
        )}

        {category === 'name_style' && (
          <div className="shop-grid">
            {nameStyles.map((item) => (
              <NameStyleCard
                key={item.id}
                item={item}
                owned={owned.has(item.id)}
                equipped={profile?.equippedNameStyle === item.id}
                displayName={profile?.displayName ?? 'Имя'}
                onBuy={() => request(item.price, item.name, () => buyItem.mutate(item.id))}
                onEquip={() => equipItem.mutate({ itemId: item.id })}
                onUnequip={() => equipItem.mutate({ itemId: null, category: 'name_style' })}
                busy={buyItem.isPending || equipItem.isPending}
                onRefund={isSuperAdmin && owned.has(item.id) ? () => setRefunding({ kind: 'item', id: item.id, name: item.name, price: item.price }) : undefined}
              />
            ))}
          </div>
        )}

        {category === 'territory_skin' && (
          <>
            <div className="shop-section-caption">Скин виден всем рыбакам на карте — не только тебе</div>
            <div className="shop-grid">
              {skins.map((item) => (
                <SkinCard
                  key={item.id}
                  item={item}
                  owned={owned.has(item.id)}
                  equipped={profile?.equippedSkin === item.id}
                  previewColor={profile?.territoryColor ?? DEFAULT_TERRITORY_COLOR}
                  onBuy={() => request(item.price, item.name, () => buyItem.mutate(item.id))}
                  onEquip={() => equipItem.mutate({ itemId: item.id })}
                  onUnequip={() => equipItem.mutate({ itemId: null, category: 'territory_skin' })}
                  busy={buyItem.isPending || equipItem.isPending}
                  onRefund={isSuperAdmin && owned.has(item.id) ? () => setRefunding({ kind: 'item', id: item.id, name: item.name, price: item.price }) : undefined}
                />
              ))}
            </div>
          </>
        )}

        {category === 'buffs' && (
          <BuffsSection
            city={city}
            request={request}
            onRefundBuff={isSuperAdmin ? (activeBuffId, name, price) => setRefunding({ kind: 'buff', activeBuffId, name, price }) : undefined}
          />
        )}

        {category === 'wheel' && <WheelScreen />}
      </div>

      {purchaseModal}
      {refunding && (
        <RefundConfirmModal label={refunding.name} price={refunding.price} busy={refundBusy} onConfirm={confirmRefund} onClose={() => setRefunding(null)} />
      )}
      {historyOpen && <CoinHistoryModal onClose={() => setHistoryOpen(false)} />}
    </>
  )
}

// tide/echo/double_coins activate instantly (no target) — shield is bought
// contextually from TerritoryScreen instead (it needs a sector), and
// challenge_swap from the Challenges screen itself (it needs a slot).
function BuffsSection({
  city,
  request,
  onRefundBuff,
}: {
  city: CityId
  request: (price: number, name: string, buy: () => void) => void
  onRefundBuff?: (activeBuffId: number, name: string, price: number) => void
}) {
  const { data: buffs = [] } = useBuffs()
  const { data: activeBuffs = [] } = useMyActiveBuffs()
  const { data: weekState } = useChallengeWeekState(city)
  const activateBuff = useActivateBuff()
  const buyExtraChallenge = useBuyExtraChallenge(city)

  const shownBuffs = buffs.filter((b) => b.id !== 'shield' && b.id !== 'challenge_swap' && b.id !== 'extra_challenge')

  return (
    <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {shownBuffs.map((buff) => {
        const active = activeBuffs.find((a) => a.buffId === buff.id)
        return (
          <BuffRow
            key={buff.id}
            buff={buff}
            state={
              active
                ? active.consumed === false && buff.durationHours === null
                  ? 'armed'
                  : 'active'
                : 'idle'
            }
            expiresAt={active?.expiresAt ?? null}
            onBuy={() => request(buff.price, buff.name, () => activateBuff.mutate(buff.id))}
            busy={activateBuff.isPending}
            onRefund={active && onRefundBuff ? () => onRefundBuff(active.id, buff.name, buff.price) : undefined}
          />
        )
      })}
      {(() => {
        const buff = buffs.find((b) => b.id === 'extra_challenge')
        if (!buff) return null
        const bought = weekState?.extraSlotBought ?? false
        return (
          <BuffRow
            buff={buff}
            state={bought ? 'active' : 'idle'}
            expiresAt={null}
            onBuy={() => request(buff.price, buff.name, () => buyExtraChallenge.mutate())}
            busy={buyExtraChallenge.isPending}
          />
        )
      })()}
    </div>
  )
}

function BuffRow({
  buff,
  state,
  expiresAt,
  onBuy,
  busy,
  onRefund,
}: {
  buff: Buff
  state: 'idle' | 'armed' | 'active'
  expiresAt: string | null
  onBuy: () => void
  busy: boolean
  onRefund?: () => void
}) {
  return (
    <div className="buff-row">
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="buff-row-name">{buff.name}</div>
        <div className="buff-row-desc">{buff.description}</div>
      </div>
      {state === 'armed' ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span className="badge badge-shield">Заряжено</span>
          {onRefund && (
            <button className="challenge-swap-btn" onClick={onRefund}>
              Вернуть
            </button>
          )}
        </div>
      ) : state === 'active' && buff.id === 'extra_challenge' ? (
        <span className="badge badge-shield">Куплено</span>
      ) : state === 'active' ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span className="badge badge-shield">До {expiresAt ? new Date(expiresAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
          {onRefund && (
            <button className="challenge-swap-btn" onClick={onRefund}>
              Вернуть
            </button>
          )}
        </div>
      ) : (
        <button className="btn-secondary shop-price-btn" onClick={onBuy} disabled={busy} style={{ flex: '0 0 auto' }}>
          <CoinIcon size={16} />
          {buff.price}
        </button>
      )}
    </div>
  )
}

function FrameCard({
  item,
  owned,
  equipped,
  onBuy,
  onEquip,
  onUnequip,
  busy,
  onRefund,
}: {
  item: ShopItem
  owned: boolean
  equipped: boolean
  onBuy: () => void
  onEquip: () => void
  onUnequip: () => void
  busy: boolean
  onRefund?: () => void
}) {
  const frame = AVATAR_FRAMES.find((f) => f.id === item.id)

  return (
    <div className={`shop-card ${rarityClass(item.price)}`}>
      <div className="shop-card-preview">
        <div className="shop-card-avatar">
          <div className={`avatar-frame-ring${frame?.glow ? ' avatar-frame-glow' : ''}`} style={{ background: frame?.ring }} />
          <div className="shop-card-avatar-inner" />
        </div>
      </div>
      <div className="shop-card-name">{item.name}</div>
      {equipped ? (
        <button className="btn-secondary shop-equipped" onClick={onUnequip} disabled={busy}>
          Снять
        </button>
      ) : owned ? (
        <button className="btn-primary" onClick={onEquip} disabled={busy}>
          Надеть
        </button>
      ) : (
        <button className="btn-secondary shop-price-btn" onClick={onBuy} disabled={busy}>
          <CoinIcon size={16} />
          {item.price}
        </button>
      )}
      {onRefund && (
        <button className="challenge-swap-btn" onClick={onRefund}>
          Вернуть
        </button>
      )}
    </div>
  )
}

function BgCard({
  item,
  owned,
  equipped,
  onBuy,
  onEquip,
  busy,
  onRefund,
}: {
  item: ShopItem
  owned: boolean
  equipped: boolean
  onBuy: () => void
  onEquip: () => void
  busy: boolean
  onRefund?: () => void
}) {
  const bg = HERO_BACKGROUNDS.find((b) => b.id === item.id)

  return (
    <div className={`shop-card ${rarityClass(item.price)}`}>
      <div className="shop-card-bg-preview" style={{ background: bg?.animated ? bg.base : bg?.css }}>
        {bg && <HeroBgLive bg={bg} variant="swatch" />}
      </div>
      <div className="shop-card-name">{item.name}</div>
      {equipped ? (
        <button className="btn-secondary shop-equipped" disabled>
          Активен
        </button>
      ) : owned ? (
        <button className="btn-primary" onClick={onEquip} disabled={busy}>
          Применить
        </button>
      ) : (
        <button className="btn-secondary shop-price-btn" onClick={onBuy} disabled={busy}>
          <CoinIcon size={16} />
          {item.price}
        </button>
      )}
      {onRefund && (
        <button className="challenge-swap-btn" onClick={onRefund}>
          Вернуть
        </button>
      )}
    </div>
  )
}

function NameStyleCard({
  item,
  owned,
  equipped,
  displayName,
  onBuy,
  onEquip,
  onUnequip,
  busy,
  onRefund,
}: {
  item: ShopItem
  owned: boolean
  equipped: boolean
  displayName: string
  onBuy: () => void
  onEquip: () => void
  onUnequip: () => void
  busy: boolean
  onRefund?: () => void
}) {
  return (
    <div className={`shop-card ${rarityClass(item.price)}`}>
      <div className="shop-card-name-preview">
        <StyledName name={displayName} styleId={item.id} />
      </div>
      <div className="shop-card-name">{item.name}</div>
      {equipped ? (
        <button className="btn-secondary shop-equipped" onClick={onUnequip} disabled={busy}>
          Снять
        </button>
      ) : owned ? (
        <button className="btn-primary" onClick={onEquip} disabled={busy}>
          Надеть
        </button>
      ) : (
        <button className="btn-secondary shop-price-btn" onClick={onBuy} disabled={busy}>
          <CoinIcon size={16} />
          {item.price}
        </button>
      )}
      {onRefund && (
        <button className="challenge-swap-btn" onClick={onRefund}>
          Вернуть
        </button>
      )}
    </div>
  )
}

function SkinCard({
  item,
  owned,
  equipped,
  previewColor,
  onBuy,
  onEquip,
  onUnequip,
  busy,
  onRefund,
}: {
  item: ShopItem
  owned: boolean
  equipped: boolean
  previewColor: string
  onBuy: () => void
  onEquip: () => void
  onUnequip: () => void
  busy: boolean
  onRefund?: () => void
}) {
  return (
    <div className={`shop-card ${rarityClass(item.price)}`}>
      <SkinPreview skinId={item.id} color={previewColor} />
      <div className="shop-card-name">{item.name}</div>
      {equipped ? (
        <button className="btn-secondary shop-equipped" onClick={onUnequip} disabled={busy}>
          Снять
        </button>
      ) : owned ? (
        <button className="btn-primary" onClick={onEquip} disabled={busy}>
          Применить
        </button>
      ) : (
        <button className="btn-secondary shop-price-btn" onClick={onBuy} disabled={busy}>
          <CoinIcon size={16} />
          {item.price}
        </button>
      )}
      {onRefund && (
        <button className="challenge-swap-btn" onClick={onRefund}>
          Вернуть
        </button>
      )}
    </div>
  )
}
