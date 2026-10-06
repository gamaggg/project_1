'use client'

import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { AvatarFrameRing } from '@/components/app-shell/AvatarFrameRing'
import { CoinIcon } from '@/components/app-shell/CoinIcon'
import { HeroBgLive } from '@/components/app-shell/HeroBgLive'
import { TerritoryColorPreviewMap } from '@/components/app-shell/TerritoryColorPreviewMap'
import { StyledName } from '@/components/app-shell/StyledName'
import { resolveHeroBackground } from '@/lib/data/heroBackgrounds'
import { resolveAvatarFrame } from '@/lib/data/shopItems'
import { thumbUrl } from '@/lib/supabase/imageUrl'
import type { ShopItem } from '@/lib/supabase/queries'
import type { CityId } from '@/lib/data/city'

export type TryOnLook = {
  displayName: string
  avatarUrl: string | null
  heroBg: string | null
  frame: string | null
  nameStyle: string | null
  territoryColor: string
  city: CityId
}

// «Примерить»: the player's own profile header with one shop item swapped
// in — a background, frame or name style over whatever else they already
// wear — or, for a sector skin, a piece of their city's map with their
// sectors in it, in their colour. Same pieces the real profile and map use
// (HeroBgLive, AvatarFrameRing, StyledName, the color picker's preview map),
// so what's shown is what they'd get.
export function ShopTryOn({
  item,
  look,
  state,
  onBuy,
  onEquip,
  onClose,
}: {
  item: ShopItem
  look: TryOnLook
  state: 'equipped' | 'owned' | 'locked'
  onBuy: () => void
  onEquip: () => void
  onClose: () => void
}) {
  const bg = resolveHeroBackground(item.category === 'hero_bg' ? item.id : look.heroBg)
  const frame = resolveAvatarFrame(item.category === 'avatar_frame' ? item.id : look.frame)
  const nameStyle = item.category === 'name_style' ? item.id : look.nameStyle
  const initials = look.displayName.slice(0, 2).toUpperCase()

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="tryon-card" onClick={(e) => e.stopPropagation()}>
        {item.category === 'territory_skin' ? (
          <div className="tryon-map">
            <TerritoryColorPreviewMap city={look.city} myTerritoryColor={look.territoryColor} equippedSkin={item.id} />
          </div>
        ) : (
          <div
            className="tryon-hero"
            style={
              {
                background: bg.base,
                '--hero-accent-rgb': bg.accentRgb,
                '--hero-text-rgb': bg.textRgb ?? '255,255,255',
              } as CSSProperties
            }
          >
            <HeroBgLive bg={bg} variant="hero" />
            <div className="tryon-avatar">
              <AvatarFrameRing frame={frame} />
              <div className="profile-avatar">
                {/* eslint-disable-next-line @next/next/no-img-element -- Supabase thumbnail URL, same as the profile avatar */}
                {look.avatarUrl ? <img src={thumbUrl(look.avatarUrl, 240)} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : initials}
              </div>
            </div>
            <div className="profile-hero-name">
              <StyledName name={look.displayName} styleId={nameStyle} />
            </div>
          </div>
        )}
        <div className="tryon-body">
          <div className="tryon-label">Примерка</div>
          <div className="modal-title">{item.name}</div>
          {state === 'locked' && !item.purchasable ? (
            <button className="btn-primary" onClick={onBuy}>
              Выбить в слотах · шанс 0,1%
            </button>
          ) : state === 'locked' ? (
            <button className="btn-primary shop-price-btn" onClick={onBuy}>
              Купить за <CoinIcon size={16} /> {item.price}
            </button>
          ) : state === 'owned' ? (
            <button className="btn-primary" onClick={onEquip}>
              {item.category === 'hero_bg' || item.category === 'territory_skin' ? 'Применить' : 'Надеть'}
            </button>
          ) : (
            <button className="btn-secondary" disabled>
              Уже у тебя
            </button>
          )}
          <button className="btn-secondary" style={{ marginTop: 8 }} onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
