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

// The ready presets of a background family as plain words in a flowing line (no buttons, nothing to scroll): the
// picked one is bold with an accent underline. Nothing finer than presets (owner).
export function GlPresetWords({ family, value, onChange }: { family: GlFamily; value: string; onChange: (preset: string) => void }) {
  return (
    <div className="preset-words" role="radiogroup" aria-label={tn('shop.preset')}>
      {family.presets.map((p) => (
        <button key={p.id} type="button" role="radio" aria-checked={p.id === value} className={`preset-word${p.id === value ? ' on' : ''}`} onClick={() => onChange(p.id)}>
          {p.label}
        </button>
      ))}
    </div>
  )
}

// The picker with its explanation, shown in the try-on window (and only there). `owned`: the family is the player's,
// so the note tells them a tapped preset is kept with «Сохранить».
export function GlPresetPicker({ family, value, onChange, owned }: { family: GlFamily; value: string; onChange: (preset: string) => void; owned?: boolean }) {
  return (
    <div className="preset-picker">
      <div className="preset-picker-label">{tn('shop.preset')}</div>
      <GlPresetWords family={family} value={value} onChange={onChange} />
      <div className="preset-picker-note">{tn(owned ? 'shop.presetNoteOwned' : 'shop.presetNote')}</div>
    </div>
  )
}

// On a bought live background's or kit's card: which preset is on it now, with a chevron — the card opens its window.
export function PresetLine({ family, preset }: { family: GlFamily; preset: string }) {
  const label = family.presets.find((p) => p.id === preset)?.label ?? family.presets[0].label
  return (
    <div className="shop-card-preset">
      {tn('shop.presetIs', { name: label })}
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M9 5l7 7-7 7" />
      </svg>
    </div>
  )
}

// The kit as a profile header in small: the background, the avatar in the frame, the name in the style.
export function KitPreview({
  kit,
  preset,
  displayName,
  avatarUrl,
}: {
  kit: GlKit
  preset: string
  displayName: string
  avatarUrl: string | null
}) {
  const bg = resolveHeroBackground(joinHeroBg(kit.bg, preset))
  return (
    <div className="kit-preview" style={{ background: bg.base, '--hero-accent-rgb': bg.accentRgb } as CSSProperties}>
      <HeroBgLive bg={bg} variant="hero" />
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
      <div className="kits-head">
        <div className="kits-head-title">{tn('shop.kitsTitle')}</div>
        <div className="kits-head-sub">{tn('shop.kitCaption')}</div>
      </div>
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
            <div
              key={kit.kit}
              data-kit={kit.kit}
              className={`shop-card shop-card-legendary shop-card-stars kit-card${all ? ' shop-card-open' : ''}`}
              // A bought kit opens its window from the card itself (26.11.2026): the preset is chosen and saved there.
              onClick={all ? (e) => !(e.target as HTMLElement).closest('button') && onTryOn(kit) : undefined}
            >
              <KitPreview kit={kit} preset={preset} displayName={displayName} avatarUrl={avatarUrl} />
              <div className="shop-card-name">{kitTitle(kit)}</div>
              {all ? <PresetLine family={family} preset={preset} /> : <div className="kit-contents">{tn('shop.kitContents')}</div>}
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
              {!all && (
                <button className="challenge-swap-btn" onClick={() => onTryOn(kit)}>
                  {tn('shop.tryOn')}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
