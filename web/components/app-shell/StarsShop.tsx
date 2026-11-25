'use client'

import { useState } from 'react'
import { BackButton } from '@/components/app-shell/BackButton'
import { CoinIcon } from '@/components/app-shell/CoinIcon'
import { LiveCoinBalance } from '@/components/app-shell/CoinCountUp'
import { useAuth } from '@/components/providers/AuthProvider'
import { useProfile } from '@/lib/supabase/queries'
import { canPayWithStars, useBuyForStars, useStarsProducts, type StarsProduct } from '@/lib/supabase/queries/stars'
import { tn } from '@/lib/i18n/runtime'

// The Shop's «За Звёзды» tab (25.11.2026, supabase-drafts/economy-24-11/11): coins, keys (a free secret box opening
// each) and three sector skins sold only for Telegram Stars. Paid on Telegram's own sheet, so outside Telegram the
// buttons only say where to buy.

// The Stars mark: the Telegram star's own shape (owner, 25.11.2026: «take the star from here» — the single-colour SVG from
// gist.github.com/koval01/d8ae4debb97121cf1cb7a2a7aa99be32), painted gold as Telegram shows Stars.
const STAR_PATH =
  'M6.63869 12.1902L3.50621 14.1092C3.18049 14.3087 2.75468 14.2064 2.55515 13.8807C2.45769 13.7216 2.42864 13.5299 2.47457 13.3491L2.95948 11.4405C3.13452 10.7515 3.60599 10.1756 4.24682 9.86791L7.6642 8.22716C7.82352 8.15067 7.89067 7.95951 7.81418 7.80019C7.75223 7.67116 7.61214 7.59896 7.47111 7.62338L3.66713 8.28194C2.89387 8.41581 2.1009 8.20228 1.49941 7.69823L0.297703 6.69116C0.00493565 6.44581 -0.0335059 6.00958 0.211842 5.71682C0.33117 5.57442 0.502766 5.48602 0.687982 5.47153L4.35956 5.18419C4.61895 5.16389 4.845 4.99974 4.94458 4.75937L6.36101 1.3402C6.5072 0.987302 6.91179 0.819734 7.26469 0.965925C7.43413 1.03612 7.56876 1.17075 7.63896 1.3402L9.05539 4.75937C9.15496 4.99974 9.38101 5.16389 9.6404 5.18419L13.3322 5.47311C13.713 5.50291 13.9975 5.83578 13.9677 6.2166C13.9534 6.39979 13.8667 6.56975 13.7269 6.68896L10.9114 9.08928C10.7131 9.25826 10.6267 9.52425 10.6876 9.77748L11.5532 13.3733C11.6426 13.7447 11.414 14.1182 11.0427 14.2076C10.8642 14.2506 10.676 14.2208 10.5195 14.1249L7.36128 12.1902C7.13956 12.0544 6.8604 12.0544 6.63869 12.1902Z'
export function StarIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={(size * 15) / 14} viewBox="0 0 14 15" aria-hidden className="stars-icon">
      <defs>
        <linearGradient id="stars-icon-body" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0" stopColor="#FFD84D" />
          <stop offset="1" stopColor="#F59B0B" />
        </linearGradient>
      </defs>
      <path fillRule="evenodd" clipRule="evenodd" d={STAR_PATH} fill="url(#stars-icon-body)" />
    </svg>
  )
}

const COIN_PIC: Record<number, number> = { 500: 1, 1500: 2, 5000: 3 }

// Buying for Stars, shared by the «Звёзды» tab and the Stars skins on the «Скины» tab: opens Telegram's payment sheet
// and keeps a short note of how it went. `demo` only says where to buy.
export function useStarsBuy(demo = false) {
  const buy = useBuyForStars()
  const [note, setNote] = useState<string | null>(null)
  function start(p: StarsProduct, preset?: string | null) {
    setNote(null)
    if (demo || !canPayWithStars()) {
      setNote(tn('stars.onlyTelegram'))
      return
    }
    buy.mutate({ productId: p.id, preset }, {
      onSuccess: (status) => {
        if (status === 'paid') setNote(tn(p.kind === 'coins' ? 'stars.paidCoins' : p.kind === 'keys' ? 'stars.paidKeys' : p.kind === 'kit' ? 'stars.paidKit' : p.itemId?.startsWith('skin_') ? 'stars.paidSkin' : 'stars.paidItem'))
        else if (status === 'failed') setNote(tn('stars.failed'))
      },
      onError: (e) => setNote(tn(/STARS:owned/.test(String((e as Error).message)) ? 'stars.owned' : 'stars.failed')),
    })
  }
  return { start, note, busy: buy.isPending }
}

// The «Звёзды» tab: coins and keys. The skins sold for Stars stand on the «Скины» tab with the rest (owner, 25.11.2026).
// `demo`: the update preview's own list (no account there) — buying only says where to buy.
export function StarsShop({ demo }: { demo?: StarsProduct[] }) {
  const { data: loaded = [] } = useStarsProducts()
  const products = demo ?? loaded
  const { start, note, busy } = useStarsBuy(!!demo)
  const inTelegram = canPayWithStars()

  const coins = products.filter((p) => p.kind === 'coins')
  const keys = products.filter((p) => p.kind === 'keys')

  const price = (p: StarsProduct) => (
    <button className="btn-secondary shop-price-btn stars-price-btn" onClick={() => start(p)} disabled={busy}>
      <StarIcon size={16} />
      {p.stars}
    </button>
  )

  return (
    <div className="stars-shop">
      <div className="stars-hero">
        <StarIcon size={30} />
        <div>
          <div className="stars-hero-title">{tn('stars.title')}</div>
          <div className="stars-hero-sub">{tn(inTelegram ? 'stars.sub' : 'stars.onlyTelegram')}</div>
        </div>
      </div>
      {note && <p className="stars-note">{note}</p>}

      {coins.length > 0 && (
        <>
          <div className="shop-section-caption">{tn('stars.coins')}</div>
          <div className="stars-grid">
            {coins.map((p) => (
              <div key={p.id} className="shop-card stars-card">
                {/* eslint-disable-next-line @next/next/no-img-element -- the box's own coin heaps */}
                <img className="stars-card-pic" src={`/shop/coins-${COIN_PIC[p.amount] ?? 1}.webp?v=3`} alt="" />
                <div className="shop-card-name">{tn('stars.coinsN', { n: p.amount.toLocaleString('ru-RU') })}</div>
                {price(p)}
              </div>
            ))}
          </div>
        </>
      )}

      {keys.length > 0 && (
        <>
          <div className="shop-section-caption">{tn('stars.keys')}</div>
          <div className="stars-grid">
            {keys.map((p) => (
              <div key={p.id} className="shop-card stars-card">
                {/* eslint-disable-next-line @next/next/no-img-element -- the key pictures: one, three, five */}
                <img className="stars-card-pic stars-key-pic" src={`/shop/keys-${[1, 3, 5].includes(p.amount) ? p.amount : 1}.webp?v=2`} alt="" />
                <div className="shop-card-name">{tn(p.amount === 1 ? 'stars.key1' : p.amount < 5 ? 'stars.keysN' : 'stars.keysMany', { n: p.amount })}</div>
                {price(p)}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// The «Пополнить» screen (owner, 25.11.2026: «a screen of its own, not a tab in the Shop»): the Shop's header with
// «Назад», the balance, and the coins and keys for Stars under it.
export function TopUpScreen({ onBack }: { onBack: () => void }) {
  const { user } = useAuth()
  const { data: profile } = useProfile(user?.id ?? null)
  return (
    <>
      <div className="shop-sticky-top">
        <div className="header-row">
          <BackButton onClick={onBack} registerNative={false} />
          <div style={{ fontWeight: 800, fontSize: 15 }}>{tn('shop.topUp')}</div>
          <div style={{ width: 36 }} />
        </div>
        <div className="shop-wallet">
          <div className="shop-wallet-balance">
            <span className="shop-wallet-coin">
              <CoinIcon size={28} />
            </span>
            <span className="shop-wallet-main">
              <span className="shop-wallet-num">
                <LiveCoinBalance value={profile?.coins ?? 0} />
              </span>
              <span className="shop-wallet-sub">{tn('shop.walletLabel')}</span>
            </span>
          </div>
        </div>
      </div>
      <div className="screen-inner">
        <StarsShop />
      </div>
    </>
  )
}

