'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { ART } from '@/components/clan2/BaseArt'
import { effectText } from '@/components/clan2/BaseScene'
import type { ProjectId, ProjectLevel } from '@/lib/clan2/types'
import { resolveCrest } from '@/lib/data/clanCrests'
import { tn, tnd } from '@/lib/i18n/runtime'

// «Постройка готова»: the moment a build finishes, in the manner of the HQ moments (HqMoment) and of the sector capture
// of solo play — the clan's sector, the scaffolding with the old level under it shaking, then at the hit it drops away,
// the new level springs up out of a puff of dust with sparks, a ring bursts, the label pops up and the new boost comes
// in under it with the level's pips. Played once for the whole clan (HqMomentOverlay), and on the showcase page.
export function BuildMoment({ id, level, crest, size = 260 }: { id: ProjectId; level: ProjectLevel; crest: unknown; size?: number }) {
  const c = resolveCrest(crest)
  const Art = ART[id]
  const r = size * 0.42
  const half = size / 2
  const hh = r * (Math.sqrt(3) / 2)
  const cy = 26 + hh
  const below = cy + hh + 10
  const height = Math.round(below + 62)
  const hex = [0, 1, 2, 3, 4, 5]
    .map((i) => {
      const a = (Math.PI / 3) * i
      return `${(half + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`
    })
    .join(' ')
  const old = level > 1 ? ((level - 1) as ProjectLevel) : null
  // The new level is measured (without its ground shadow) and blown up to fill the hexagon, so a flat dock is as big
  // on the screen as a tall lighthouse; the old level and the scaffolding stand on the same ground under it.
  const newRef = useRef<SVGGElement>(null)
  const [fit, setFit] = useState({ k: 1.6, dx: half, dy: cy + hh * 0.42 })
  useLayoutEffect(() => {
    const g = newRef.current
    if (!g) return
    const shadows = Array.from(g.querySelectorAll<SVGElement>('.c2-shadow'))
    shadows.forEach((el) => (el.style.display = 'none'))
    const b = g.getBBox()
    shadows.forEach((el) => (el.style.display = ''))
    if (!b.width || !b.height) return
    const k = Math.min(r * 1.25 / b.width, hh * 1.3 / b.height, 2.4)
    setFit({ k, dx: half - (b.x + b.width / 2) * k, dy: cy + 4 - (b.y + b.height / 2) * k })
  }, [id, level, r, hh, half, cy])
  return (
    <div className="hqx bmx" style={{ width: size, height, ['--hqx-own' as string]: c.primary, ['--hqx-them' as string]: '#1F9D55', ['--hqx-r' as string]: `${r}px`, ['--hqx-cy' as string]: `${cy}px` }}>
      <svg className="hqx-hex" width={size} height={height} viewBox={`0 0 ${size} ${height}`} aria-hidden>
        <polygon points={hex} fill={c.primary} fillOpacity={0.24} stroke={c.primary} strokeWidth={2.4} strokeLinejoin="round" />
      </svg>
      <span className="hqx-ring" />
      <svg className="bmx-art" width={size} height={height} viewBox={`0 0 ${size} ${height}`} overflow="visible" aria-hidden>
        <g transform={`translate(${fit.dx.toFixed(1)} ${fit.dy.toFixed(1)}) scale(${fit.k.toFixed(3)})`}>
        {/* before: the old level (or bare ground) under the scaffolding, the hammer at work */}
        <g className="bmx-before">
          {old && <Art level={old} p={c.primary} s={c.secondary} />}
          <g className="bmx-scaffold">
            <path d="M -34 4 L -30 -48 M 34 4 L 30 -48 M -32 -14 H 32 M -31 -32 H 31 M -34 4 L 30 -48 M 34 4 L -30 -48" stroke="#B98A4A" strokeWidth={2.4} fill="none" strokeLinecap="round" />
            <g className="c2-hammer">
              <rect x={-2} y={-66} width={4} height={18} rx={1.6} fill="#7B5127" />
              <rect x={-9} y={-70} width={18} height={8} rx={2} fill="#9AA2B1" stroke="#6F7686" strokeWidth={1} />
            </g>
          </g>
        </g>
        {/* after: the new level springs up */}
        <g className="bmx-new" ref={newRef}>
          <Art level={level} p={c.primary} s={c.secondary} />
        </g>
        <g className="bmx-fx">
          <ellipse cx={0} cy={4} rx={14} ry={4.5} className="bmx-dust" />
          {Array.from({ length: 10 }, (_, i) => (
            <circle key={i} cx={0} cy={-26} r={2.6 / fit.k * 1.6} className="bmx-spark" style={{ ['--a' as string]: `${i * 36}deg` }} />
          ))}
        </g>
        </g>
      </svg>
      <span className="bmx-pips" style={{ top: below }} aria-hidden>
        {[1, 2, 3].map((n) => (
          <i key={n} className={n < level ? 'on' : n === level ? 'gained' : ''} />
        ))}
      </span>
      <span className="bmx-eff" style={{ top: below + 20 }}>
        {effectText(id, level)}
      </span>
      <div className="hqx-label">
        <i />
        {tn('clan2.moment.built', { name: tnd(`clan2.project.${id}.name`), n: level })}
      </div>
    </div>
  )
}
