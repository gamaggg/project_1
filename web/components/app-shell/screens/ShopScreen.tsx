'use client'

import { useClan2Enabled } from '@/lib/clan2/live/flag'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { BackButton } from '@/components/app-shell/BackButton'
import { CoinIcon } from '@/components/app-shell/CoinIcon'
import { LiveCoinBalance } from '@/components/app-shell/CoinCountUp'
import { RefundConfirmModal } from '@/components/app-shell/RefundConfirmModal'
import { CoinHistoryModal } from '@/components/app-shell/CoinHistoryModal'
import { StyledName } from '@/components/app-shell/StyledName'
import { SHOP_TAB_ICONS } from '@/components/app-shell/icons'
import { usePurchaseFlow } from '@/components/app-shell/usePurchaseFlow'
import { useAuth } from '@/components/providers/AuthProvider'
import { AVATAR_FRAMES, jackpotChanceLabel, JACKPOT_FRAME } from '@/lib/data/shopItems'
import { SecretBoxCard } from '@/components/app-shell/SecretBox'
import { ShopTryOn } from '@/components/app-shell/ShopTryOn'
import { AvatarFrameRing } from '@/components/app-shell/AvatarFrameRing'
import { thumbUrl } from '@/lib/supabase/imageUrl'
import { PREMIUM_HERO_BG_IDS, resolveHeroBackground } from '@/lib/data/heroBackgrounds'
import { HeroBgLive } from '@/components/app-shell/HeroBgLive'
import { DEFAULT_TERRITORY_COLOR } from '@/lib/data/territoryColors'
import { SkinPreview } from '@/components/app-shell/SkinPreview'
import { SlotsCard } from '@/components/app-shell/SlotsCard'
import { StarIcon, useStarsBuy } from '@/components/app-shell/StarsShop'
import { useStarsProducts } from '@/lib/supabase/queries/stars'
import { useMyGlPresets, useSetHeroBgPreset } from '@/lib/supabase/queries/glPresets'
import { KitsSection } from '@/components/app-shell/GlShop'
import { GL_FAMILIES, glPresetOf, type GlFamily } from '@/components/app-shell/glFamilies'
import { GL_KITS, glBgId, glFamilyOf, glKitOf, joinHeroBg, splitHeroBg, type GlKit } from '@/lib/data/glKits'
import { useMaintenance } from '@/lib/supabase/queries/maintenance'
import type { CityId } from '@/lib/data/city'
import {
  useProfile,
  useShopItems,
  useMyInventory,
  useShopNew,
  useIsShopNew,
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
import { currentLocale, tn } from '@/lib/i18n/runtime'
import { nameInitials } from '@/lib/initials'

// A pending refund, captured at the moment the admin taps "Вернуть" so the
// confirm modal can show its name/price without re-deriving them from
// whichever card/row triggered it.
type PendingRefund = { kind: 'item'; id: string; name: string; price: number } | { kind: 'buff'; activeBuffId: number; name: string; price: number }

// Card border/accent tier by price — a cheap, purely visual "rarity" read
// (not a real game-balance system) so the grid isn't a wall of identical
// cards; 800+ is the premium tier (animated frames and names, the richer
// skins).
function rarityClass(price: number): string {
  if (price >= 800) return 'shop-card-legendary'
  if (price > 500) return 'shop-card-epic'
  if (price > 200) return 'shop-card-rare'
  return 'shop-card-common'
}

type Category = 'avatar_frame' | 'hero_bg' | 'name_style' | 'kits' | 'territory_skin' | 'buffs'
const SEEN_NEW_KEY = 'shop-new-tabs-seen'
const CATEGORIES: { id: Category; label: string; icon: React.ReactNode }[] = [
  { id: 'avatar_frame', get label() { return tn('shop.tabFrames') }, icon: SHOP_TAB_ICONS.frame },
  { id: 'hero_bg', get label() { return tn('shop.tabBackgrounds') }, icon: SHOP_TAB_ICONS.background },
  { id: 'name_style', get label() { return tn('shop.tabName') }, icon: SHOP_TAB_ICONS.sparkle },
  { id: 'territory_skin', get label() { return tn('shop.tabSkins') }, icon: SHOP_TAB_ICONS.skin },
  { id: 'kits', get label() { return tn('shop.tabKits') }, icon: SHOP_TAB_ICONS.kit },
  { id: 'buffs', get label() { return tn('shop.tabBuffs') }, icon: SHOP_TAB_ICONS.bolt },
]

export function ShopScreen({
  onBack,
  onOpenSlots,
  onOpenSecretBox,
  onOpenTopUp,
}: {
  onBack: () => void
  onOpenSlots: () => void
  onOpenSecretBox: () => void
  onOpenTopUp: () => void
}) {
  const { user } = useAuth()
  const { data: profile } = useProfile(user?.id ?? null)
  // The 4th-challenge slot bought here is the account's own real weekly
  // challenge state, so it's scoped to profile.city like ChallengesScreen —
  // not the map-tab lens a `city` prop would have meant (see that screen's
  // comment for the duplicate-week bug this avoids).
  const city = profile?.city ?? 'batumi'
  const { data: items = [] } = useShopItems()
  const { data: owned = new Set<string>() } = useMyInventory()
  const buyItem = useBuyShopItem()
  const equipItem = useEquipShopItem()
  const coins = profile?.coins ?? 0
  // The last change to the balance while the Shop is open — «−300» floats up
  // off it and the coin flips (a purchase, a refund, a slot win coming back).
  // Adjusted during render, the moment the new balance arrives; only between
  // two loaded balances, so the first load isn't a "+1077".
  const loadedCoins = profile ? coins : null
  const [prevCoins, setPrevCoins] = useState(loadedCoins)
  const [coinDelta, setCoinDelta] = useState<{ n: number; amount: number } | null>(null)
  if (loadedCoins !== prevCoins) {
    setPrevCoins(loadedCoins)
    if (loadedCoins !== null && prevCoins !== null) setCoinDelta({ n: (coinDelta?.n ?? 0) + 1, amount: loadedCoins - prevCoins })
  }
  const { request, modal: purchaseModal } = usePurchaseFlow(coins)
  const [category, setCategory] = useState<Category>('avatar_frame')
  const [historyOpen, setHistoryOpen] = useState(false)
  // Only the balance stays pinned (owner, 25.11.2026: the whole header covered the screen when scrolling): the games
  // scroll away, and the tabs stick right under the pinned part, whose height is measured here.
  const pinnedRef = useRef<HTMLDivElement>(null)
  const [pinnedH, setPinnedH] = useState(0)
  useEffect(() => {
    const el = pinnedRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setPinnedH(el.offsetHeight))
    ro.observe(el)
    setPinnedH(el.offsetHeight)
    return () => ro.disconnect()
  }, [])
  const [tryOn, setTryOn] = useState<ShopItem | null>(null)
  // Новинки (24.11.2026): a dot on the tabs that hold something NEW the player hasn't looked at yet. Opening a tab
  // puts its new items out of the dot (kept on this device); the NEW badges on the items themselves stay their 3 days.
  const { data: newIds } = useShopNew()
  const [seenNew, setSeenNew] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(SEEN_NEW_KEY) ?? '[]') as string[])
    } catch {
      return new Set()
    }
  })
  // For Telegram Stars (25.11.2026): coins and keys on the «Звёзды» tab; the skins sold only for Stars stand on the
  // «Скины» tab with the rest, priced in Stars (owner: «put the skins in the skins»).
  const { data: starsProducts = [] } = useStarsProducts()
  const starsByItem = new Map(starsProducts.filter((p) => p.itemId).map((p) => [p.itemId!, p]))
  const starsTab = starsProducts.some((p) => !p.itemId)
  const starsBuy = useStarsBuy()
  // 25.11.2026, the paid live backgrounds: their kits (a Stars product of its own, id = the kit's id) and presets.
  const kitProducts = new Map(starsProducts.filter((p) => p.kind === 'kit').map((p) => [p.id, p]))
  const { data: savedPresets = new Map<string, string>() } = useMyGlPresets()
  const setPreset = useSetHeroBgPreset()
  const [pick, setPick] = useState<Record<string, string>>({})
  const wornBg = splitHeroBg(profile?.heroBg)
  // The preset shown for a family: what was just tapped, else the one on the profile, else the one kept for it, else the first.
  function presetFor(fam: GlFamily): string {
    const bgId = glBgId(fam.id)
    return glPresetOf(fam, pick[fam.id] ?? (wornBg.id === bgId ? wornBg.preset : null) ?? savedPresets.get(bgId))
  }
  // Before buying a tap only changes the picture (it goes with the order); after, it is saved — and shown on the profile if that background is on it.
  function choosePreset(fam: GlFamily, preset: string) {
    setPick((p) => ({ ...p, [fam.id]: preset }))
    const bgId = glBgId(fam.id)
    if (owned.has(bgId)) setPreset.mutate({ itemId: bgId, preset, equip: wornBg.id === bgId })
  }
  function equipAny(item: ShopItem) {
    const fam = item.category === 'hero_bg' ? GL_FAMILIES.find((f) => glBgId(f.id) === item.id) : undefined
    if (fam) setPreset.mutate({ itemId: item.id, preset: presetFor(fam), equip: true })
    else equipItem.mutate({ itemId: item.id })
  }
  function equipKit(kit: GlKit, fam: GlFamily) {
    setPreset.mutate({ itemId: kit.bg, preset: presetFor(fam), equip: true })
    equipItem.mutate({ itemId: kit.frame })
    equipItem.mutate({ itemId: kit.name })
  }
  const kitOwned = (kit: GlKit) => owned.has(kit.bg) && owned.has(kit.frame) && owned.has(kit.name)
  const kitWorn = (kit: GlKit) => wornBg.id === kit.bg && profile?.equippedFrame === kit.frame && profile?.equippedNameStyle === kit.name
  const kitTitle = (kit: GlKit) => tn('shop.kitName', { name: items.find((i) => i.id === kit.bg)?.name ?? kit.family })
  const tabOf = (i: ShopItem): Category => i.category as Category
  const unseenHere = newIds ? items.filter((i) => tabOf(i) === category && newIds.has(i.id) && !seenNew.has(i.id)).map((i) => i.id) : []
  // Adjusted during render, the moment the tab is open with something unseen in it.
  if (unseenHere.length > 0) setSeenNew(new Set([...seenNew, ...unseenHere]))
  useEffect(() => {
    try {
      localStorage.setItem(SEEN_NEW_KEY, JSON.stringify([...seenNew]))
    } catch {}
  }, [seenNew])
  const tabHasNew = (c: Category) => !!newIds && c !== category && items.some((i) => tabOf(i) === c && newIds.has(i.id) && !seenNew.has(i.id))

  const isSuperAdmin = useIsSuperAdmin()
  // «Заглушка магазина» (25.11.2026): closed for players while the super admin checks a release live.
  const { data: maintenanceState } = useMaintenance()
  const shopClosed = !!maintenanceState?.shopClosed
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

  // A jackpot frame isn't sold — it's shown only in its own city (as what the
  // slots there can give) or to whoever already won it.
  // The paid live families' pieces stand in only while Stars are open to the player (or once they own them).
  const glShown = (i: ShopItem) => !glFamilyOf(i.id) || owned.has(i.id) || starsByItem.has(i.id)
  const frames = items.filter(
    (i) => i.category === 'avatar_frame' && glShown(i) && (i.purchasable || owned.has(i.id) || i.id === JACKPOT_FRAME[city] || starsByItem.has(i.id))
  )
  // The plain colour presets (Огонь/Океан/Лес/…) aren't in PREMIUM_HERO_BG_IDS
  // — they've always been free, picked straight from ChangeColorModal with no
  // shop_items row needed at all. Listing them here too just gives everyone
  // one place to browse every background, animated or not; ownedBg below is
  // what actually keeps them free (never gated behind a purchase).
  const backgrounds = items.filter((i) => i.category === 'hero_bg' && glShown(i))
  function ownedBg(id: string) {
    return owned.has(id) || !PREMIUM_HERO_BG_IDS.has(id)
  }
  const nameStyles = items.filter((i) => i.category === 'name_style' && glShown(i))
  function tryOnState(item: ShopItem): 'equipped' | 'owned' | 'locked' {
    const kit = glKitOf(item.id)
    if (kit) return kitOwned(kit) ? (kitWorn(kit) ? 'equipped' : 'owned') : 'locked'
    const worn =
      item.category === 'avatar_frame'
        ? profile?.equippedFrame
        : item.category === 'name_style'
          ? profile?.equippedNameStyle
          : item.category === 'territory_skin'
            ? profile?.equippedSkin
            : wornBg.id
    if (worn === item.id) return 'equipped'
    const has = item.category === 'hero_bg' ? ownedBg(item.id) : owned.has(item.id)
    return has ? 'owned' : 'locked'
  }
  // A Stars skin shows only while Stars are open to the player (or once it is theirs).
  const skins = items.filter((i) => i.category === 'territory_skin' && (i.purchasable || owned.has(i.id) || starsByItem.has(i.id)))

  if (shopClosed && !isSuperAdmin) return <ShopClosed onBack={onBack} />

  return (
    <>
      {/* Sticky so the balance and category tabs stay put while the (often
          long) item grid below scrolls under them — the header row is part
          of this same sticky block rather than staying in its usual
          standalone spot, since letting only the tabs stick would leave the
          balance scrolling away oddly between the two. */}
      <div className="shop-sticky-top" ref={pinnedRef}>
        <div className="header-row">
          <BackButton onClick={onBack} registerNative={false} />
          <div style={{ fontWeight: 800, fontSize: 15 }}>{tn('shop.title')}</div>
          <div style={{ width: 36 }} />
        </div>
        {shopClosed && <div className="shop-stub-strip">Заглушка включена: игроки видят «Магазин обновляется»</div>}
        {/* The balance (owner, 25.11.2026: the gold card blended with the gold «Пополнить», and two buttons side by side
            argued): a light card, the number with «монет на счету · История» under it, one gold «Пополнить» on the right. */}
        {/* The balance (owner, 25.11.2026): the coin, the number and «История» (a text button) on one line, «Пополнить» on the right. */}
        <div className="shop-wallet">
          <div className="shop-wallet-balance">
            <span key={coinDelta?.n ?? 0} className={`shop-wallet-coin${coinDelta ? ' flip' : ''}`}>
              <CoinIcon size={28} />
            </span>
            <span className="shop-wallet-line">
              <span className="shop-wallet-num">
                <LiveCoinBalance value={coins} />
                {coinDelta && (
                  <span key={coinDelta.n} className={`shop-wallet-delta${coinDelta.amount < 0 ? ' minus' : ''}`} aria-hidden>
                    {coinDelta.amount < 0 ? '−' : '+'}
                    {Math.abs(coinDelta.amount)}
                  </span>
                )}
              </span>
              <button className="shop-wallet-history" onClick={() => setHistoryOpen(true)}>
                {tn('shop.history')}
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </span>
            <span className="shop-wallet-actions">
              {starsTab && (
                // «Пополнить»: to the screen with coins and keys for Telegram Stars.
                <button className="shop-wallet-topup" onClick={onOpenTopUp}>
                  <StarIcon size={15} />
                  {tn('shop.topUp')}
                </button>
              )}
            </span>
          </div>
        </div>
      </div>
      {/* The games under the balance, each its own card (24.11.2026: three blocks glued into one read oddly); they scroll away. */}
      <div className="shop-games-wrap">
        <div className="shop-games">
          <SlotsCard city={city} onOpen={onOpenSlots} />
          <SecretBoxCard onOpen={onOpenSecretBox} />
        </div>
      </div>
      <div className="shop-tabs-wrap" style={{ '--shop-pinned-h': `${pinnedH}px` } as CSSProperties}>
        <div className="shop-tabs">
          {CATEGORIES.map((c) => (
            <button key={c.id} className={`shop-tab${category === c.id ? ' active' : ''}`} onClick={() => setCategory(c.id)}>
              <span>{c.icon}</span>
              {c.label}
              {tabHasNew(c.id) && <span className="shop-tab-new" aria-label={tn('shop.new')} />}
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
                avatarUrl={profile?.avatarUrl ?? null}
                initials={nameInitials(profile?.displayName ?? tn('common.angler'), 2)}
                owned={owned.has(item.id)}
                equipped={profile?.equippedFrame === item.id}
                stars={starsByItem.get(item.id)?.stars}
                onBuy={() => {
                  const sp = starsByItem.get(item.id)
                  if (sp) starsBuy.start(sp)
                  else request(item.price, item.name, () => buyItem.mutate(item.id))
                }}
                onEquip={() => equipItem.mutate({ itemId: item.id })}
                onUnequip={() => equipItem.mutate({ itemId: null, category: 'avatar_frame' })}
                busy={buyItem.isPending || equipItem.isPending || starsBuy.busy}
                onTryOn={() => setTryOn(item)}
                onGoSlots={onOpenSlots}
                onRefund={
                  isSuperAdmin && owned.has(item.id) && item.purchasable
                    ? () => setRefunding({ kind: 'item', id: item.id, name: item.name, price: item.price })
                    : undefined
                }
              />
            ))}
          </div>
        )}

        {category === 'hero_bg' && (
          <div className="shop-grid">
            {starsBuy.note && (
              <p className="stars-note" style={{ gridColumn: '1 / -1' }}>
                {starsBuy.note}
              </p>
            )}
            {backgrounds.map((item) => {
              const fam = GL_FAMILIES.find((f) => glBgId(f.id) === item.id)
              return (
                <BgCard
                  key={item.id}
                  item={item}
                  owned={ownedBg(item.id)}
                  equipped={wornBg.id === item.id}
                  stars={starsByItem.get(item.id)?.stars}
                  gl={fam ? { family: fam, preset: presetFor(fam) } : undefined}
                  onBuy={() => {
                    const sp = starsByItem.get(item.id)
                    if (sp) starsBuy.start(sp, fam ? presetFor(fam) : null)
                    else request(item.price, item.name, () => buyItem.mutate(item.id))
                  }}
                  onEquip={() => equipAny(item)}
                  busy={buyItem.isPending || equipItem.isPending || setPreset.isPending || starsBuy.busy}
                  onTryOn={() => setTryOn(item)}
                  onRefund={isSuperAdmin && owned.has(item.id) && item.purchasable ? () => setRefunding({ kind: 'item', id: item.id, name: item.name, price: item.price }) : undefined}
                />
              )
            })}
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
                displayName={profile?.displayName ?? tn('shop.nameFallback')}
                stars={starsByItem.get(item.id)?.stars}
                onBuy={() => {
                  const sp = starsByItem.get(item.id)
                  if (sp) starsBuy.start(sp)
                  else request(item.price, item.name, () => buyItem.mutate(item.id))
                }}
                onEquip={() => equipItem.mutate({ itemId: item.id })}
                onUnequip={() => equipItem.mutate({ itemId: null, category: 'name_style' })}
                busy={buyItem.isPending || equipItem.isPending || starsBuy.busy}
                onTryOn={() => setTryOn(item)}
                onRefund={isSuperAdmin && owned.has(item.id) ? () => setRefunding({ kind: 'item', id: item.id, name: item.name, price: item.price }) : undefined}
              />
            ))}
          </div>
        )}

        {category === 'kits' && (
          <>
            {starsBuy.note && <p className="stars-note">{starsBuy.note}</p>}
            <KitsSection
              kits={GL_KITS.filter((k) => kitProducts.has(k.kit))}
              products={kitProducts}
              owned={owned}
              wornKit={kitWorn}
              presetFor={presetFor}
              displayName={profile?.displayName ?? tn('shop.nameFallback')}
              avatarUrl={profile?.avatarUrl ?? null}
              onBuy={(product, fam) => starsBuy.start(product, presetFor(fam))}
              onEquip={equipKit}
              onTryOn={(kit) => setTryOn({ id: kit.kit, category: 'hero_bg', name: kitTitle(kit), price: 0, purchasable: false })}
              busy={equipItem.isPending || setPreset.isPending || starsBuy.busy}
              kitTitle={kitTitle}
            />
          </>
        )}

        {category === 'territory_skin' && (
          <>
            <div className="shop-section-caption">{tn('shop.skinCaption')}</div>
            {starsBuy.note && <p className="stars-note">{starsBuy.note}</p>}
            <div className="shop-grid">
              {skins.map((item) => (
                <SkinCard
                  key={item.id}
                  item={item}
                  owned={owned.has(item.id)}
                  equipped={profile?.equippedSkin === item.id}
                  previewColor={profile?.territoryColor ?? DEFAULT_TERRITORY_COLOR}
                  stars={starsByItem.get(item.id)?.stars}
                  onBuy={() => {
                    const sp = starsByItem.get(item.id)
                    if (sp) starsBuy.start(sp)
                    else request(item.price, item.name, () => buyItem.mutate(item.id))
                  }}
                  onEquip={() => equipItem.mutate({ itemId: item.id })}
                  onUnequip={() => equipItem.mutate({ itemId: null, category: 'territory_skin' })}
                  busy={buyItem.isPending || equipItem.isPending || starsBuy.busy}
                  onTryOn={() => setTryOn(item)}
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

      </div>

      {purchaseModal}
      {refunding && (
        <RefundConfirmModal label={refunding.name} price={refunding.price} busy={refundBusy} onConfirm={confirmRefund} onClose={() => setRefunding(null)} />
      )}
      {historyOpen && <CoinHistoryModal onClose={() => setHistoryOpen(false)} />}
      {tryOn && (() => {
        const kit = glKitOf(tryOn.id)
        const famId = kit?.family ?? (tryOn.category === 'hero_bg' ? glFamilyOf(tryOn.id) : null)
        const fam = famId ? GL_FAMILIES.find((f) => f.id === famId) : undefined
        const product = starsByItem.get(tryOn.id) ?? kitProducts.get(tryOn.id)
        // The kit of this item's family offered in the window of its background, frame or name style (not owned yet, no
        // piece of the kit bought, and not the kit's own window).
        const itemFamId = glFamilyOf(tryOn.id)
        const offerKit = !kit && itemFamId ? GL_KITS.find((k) => k.family === itemFamId) : undefined
        const offerProduct = offerKit ? kitProducts.get(offerKit.kit) : undefined
        const offerFam = offerKit ? GL_FAMILIES.find((f) => f.id === offerKit.family) : undefined
        const kitOffer =
          offerKit && offerProduct && offerFam && !offerProduct.ownedAny && tryOnState(tryOn) === 'locked'
            ? { title: kitTitle(offerKit), stars: offerProduct.stars, onView: () => setTryOn({ id: offerKit.kit, category: 'hero_bg', name: kitTitle(offerKit), price: 0, purchasable: false }) }
            : undefined
        return (
          <ShopTryOn
            item={tryOn}
            look={{
              displayName: profile?.displayName ?? tn('common.angler'),
              avatarUrl: profile?.avatarUrl ?? null,
              heroBg: profile?.heroBg ?? null,
              frame: profile?.equippedFrame ?? null,
              nameStyle: profile?.equippedNameStyle ?? null,
              territoryColor: profile?.territoryColor ?? DEFAULT_TERRITORY_COLOR,
              city,
            }}
            state={tryOnState(tryOn)}
            stars={product?.stars}
            kit={kit}
            kitOffer={kitOffer}
            glPreset={fam ? { family: fam, value: presetFor(fam), onChange: (p) => choosePreset(fam, p) } : undefined}
            // A kit with some of its pieces already owned can't be bought whole (the rest goes one by one).
            kitBlocked={!!kit && !kitOwned(kit) && !!product?.ownedAny}
            onBuy={() => {
              const it = tryOn
              setTryOn(null)
              if (product) {
                starsBuy.start(product, fam ? presetFor(fam) : null)
                return
              }
              // A jackpot frame can't be bought — «Выбить в слотах» goes there instead.
              if (!it.purchasable) onOpenSlots()
              else request(it.price, it.name, () => buyItem.mutate(it.id))
            }}
            onEquip={() => {
              if (kit && fam) equipKit(kit, fam)
              else equipAny(tryOn)
              setTryOn(null)
            }}
            onClose={() => setTryOn(null)}
          />
        )
      })()}
    </>
  )
}

// tide/echo/double_coins activate instantly (no target); challenge_swap is
// bought on the Challenges screen itself (it needs a slot). Shields aren't
// sold — they only drop in the slots and are put on from the sector screen.
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
  // The clan update drops the personal «Двойные монеты» (lib/clan2/live/flag.ts).
  const clan2On = useClan2Enabled()
  const { data: activeBuffs = [] } = useMyActiveBuffs()
  const { data: weekState } = useChallengeWeekState(city)
  const activateBuff = useActivateBuff()
  const buyExtraChallenge = useBuyExtraChallenge(city)

  const shownBuffs = buffs.filter((b) => b.id !== 'shield' && b.id !== 'challenge_swap' && b.id !== 'extra_challenge' && !(clan2On && b.id === 'double_coins'))

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
        // The extra challenge goes on top of this city's set: no set here (it is in another city), nothing to add to.
        if (!bought && (weekState?.slotCount ?? 0) === 0) return null
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
          <span className="badge badge-shield">{tn('shop.armed')}</span>
          {onRefund && (
            <button className="challenge-swap-btn" onClick={onRefund}>
              {tn('shop.refund')}
            </button>
          )}
        </div>
      ) : state === 'active' && buff.id === 'extra_challenge' ? (
        <span className="badge badge-shield">{tn('shop.bought')}</span>
      ) : state === 'active' ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span className="badge badge-shield">{tn('shop.until', { time: expiresAt ? new Date(expiresAt).toLocaleTimeString(currentLocale(), { hour: '2-digit', minute: '2-digit' }) : '' })}</span>
          {onRefund && (
            <button className="challenge-swap-btn" onClick={onRefund}>
              {tn('shop.refund')}
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
  avatarUrl,
  initials,
  owned,
  equipped,
  onBuy,
  onEquip,
  onUnequip,
  busy,
  onTryOn,
  onGoSlots,
  onRefund,
  stars,
}: {
  item: ShopItem
  // The player's own avatar inside the frame — they're choosing how *they*
  // will look; initials on the default orange when there's no photo.
  avatarUrl: string | null
  initials: string
  owned: boolean
  equipped: boolean
  onBuy: () => void
  onEquip: () => void
  onUnequip: () => void
  busy: boolean
  onTryOn: () => void
  onGoSlots: () => void
  onRefund?: () => void
  // Sold only for Telegram Stars (the paid live families' frames): the price in Stars, three sparks on the tag.
  stars?: number
}) {
  const frame = AVATAR_FRAMES.find((f) => f.id === item.id)
  const prize = !item.purchasable && !stars && !glFamilyOf(item.id)
  const isNew = useIsShopNew(item.id)

  return (
    <div className={`shop-card ${prize ? 'shop-card-jackpot' : rarityClass(item.price)}${stars ? ' shop-card-stars' : ''}`} data-tag={prize ? tn('shop.jackpotTag') : undefined}>
      {isNew && <span className="shop-new-tag">{tn('shop.new')}</span>}
      <div className="shop-card-preview">
        <div className="shop-card-avatar">
          <AvatarFrameRing frame={frame} />
          <div className="shop-card-avatar-inner">
            {/* eslint-disable-next-line @next/next/no-img-element -- Supabase thumbnail URL, same as the profile avatar */}
            {avatarUrl ? <img src={thumbUrl(avatarUrl, 160)} alt="" loading="lazy" decoding="async" /> : initials}
          </div>
        </div>
      </div>
      <div className="shop-card-name">{item.name}</div>
      {equipped ? (
        <button className="btn-secondary shop-equipped" onClick={onUnequip} disabled={busy}>
          {tn('shop.unequip')}
        </button>
      ) : owned ? (
        <button className="btn-primary" onClick={onEquip} disabled={busy}>
          {tn('shop.equip')}
        </button>
      ) : prize ? (
        <>
          <div className="shop-card-jackpot-note">{tn('shop.jackpotNote', { chance: jackpotChanceLabel() })}</div>
          <button className="btn-secondary" onClick={onGoSlots}>
            {tn('shop.knockOut')}
          </button>
        </>
      ) : (
        <button className={`btn-secondary shop-price-btn${stars ? ' stars-price-btn' : ''}`} onClick={onBuy} disabled={busy}>
          {stars ? <StarIcon size={16} /> : <CoinIcon size={16} />}
          {stars ?? item.price}
        </button>
      )}
      <button className="challenge-swap-btn" onClick={onTryOn}>
        {tn('shop.tryOn')}
      </button>
      {onRefund && (
        <button className="challenge-swap-btn" onClick={onRefund}>
          {tn('shop.refund')}
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
  onTryOn,
  onRefund,
  stars,
  gl,
}: {
  item: ShopItem
  owned: boolean
  equipped: boolean
  onBuy: () => void
  onEquip: () => void
  busy: boolean
  onTryOn: () => void
  onRefund?: () => void
  // Sold only for Telegram Stars: the price in Stars, three sparks on the tag.
  stars?: number
  // A live family: the card's picture follows the preset picked (the presets themselves are in the try-on window).
  gl?: { family: GlFamily; preset: string }
}) {
  const isNew = useIsShopNew(item.id)
  const bg = resolveHeroBackground(gl ? joinHeroBg(item.id, gl.preset) : item.id)

  return (
    <div className={`shop-card ${rarityClass(item.price)}${stars ? ' shop-card-stars' : ''}`}>
      {isNew && <span className="shop-new-tag">{tn('shop.new')}</span>}
      <div className="shop-card-bg-preview" style={{ background: bg.animated ? bg.base : bg.css }}>
        <HeroBgLive bg={bg} variant="swatch" />
      </div>
      <div className="shop-card-name">{item.name}</div>
      {equipped ? (
        <button className="btn-secondary shop-equipped" disabled>
          {tn('shop.active')}
        </button>
      ) : owned ? (
        <button className="btn-primary" onClick={onEquip} disabled={busy}>
          {tn('shop.apply')}
        </button>
      ) : (
        <button className={`btn-secondary shop-price-btn${stars ? ' stars-price-btn' : ''}`} onClick={onBuy} disabled={busy}>
          {stars ? <StarIcon size={16} /> : <CoinIcon size={16} />}
          {stars ?? item.price}
        </button>
      )}
      <button className="challenge-swap-btn" onClick={onTryOn}>
        {tn('shop.tryOn')}
      </button>
      {onRefund && (
        <button className="challenge-swap-btn" onClick={onRefund}>
          {tn('shop.refund')}
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
  onTryOn,
  onRefund,
  stars,
}: {
  item: ShopItem
  owned: boolean
  equipped: boolean
  displayName: string
  onBuy: () => void
  onEquip: () => void
  onUnequip: () => void
  busy: boolean
  onTryOn: () => void
  onRefund?: () => void
  // Sold only for Telegram Stars: the price in Stars, three sparks on the tag.
  stars?: number
}) {
  const isNew = useIsShopNew(item.id)
  return (
    <div className={`shop-card ${rarityClass(item.price)}${stars ? ' shop-card-stars' : ''}`}>
      {isNew && <span className="shop-new-tag">{tn('shop.new')}</span>}
      {/* The live families' names are pale (made for the dark hero): a dark plate under them, as on the profile. */}
      <div className={`shop-card-name-preview${glFamilyOf(item.id) ? ' is-dark' : ''}`}>
        <StyledName name={displayName} styleId={item.id} />
      </div>
      <div className="shop-card-name">{item.name}</div>
      {equipped ? (
        <button className="btn-secondary shop-equipped" onClick={onUnequip} disabled={busy}>
          {tn('shop.unequip')}
        </button>
      ) : owned ? (
        <button className="btn-primary" onClick={onEquip} disabled={busy}>
          {tn('shop.equip')}
        </button>
      ) : (
        <button className={`btn-secondary shop-price-btn${stars ? ' stars-price-btn' : ''}`} onClick={onBuy} disabled={busy}>
          {stars ? <StarIcon size={16} /> : <CoinIcon size={16} />}
          {stars ?? item.price}
        </button>
      )}
      <button className="challenge-swap-btn" onClick={onTryOn}>
        {tn('shop.tryOn')}
      </button>
      {onRefund && (
        <button className="challenge-swap-btn" onClick={onRefund}>
          {tn('shop.refund')}
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
  onTryOn,
  onRefund,
  stars,
}: {
  item: ShopItem
  owned: boolean
  equipped: boolean
  previewColor: string
  onBuy: () => void
  onEquip: () => void
  onUnequip: () => void
  busy: boolean
  onTryOn: () => void
  onRefund?: () => void
  // Sold only for Telegram Stars: the price in Stars, and three sparks on the card's tag.
  stars?: number
}) {
  const isNew = useIsShopNew(item.id)
  return (
    <div className={`shop-card ${rarityClass(item.price)}${stars ? ' shop-card-stars' : ''}`}>
      {isNew && <span className="shop-new-tag">{tn('shop.new')}</span>}
      <SkinPreview skinId={item.id} color={previewColor} />
      <div className="shop-card-name">{item.name}</div>
      {equipped ? (
        <button className="btn-secondary shop-equipped" onClick={onUnequip} disabled={busy}>
          {tn('shop.unequip')}
        </button>
      ) : owned ? (
        <button className="btn-primary" onClick={onEquip} disabled={busy}>
          {tn('shop.apply')}
        </button>
      ) : (
        <button className={`btn-secondary shop-price-btn${stars ? ' stars-price-btn' : ''}`} onClick={onBuy} disabled={busy}>
          {stars ? <StarIcon size={16} /> : <CoinIcon size={16} />}
          {stars ?? item.price}
        </button>
      )}
      <button className="challenge-swap-btn" onClick={onTryOn}>
        {tn('shop.tryOn')}
      </button>
      {onRefund && (
        <button className="challenge-swap-btn" onClick={onRefund}>
          {tn('shop.refund')}
        </button>
      )}
    </div>
  )
}

// What players see while the Shop is closed by «Заглушка магазина»: the usual header and a short card.
export function ShopClosed({ onBack }: { onBack: () => void }) {
  return (
    <>
      <div className="shop-sticky-top">
        <div className="header-row">
          <BackButton onClick={onBack} registerNative={false} />
          <div style={{ fontWeight: 800, fontSize: 15 }}>{tn('shop.title')}</div>
          <div style={{ width: 36 }} />
        </div>
      </div>
      <div className="screen-inner">
        <div className="shop-stub">
          <div className="shop-stub-icon" aria-hidden>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 9h16l-1.2 10.2a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8z" />
              <path d="M8.5 9V7a3.5 3.5 0 0 1 7 0v2" />
              <path d="M12 12.5v3M12 18h.01" />
            </svg>
          </div>
          <div className="shop-stub-title">{tn('shop.closedTitle')}</div>
          <div className="shop-stub-text">{tn('shop.closedText')}</div>
          <button className="btn-primary" onClick={onBack}>
            {tn('shop.closedBack')}
          </button>
        </div>
      </div>
    </>
  )
}

