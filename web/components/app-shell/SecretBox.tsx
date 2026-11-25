'use client'

import { useIsShopNew, useSecretBox } from '@/lib/supabase/queries'
import { tn } from '@/lib/i18n/runtime'
import { hapticTap } from '@/lib/telegram/haptics'

// «Секретный бокс» (24.11.2026, supabase-drafts/economy-24-11/03): any number of times, 500 coins each, one Shop item —
// common 70%, rare 22%, epic 6%, legendary 2% (by the item's price; 07, 25.11.2026); an item the player already has comes back as half
// its price in coins. A card of its own under the slots' card in the Shop; a tap opens the box's own screen
// (SecretBoxScreen). Hidden until the box is released (get_secret_box_state gives null to everyone but the super admin).

// The box: the owner's illustration (24.11.2026, ChatGPT in the slots' icon style), closed and open, cut to the same
// frame so swapping them keeps the chest in place. public/shop/secret-box(-open).webp, 320 px.
export function SecretBoxArt({ size = 44, open = false }: { size?: number; open?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a small static illustration from public/
    <img
      className={`secret-box-art${open ? ' open' : ''}`}
      src={open ? '/shop/secret-box-open.webp' : '/shop/secret-box.webp'}
      width={size}
      height={size}
      alt=""
      aria-hidden
      draggable={false}
      decoding="async"
    />
  )
}

export function SecretBoxCard({ onOpen }: { onOpen: () => void }) {
  const { data: box } = useSecretBox()
  const isNew = useIsShopNew('secret_box')
  if (!box) return null // not released for this player yet, or not in the database
  return (
    <button
      type="button"
      data-tour="secret-box-card"
      className="secret-box-card tap-scale"
      onClick={() => {
        hapticTap()
        onOpen()
      }}
    >
      <span className="slots-card-shine" aria-hidden />
      <span className="secret-box-card-art">
        <SecretBoxArt size={52} />
        {/* NEW as a sticker on the chest's corner, like the spins count on the slots' reels. */}
        {isNew && <span className="secret-box-card-new">{tn('shop.new')}</span>}
      </span>
      <span className="secret-box-card-text">
        <span className="secret-box-card-title">{tn('box.title')}</span>
        {/* Free openings won on the slots (three chests) in place of the subtitle, so the player finds them. */}
        <span className="secret-box-card-sub">{box.free > 0 ? tn('box.freeCount', { n: box.free }) : tn('box.sub')}</span>
      </span>
      {/* No price here (owner, 24.11.2026): it is on the box's own screen, on «Открыть». */}
      <span className="secret-box-card-go" aria-hidden>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h13M13 6l6 6-6 6" />
        </svg>
      </span>
    </button>
  )
}
