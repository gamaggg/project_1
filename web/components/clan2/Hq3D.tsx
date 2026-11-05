'use client'

import { ClanCrest } from '@/components/app-shell/ClanCrest'

// The headquarters on the map: the clan's crest stood up on a post over a
// round base, in perspective — the map cannot tilt, so the volume is made of
// CSS 3D: a plate that turns slowly on its post (with thickness and a shadow),
// a base, a soft float. Under siege a red ring pulses round the base and the
// plate shakes.
export function Hq3D({ crest, x, y, siege, enemy, onClick, label }: { crest: unknown; x: number; y: number; siege?: boolean; enemy?: boolean; onClick?: () => void; label: string }) {
  return (
    <button type="button" className={`c2-hq3d${siege ? ' siege' : ''}${enemy ? ' enemy' : ''}`} style={{ left: x, top: y }} onClick={onClick} aria-label={label}>
      <span className="c2-hq3d-shadow" />
      <span className="c2-hq3d-pad" />
      <span className="c2-hq3d-pole" />
      <span className="c2-hq3d-plate">
        <span className="c2-hq3d-back" />
        <span className="c2-hq3d-face">
          <ClanCrest crest={crest} size={40} shine={!enemy} />
        </span>
      </span>
      {siege && <span className="c2-hq3d-ring" />}
    </button>
  )
}
