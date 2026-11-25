'use client'

import { AuroraGL } from '@/components/app-shell/AuroraGL'
import { AURORA_PRESETS, matchingPreset, presetSettings, type AuroraSettings } from '@/lib/data/auroraPresets'
import { tn } from '@/lib/i18n/runtime'

// The player's own northern lights (25.11.2026): a live preview and the six ready presets — nothing to tune (owner:
// «only presets, no fine settings»). Controlled: the owner holds the settings and decides what «Сохранить» does (it is the
// profile's background).
export function AuroraCustomizer({
  value,
  onChange,
  name,
  children,
}: {
  value: AuroraSettings
  onChange: (next: AuroraSettings) => void
  // The sample line in the preview (the player's name), so legibility shows.
  name: string
  // The buttons under the presets («Сохранить» …), up to the owner.
  children?: React.ReactNode
}) {
  const active = matchingPreset(value)
  return (
    <div className="aur-cz">
      <div className="aur-preview">
        <AuroraGL {...value} />
        <div className="aur-preview-avatar">{name.slice(0, 2).toUpperCase()}</div>
        <div className="aur-preview-name">{name}</div>
      </div>

      <div className="aur-label">{tn('aurora.presets')}</div>
      <div className="aur-presets">
        {AURORA_PRESETS.map((p) => (
          <button key={p.id} type="button" className={`filter-chip${active === p.id ? ' active' : ''}`} onClick={() => onChange(presetSettings(p.id))}>
            {p.label}
          </button>
        ))}
      </div>
      {children}
    </div>
  )
}
