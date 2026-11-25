'use client'

import type { CSSProperties } from 'react'
import { AvatarFrameRing } from '@/components/app-shell/AvatarFrameRing'
import { HeroBgLive } from '@/components/app-shell/HeroBgLive'
import { StarIcon } from '@/components/app-shell/StarsShop'
import { StyledName } from '@/components/app-shell/StyledName'
import { GL_FAMILIES, glPresetOf, type GlFamily } from '@/components/app-shell/glFamilies'
import { GL_STARS, joinHeroBg, type GlKit } from '@/lib/data/glKits'
import { resolveHeroBackground } from '@/lib/data/heroBackgrounds'
import { resolveAvatarFrame } from '@/lib/data/shopItems'
import { thumbUrl } from '@/lib/supabase/imageUrl'
import type { StarsProduct } from '@/lib/supabase/queries/stars'
import { tn } from '@/lib/i18n/runtime'
import { nameInitials } from '@/lib/initials'

// The shop side of the paid live backgrounds (25.11.2026): the preset chips, the kit preview and the «Комплекты» tab.

// One row of ready presets of a background family; the picked one is filled. Nothing finer than presets (owner).
export function GlPresetChips({ family, value, onChange, disabled }: { family: GlFamily; value: string; onChange: (preset: string) => void; disabled?: boolean }) {
  return (
    <div className="shop-presets" role="group" aria-label={tn('shop.preset')}>
      {family.presets.map((p) => (
        <button key={p.id} type="button" className={`filter-chip${p.id === value ? ' active' : ''}`} onClick={() => onChange(p.id)} disabled={disabled} aria-pressed={p.id === value}>
          {p.label}
        </button>
      ))}
    </div>
  )
}

// The kit as a profile header in small: the background, the avatar in the frame, the name in the style.
export function KitPreview({
  kit,
  preset,
  displayName,
  avatarUrl,
  live,
}: {
  kit: GlKit
  preset: string
  displayName: string
  avatarUrl: string | null
  // Alive in the try-on; a still frame in the list (seven moving canvases on one tab would be a lot for a phone).
  live?: boolean
}) {
  const bg = resolveHeroBackground(joinHeroBg(kit.bg, preset))
  return (
    <div className="kit-preview" style={{ background: bg.base, '--hero-accent-rgb': bg.accentRgb } as CSSProperties}>
      <HeroBgLive bg={bg} variant={live ? 'hero' : 'swatch'} />
      <div className="kit-preview-avatar">
        <AvatarFrameRing frame={resolveAvatarFrame(kit.frame)} />
        <div className="kit-preview-photo">
          {/* eslint-disable-next-line @next/next/no-img-element -- Supabase thumbnail URL, same as the profile avatar */}
          {avatarUrl ? <img src={thumbUrl(avatarUrl, 160)} alt="" loading="lazy" decoding="async" /> : nameInitials(displayName, 2)}
        </div>
      </div>
      <div className="kit-preview-name">
        <StyledName name={displayName} styleId={kit.name} />
      </div>
    </div>
  )
}

export function KitsSection({
  kits,
  products,
  owned,
  wornKit,
  presetFor,
  onPreset,
  displayName,
  avatarUrl,
  onBuy,
  onEquip,
  onTryOn,
  busy,
  kitTitle,
}: {
  kits: GlKit[]
  products: Map<string, StarsProduct>
  owned: Set<string>
  wornKit: (kit: GlKit) => boolean
  presetFor: (family: GlFamily) => string
  onPreset: (family: GlFamily, preset: string) => void
  displayName: string
  avatarUrl: string | null
  onBuy: (product: StarsProduct, family: GlFamily) => void
  onEquip: (kit: GlKit, family: GlFamily) => void
  onTryOn: (kit: GlKit) => void
  busy: boolean
  kitTitle: (kit: GlKit) => string
}) {
  return (
    <>
      <div className="shop-section-caption">{tn('shop.kitCaption')}</div>
      <div className="kit-list">
        {kits.map((kit) => {
          const family = GL_FAMILIES.find((f) => f.id === kit.family)
          const product = products.get(kit.kit)
          if (!family) return null
          const all = owned.has(kit.bg) && owned.has(kit.frame) && owned.has(kit.name)
          const some = owned.has(kit.bg) || owned.has(kit.frame) || owned.has(kit.name)
          const worn = all && wornKit(kit)
          const preset = glPresetOf(family, presetFor(family))
          return (
            <div key={kit.kit} className="shop-card shop-card-legendary shop-card-stars kit-card">
              <KitPreview kit={kit} preset={preset} displayName={displayName} avatarUrl={avatarUrl} />
              <div className="shop-card-name">{kitTitle(kit)}</div>
              <div className="kit-contents">{tn('shop.kitContents')}</div>
              <GlPresetChips family={family} value={preset} onChange={(p) => onPreset(family, p)} />
              {all ? (
                worn ? (
                  <button className="btn-secondary shop-equipped" disabled>
                    {tn('shop.kitWorn')}
                  </button>
                ) : (
                  <button className="btn-primary" onClick={() => onEquip(kit, family)} disabled={busy}>
                    {tn('shop.kitEquip')}
                  </button>
                )
              ) : some ? (
                <div className="kit-part-note">{tn('shop.kitPartOwned')}</div>
              ) : product ? (
                <button className="btn-secondary shop-price-btn stars-price-btn" onClick={() => onBuy(product, family)} disabled={busy}>
                  <StarIcon size={16} />
                  {product.stars}
                  <span className="kit-instead">{tn('shop.kitInstead', { price: GL_STARS.bg + GL_STARS.frame + GL_STARS.name })}</span>
                </button>
              ) : null}
              <button className="challenge-swap-btn" onClick={() => onTryOn(kit)}>
                {tn('shop.tryOn')}
              </button>
            </div>
          )
        })}
      </div>
    </>
  )
}
