'use client'

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { BackButton } from '@/components/app-shell/BackButton'
import { CoinIcon } from '@/components/app-shell/CoinIcon'
import { SecretBoxArt } from '@/components/app-shell/SecretBox'
import { AvatarFrameRing } from '@/components/app-shell/AvatarFrameRing'
import { HeroBgLive } from '@/components/app-shell/HeroBgLive'
import { StyledName } from '@/components/app-shell/StyledName'
import { SkinPreview } from '@/components/app-shell/SkinPreview'
import { AVATAR_FRAMES } from '@/lib/data/shopItems'
import { DEFAULT_TERRITORY_COLOR } from '@/lib/data/territoryColors'
import { useAuth } from '@/components/providers/AuthProvider'
import { useEquipShopItem, useMyInventory, useOpenSecretBox, useProfile, useSecretBox, useShopItems } from '@/lib/supabase/queries'
import { HERO_BACKGROUNDS } from '@/lib/data/heroBackgrounds'
import { tn } from '@/lib/i18n/runtime'
import { thumbUrl } from '@/lib/supabase/imageUrl'
import type { TKey } from '@/lib/i18n/core'
import { hapticBuildUp, hapticSelect, hapticSuccess, hapticTap } from '@/lib/telegram/haptics'

// «Секретный бокс» on its own screen (24.11.2026, after the owner's «должно быть вау»): the chest glows and bobs; «Открыть»
// shakes it while the server rolls (open_secret_box decides — the screen only shows it), the lid bursts, and a strip of
// Shop items flies past a marker and slows for ~6 s onto the prize, the way case openings go in shooters: a tick (and a
// light haptic) per card, the prize's neighbour often legendary, so it almost stops on gold. Then the prize card
// flashes in its rarity's colour over turning rays, with «Надеть» — or, for an item the player already had, «Повтор» and
// the coins it turned into (half its price). The strip's other cards are rolled with the same 70/22/6/2 odds as the box
// itself. Opens any number of times. Used by the app (FishZoneApp's screen-secret-box) and by /update-preview.

export type BoxItem = { id: string; category: 'hero_bg' | 'avatar_frame' | 'name_style' | 'territory_skin' | 'coins'; name: string; price: number }
// free — free openings won on the slots (three chests); one goes first, instead of the price.
export type BoxState = { price: number; free?: number }
export type BoxResult = { itemId: string | null; tier: number; duplicate: boolean; refund: number; coins: number }

// Coins in the box (25.11.2026, supabase-drafts/economy-24-11/06): one prize in four in each group is coins —
// 150 or 250, 500, 1 000, 2 500. «price» is the amount, so boxTier puts each in its group.
const COIN_AMOUNTS = [150, 250, 500, 1000, 2500]
const COIN_SHARE = 0.25
// Bump when public/shop/coins-*.webp change: the files keep their names, so an open app would show the old ones.
const COIN_ART_V = 3
const coinPrize = (n: number): BoxItem => ({ id: `coins_${n}`, category: 'coins', name: tn('box.coins', { n: n.toLocaleString('ru-RU') }), price: n })

const TIER_KEYS = ['', 'common', 'rare', 'epic', 'legendary'] as const
const TIER_CHANCE = ['', '70%', '22%', '6%', '2%']
// The same odds as numbers, for each card's own chance (07: _secret_box_roll).
const TIER_ODDS = [0, 0.7, 0.22, 0.06, 0.02]
const TIER_PRICE = ['', '≤ 400', '401–900', '901–1 700', '1 701+']
// Groups by price, as in _secret_box_tier.
export const boxTier = (price: number) => (price <= 400 ? 1 : price <= 900 ? 2 : price <= 1700 ? 3 : 4)
function rollTier() {
  const r = Math.random()
  return r < 0.7 ? 1 : r < 0.92 ? 2 : r < 0.98 ? 3 : 4
}

const TILE = 104 // a card in the strip, px — keep in sync with .sbx-tile in globals.css
const GAP = 8
const STEP = TILE + GAP
const COUNT = 50
const WIN = 43 // where the prize sits; a few cards after it so the strip never runs out under the marker
const SPIN_MS = 6200
const CHARGE_MS = 1150 // the chest shakes at least this long, even when the server answers at once
const BURST_MS = 560
const CENTER_MS = 450 // after the stop, the prize glides to the middle of the strip
const CLOSE_MS = 320 // the prize card and the strip fading out after «Готово» — keep in sync with sbxOut in globals.css

type Phase = 'idle' | 'charge' | 'burst' | 'spin' | 'won'

function pickOf<T>(list: T[]) {
  return list[Math.floor(Math.random() * list.length)]
}

// The strip around the prize: random Shop items by the box's odds, the prize at WIN, and — unless the prize is gold
// itself — a legendary right after it and an epic right before.
function buildStrip(all: BoxItem[], prize: BoxItem): BoxItem[] {
  const byTier = (t: number) => {
    const a = all.filter((i) => i.category !== 'coins' && boxTier(i.price) === t && i.id !== prize.id)
    return a.length ? a : all.length ? all : [prize]
  }
  const coinOf = (t: number) => coinPrize(t === 1 ? pickOf([150, 250]) : t === 2 ? 500 : t === 3 ? 1000 : 2500)
  const strip: BoxItem[] = []
  for (let i = 0; i < COUNT; i++) {
    const t = rollTier()
    strip.push(Math.random() < COIN_SHARE ? coinOf(t) : pickOf(byTier(t)))
  }
  strip[WIN] = prize
  if (boxTier(prize.price) < 4) strip[WIN + 1] = pickOf(byTier(4))
  if (boxTier(prize.price) < 3) strip[WIN - 1] = pickOf(byTier(3))
  // No twin of the prize right next to it — it would read as two prizes.
  for (const j of [WIN - 2, WIN + 2]) if (strip[j].id === prize.id) strip[j] = pickOf(byTier(1))
  return strip
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'R'
}

// The item as it looks: a frame round an avatar, a background, the name in its style, a sector in the skin.
export function BoxItemPreview({ item, big, color, displayName, avatarUrl }: { item: BoxItem; big?: boolean; color: string; displayName: string; avatarUrl?: string | null }) {
  if (item.category === 'coins') {
    // The owner's pictures (25.11.2026, ChatGPT in the chest's style): the heap grows with the group —
    // public/shop/coins-1…4.webp, 400 px, cut to the heap with its glow; the amount is the card's name.
    const size = big ? 200 : 104
    return (
      // eslint-disable-next-line @next/next/no-img-element -- a small static illustration from public/
      <img
        className="sbx-coins-pic"
        src={`/shop/coins-${boxTier(item.price)}.webp?v=${COIN_ART_V}`}
        width={size}
        height={size}
        alt=""
        draggable={false}
        decoding="async"
      />
    )
  }
  if (item.category === 'avatar_frame') {
    const size = big ? 116 : 54
    return (
      <div className="shop-card-avatar sbx-av" style={{ width: size, height: size }}>
        <AvatarFrameRing frame={AVATAR_FRAMES.find((f) => f.id === item.id)} />
        <div className="shop-card-avatar-inner" style={{ fontSize: big ? 34 : 17 }}>
          {/* The player's own photo in the frame, as in the Shop; their initials when there is none. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- Supabase/R2 thumbnail URL, same as the Shop's frame cards */}
          {avatarUrl ? <img src={thumbUrl(avatarUrl, big ? 480 : 160)} alt="" loading="lazy" decoding="async" /> : initials(displayName)}
        </div>
      </div>
    )
  }
  if (item.category === 'hero_bg') {
    const bg = HERO_BACKGROUNDS.find((b) => b.id === item.id)
    if (!bg) return <div className="sbx-bg" />
    // The strip's many cards take the still picture; the prize gets the living one.
    return big ? (
      <div className="sbx-bg big" style={{ background: bg.base }}>
        <HeroBgLive bg={bg} variant="swatch" />
      </div>
    ) : (
      <div className="sbx-bg" style={{ background: bg.css }} />
    )
  }
  if (item.category === 'name_style')
    return (
      <div className={`sbx-name${big ? ' big' : ''}`}>
        <StyledName name={displayName} styleId={item.id} />
      </div>
    )
  return <SkinPreview skinId={item.id} color={color} width={big ? 150 : 66} />
}

export function SecretBoxScreen({
  all,
  owned,
  state,
  coins,
  color,
  displayName,
  avatarUrl = null,
  onOpen,
  onEquip,
  onBack,
  onAgain,
  registerNativeBack = false,
}: {
  // Everything that can drop (the Shop's items sold for coins) and what the player already has (marked «есть»).
  all: BoxItem[]
  owned: Set<string>
  state: BoxState | null | undefined
  coins: number
  color: string
  displayName: string
  // The player's photo for the frames' previews (null — their initials).
  avatarUrl?: string | null
  onOpen: () => Promise<BoxResult>
  onEquip?: (item: BoxItem) => void
  onBack: () => void
  // The demo page only: open it again and again.
  onAgain?: () => void
  registerNativeBack?: boolean
}) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [strip, setStrip] = useState<BoxItem[]>([])
  const [prize, setPrize] = useState<{ item: BoxItem; tier: number; duplicate: boolean; refund: number } | null>(null)
  // The balance as it was before the roll, minus the price, while the box rolls: the real one already has a repeat's
  // coins in it, and a jump on the chip would give the prize away.
  const [heldCoins, setHeldCoins] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [equipped, setEquipped] = useState(false)
  // «Готово»: the prize card and the strip fade out first, then the chest comes back (no jump back).
  const [closing, setClosing] = useState(false)
  const viewportRef = useRef<HTMLDivElement>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  // «Наверх» once the page is scrolled down into the showcase. The scrolling box is the app's screen (or the demo's host).
  const [showTop, setShowTop] = useState(false)
  useEffect(() => {
    const scroller = rootRef.current?.parentElement?.closest<HTMLElement>('.screen, .sbx-demo-host')
    if (!scroller) return
    const onScroll = () => setShowTop(scroller.scrollTop > 420)
    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => scroller.removeEventListener('scroll', onScroll)
  }, [])
  // The coin heaps load before the first roll, so no card in the strip flies past empty.
  useEffect(() => {
    for (let t = 1; t <= 4; t++) new Image().src = `/shop/coins-${t}.webp?v=${COIN_ART_V}`
  }, [])
  function toTop() {
    hapticTap()
    rootRef.current?.parentElement?.closest<HTMLElement>('.screen, .sbx-demo-host')?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const price = state?.price ?? 500
  const free = state?.free ?? 0
  const cost = free > 0 ? 0 : price
  const canOpen = !!state && coins >= cost
  const busy = phase === 'charge' || phase === 'burst' || phase === 'spin'
  const reason = state && coins < cost ? tn('box.notEnough') : null

  async function go() {
    if (!canOpen || phase !== 'idle') return
    setError(null)
    setEquipped(false)
    setPhase('charge')
    setHeldCoins(coins - cost)
    hapticTap()
    const started = Date.now()
    let res: BoxResult
    try {
      res = await onOpen()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? '')
      setError(/not enough coins/i.test(msg) ? tn('box.notEnough') : tn('box.failed'))
      setHeldCoins(null)
      setPhase('idle')
      return
    }
    await new Promise((r) => setTimeout(r, Math.max(0, CHARGE_MS - (Date.now() - started))))
    const won: BoxItem =
      res.coins > 0 ? coinPrize(res.coins) : (all.find((i) => i.id === res.itemId) ?? { id: res.itemId ?? '?', category: 'avatar_frame', name: '…', price: 0 })
    setPrize({ item: won, tier: res.tier, duplicate: res.duplicate, refund: res.refund })
    setStrip(buildStrip(all, won))
    setPhase('burst')
    hapticBuildUp()
    await new Promise((r) => setTimeout(r, BURST_MS))
    setPhase('spin')
  }

  // The flight: put the strip at its start with no transition, then let one long ease-out carry it to the prize. A
  // frame loop reads where it is for a light haptic on every card that passes under the marker (the marker itself stays still).
  useLayoutEffect(() => {
    if (phase !== 'spin') return
    const el = stripRef.current
    const vp = viewportRef.current
    if (!el || !vp) return
    const w = vp.clientWidth
    const half = TILE / 2
    // Where under the prize the marker stops: more often near its far edge (the gold card right behind it), else anywhere.
    const off = Math.random() < 0.55 ? half - 9 - Math.random() * TILE * 0.18 : (Math.random() * 2 - 1) * (half - 14)
    const start = w / 2 - (2 * STEP + half)
    const end = w / 2 - (WIN * STEP + half + off)
    // The same roll for everyone, «Уменьшение движения» on the phone too (owner, 25.11.2026).
    const ms = SPIN_MS
    el.style.transition = 'none'
    el.style.transform = `translate3d(${start}px,0,0)`
    void el.getBoundingClientRect()
    el.style.transition = `transform ${ms}ms cubic-bezier(.1,.62,.08,1)`
    el.style.transform = `translate3d(${end}px,0,0)`
    let raf = 0
    let last = -1
    let lastBuzz = 0
    const tick = () => {
      const x = new DOMMatrixReadOnly(getComputedStyle(el).transform).m41
      const idx = Math.floor((w / 2 - x + GAP / 2) / STEP)
      if (idx !== last) {
        const now = performance.now()
        if (last !== -1 && now - lastBuzz > 45) {
          lastBuzz = now
          hapticSelect()
        }
        last = idx
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    const done = window.setTimeout(() => {
      cancelAnimationFrame(raf)
      // Stopped where the roll left it (the near miss stays); now glide the prize to the middle, under the marker.
      el.style.transition = `transform ${CENTER_MS}ms cubic-bezier(.3,.7,.25,1)`
      el.style.transform = `translate3d(${w / 2 - (WIN * STEP + half)}px,0,0)`
      setPhase('won')
      setHeldCoins(null)
      hapticSuccess()
    }, ms + 60)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(done)
    }
  }, [phase])

  function finish() {
    if (closing) return
    setClosing(true)
    window.setTimeout(() => {
      setPhase('idle')
      setStrip([])
      setPrize(null)
      setClosing(false)
    }, CLOSE_MS)
  }

  // From «Открыть» to «Готово» the chest and then the strip ride down to the middle of the screen (owner, 25.11.2026: the
  // rules and the showcase are hidden while the box rolls, and the strip at the top left a big empty space under it).
  // The shift is measured once, against the scrolling screen, and kept in --sbx-focus; CSS glides the stage there and back.
  const focus = phase !== 'idle' && !closing
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    if (!focus) {
      root.style.setProperty('--sbx-focus', '0px')
      return
    }
    const stage = root.querySelector<HTMLElement>('.sbx-stage')
    const scroller = root.parentElement?.closest<HTMLElement>('.screen, .sbx-demo-host')
    if (!stage || !scroller) return
    const view = scroller.getBoundingClientRect()
    const box = stage.getBoundingClientRect()
    const now = new DOMMatrixReadOnly(getComputedStyle(stage).transform).m42
    const shift = view.top + view.height * 0.47 - (box.top - now + box.height / 2)
    root.style.setProperty('--sbx-focus', `${Math.max(0, Math.round(shift))}px`)
  }, [focus])

  const showStrip = phase === 'spin' || phase === 'won'
  const tier = prize?.tier ?? 1
  // Everything that can drop, gold first; what the player has is marked — it would come back as coins.
  const showcase = [...all, ...COIN_AMOUNTS.map(coinPrize)].sort((a, b) => b.price - a.price)
  // Each card's own chance, as open_secret_box picks: the group's odds; in it coins one time in four (150 and 250 share
  // the common group's coins half and half), else one of the group's items, all alike.
  const inTier = [0, 1, 2, 3, 4].map((t) => all.filter((i) => boxTier(i.price) === t).length)
  const chanceOf = (it: BoxItem) => {
    const t = boxTier(it.price)
    const p = it.category === 'coins' ? TIER_ODDS[t] * COIN_SHARE * (t === 1 ? 0.5 : 1) : (TIER_ODDS[t] * (1 - COIN_SHARE)) / Math.max(1, inTier[t])
    const pct = p * 100
    return `${pct.toLocaleString('ru-RU', { maximumFractionDigits: pct < 1 ? 2 : 1 })}%`
  }

  return (
    <div ref={rootRef} className={`sbx phase-${phase}${showStrip ? ` tier-${tier}` : ''}${focus ? ' focus' : ''}${closing ? ' closing' : ''}`}>
      <div className="sbx-bgglow" aria-hidden />
      <div className="sbx-head">
        {busy ? <div style={{ width: 36 }} /> : <BackButton onClick={onBack} registerNative={registerNativeBack} />}
        <div className="sbx-coins">
          {(heldCoins ?? coins).toLocaleString('ru-RU')}
          <CoinIcon size={16} />
        </div>
      </div>

      {/* The sign on its own line under «Назад», the same size and spacing as the slots' (.slots-title). */}
      <div className="sbx-title-wrap">
        <div className="slots-title sbx-title">{tn('box.title')}</div>
      </div>

      <div className="sbx-stage">
        {!showStrip ? (
          <div className="sbx-chest">
            <div className="sbx-rays" aria-hidden />
            <div className="sbx-halo" aria-hidden />
            <div className="sbx-chest-art">
              <SecretBoxArt size={210} open={phase === 'burst'} />
            </div>
            <div className="sbx-shadow" aria-hidden />
            {phase === 'burst' && <div className="sbx-flash" aria-hidden />}
          </div>
        ) : (
          <div className="sbx-roll">
            <div className="sbx-viewport" ref={viewportRef}>
              <div className="sbx-strip" ref={stripRef}>
                {strip.map((it, i) => {
                  const t = boxTier(it.price)
                  const win = phase === 'won' && i === WIN
                  return (
                    <div key={i} className={`sbx-tile tier-${t}${win ? ' win' : ''}${phase === 'won' && !win ? ' dim' : ''}`}>
                      <div className="sbx-tile-pic">
                        <BoxItemPreview item={it} color={color} displayName={displayName} avatarUrl={avatarUrl} />
                      </div>
                      <div className="sbx-tile-name">{it.name}</div>
                      <i className="sbx-tile-bar" />
                    </div>
                  )
                })}
              </div>
              <div className="sbx-marker" aria-hidden />
            </div>
          </div>
        )}
        {busy && <p className="sbx-note opening sbx-stage-note">{tn('box.opening')}</p>}
      </div>

      <div className="sbx-body">
        <div className="sbx-odds" aria-label={tn('box.chances')}>
          {[1, 2, 3, 4].map((t) => (
            <div key={t} className={`sbx-odd tier-${t}`}>
              <b>{TIER_CHANCE[t]}</b>
              <span>{tn(`box.tier.${TIER_KEYS[t]}` as TKey)}</span>
              <small>{TIER_PRICE[t]}</small>
            </div>
          ))}
        </div>

        {phase === 'idle' && (
          <>
            {reason && <p className="sbx-note">{reason}</p>}
            {error && <p className="sbx-note error">{error}</p>}
            <button type="button" className="sbx-go" disabled={!canOpen} onClick={() => void go()}>
              {free > 0 ? (
                <>
                  {tn('box.openFree')}
                  {free > 1 && ` ×${free}`}
                </>
              ) : (
                <>
                  {tn('box.open')} · {price}
                  <CoinIcon size={20} />
                </>
              )}
            </button>
            {onAgain && (
              <button type="button" className="sbx-again" onClick={onAgain}>
                +2 000 монет (только в демо)
              </button>
            )}
            {/* The rules as three short lines with icons — a paragraph read heavy here (owner, 25.11.2026). */}
            <ul className="sbx-rules">
              <li>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 3l2.2 5.2L20 9l-4.2 3.8L17 18.5 12 15.6 7 18.5l1.2-5.7L4 9l5.8-.8L12 3z" />
                </svg>
                {tn('box.ruleWhat')}
              </li>
              <li>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M17 2l4 4-4 4" />
                  <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
                  <path d="M7 22l-4-4 4-4" />
                  <path d="M21 13v1a4 4 0 0 1-4 4H3" />
                </svg>
                {tn('box.ruleOpen')}
              </li>
              <li>
                <CoinIcon size={16} />
                {tn('box.ruleDup')}
              </li>
            </ul>
            {showcase.length > 0 && (
              <>
                <div className="sbx-section">{tn('box.canDrop')}</div>
                <div className="sbx-showcase">
                  {showcase.map((it) => (
                    <div key={it.id} className={`sbx-tile tier-${boxTier(it.price)}`}>
                      <span className="sbx-tile-chance">{chanceOf(it)}</span>
                      {owned.has(it.id) && <span className="sbx-tile-owned">{tn('box.owned')}</span>}
                      <div className="sbx-tile-pic">
                        <BoxItemPreview item={it} color={color} displayName={displayName} avatarUrl={avatarUrl} />
                      </div>
                      <div className="sbx-tile-name">{it.name}</div>
                      <i className="sbx-tile-bar" />
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      <button type="button" className={`sbx-top${showTop && phase === 'idle' ? ' show' : ''}`} onClick={toTop} aria-label={tn('box.toTop')} tabIndex={showTop ? 0 : -1}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 19V5M6 11l6-6 6 6" />
        </svg>
      </button>

      {phase === 'won' && prize && (
        <div className={`sbx-reveal tier-${tier}`} role="dialog" aria-label={prize.item.name}>
          <div className="sbx-reveal-card">
            <div className="sbx-reveal-rays" aria-hidden />
            <div className="sbx-reveal-tier">
              {tn(`box.tier.${TIER_KEYS[tier]}` as TKey)}
              {prize.duplicate && <> · {tn('box.dup')}</>}
            </div>
            <div className="sbx-reveal-pic">
              <BoxItemPreview item={prize.item} big color={color} displayName={displayName} avatarUrl={avatarUrl} />
            </div>
            <div className="sbx-reveal-name">{prize.item.name}</div>
            {prize.item.category === 'coins' ? (
              <p className="sbx-reveal-sub">{tn('box.coinsYours')}</p>
            ) : prize.duplicate ? (
              <p className="sbx-reveal-refund">
                {tn('box.refund', { n: prize.refund.toLocaleString('ru-RU') })}
                <CoinIcon size={20} />
              </p>
            ) : (
              <p className="sbx-reveal-sub">{tn('box.yours')}</p>
            )}
            <div className="sbx-reveal-actions">
              {onEquip && !prize.duplicate && prize.item.category !== 'coins' && (
                <button
                  type="button"
                  className="sbx-go small"
                  disabled={equipped}
                  onClick={() => {
                    onEquip(prize.item)
                    setEquipped(true)
                    hapticTap()
                  }}
                >
                  {equipped ? tn('box.equipped') : tn('box.equip')}
                </button>
              )}
              <button type="button" className="sbx-ghost" onClick={finish}>
                {tn('box.done')}
              </button>
            </div>
          </div>
          {Array.from({ length: tier >= 3 ? 14 : 8 }, (_, i) => (
            <i key={i} className="sbx-spark" style={{ '--a': `${(i * 360) / (tier >= 3 ? 14 : 8)}deg`, '--d': `${(i % 4) * 0.08}s` } as CSSProperties} />
          ))}
        </div>
      )}
    </div>
  )
}

// The app's «Секретный бокс» screen (FishZoneApp's screen-secret-box): SecretBoxScreen with the real box — the
// server opens it, the strip only shows what it gave.
export function SecretBoxAppScreen({ onBack }: { onBack: () => void }) {
  const { user } = useAuth()
  const { data: profile } = useProfile(user?.id ?? null)
  const { data: items = [] } = useShopItems()
  const { data: owned } = useMyInventory()
  const { data: box } = useSecretBox()
  const open = useOpenSecretBox()
  const equip = useEquipShopItem()
  // What can drop: everything sold for coins (no free backgrounds, no slot prizes) — as open_secret_box picks.
  const sold = items.filter((i) => i.purchasable && i.price > 0)
  return (
    <SecretBoxScreen
      all={sold}
      owned={owned ?? EMPTY}
      state={box}
      coins={profile?.coins ?? 0}
      color={profile?.territoryColor ?? DEFAULT_TERRITORY_COLOR}
      displayName={profile?.displayName ?? tn('common.angler')}
      avatarUrl={profile?.avatarUrl ?? null}
      onOpen={() => open.mutateAsync()}
      onEquip={(it) => equip.mutate({ itemId: it.id })}
      onBack={onBack}
    />
  )
}
const EMPTY = new Set<string>()
