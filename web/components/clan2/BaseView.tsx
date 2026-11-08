'use client'

import { useId, useState } from 'react'
import { ART } from '@/components/clan2/BaseArt'
import { HEX, HQ_AT, MAP_ZOOM_OUT, MID, OX, OY, PILL_DX, SCALE, SPOTS, VH, VW, W, ART_VB, H, px, py } from '@/components/clan2/BaseScene'
import { hqBannerSvg, hqOutlineColor } from '@/lib/clan2/live/hqMarker'
import { PROJECT_IDS } from '@/lib/clan2/rules'
import type { ProjectId, ProjectLevel } from '@/lib/clan2/types'
import { resolveCrest } from '@/lib/data/clanCrests'
import { tnd } from '@/lib/i18n/runtime'
import { previewStaticUrl } from '@/lib/mapbox/rasterTiles'

// Another clan's base, to look at: the same sector on the real map, the HQ banner in the middle and the six plots as
// on the clan's own base (BaseScene), but nothing to press — what is built stands there with its level, an empty plot
// stays empty. Shown from that clan's HQ on the map (components/clan2/live/SectorHq.tsx).
export function BaseView({ crest, projects, geo }: { crest: unknown; projects: Record<ProjectId, ProjectLevel>; geo: { lat: number; lng: number; widthDeg: number } | null }) {
  const clip = `c2bv-${useId().replace(/:/g, '')}`
  const [mapOk, setMapOk] = useState(true)
  const c = resolveCrest(crest)
  const outline = hqOutlineColor(crest)
  const mapUrl = geo && mapOk ? previewStaticUrl(geo.lat, geo.lng, geo.widthDeg, VW, VH, W / MAP_ZOOM_OUT) : null
  const hexAbs = HEX.split(' ')
    .map((q) => {
      const [x, y] = q.split(',').map(Number)
      return `${x + OX},${y + OY}`
    })
    .join(' L')
  return (
    <div className="c2-base-hex c2-base-view" style={{ ['--clan' as string]: c.primary, ['--clan-dark' as string]: outline }}>
      <svg className="c2-base-svg" viewBox={`0 0 ${VW} ${VH}`} aria-hidden="true">
        <defs>
          <clipPath id={clip}>
            <polygon points={HEX} />
          </clipPath>
        </defs>
        <rect width={VW} height={VH} fill="#EEF1F4" />
        {mapUrl && <image href={mapUrl} x={0} y={0} width={VW} height={VH} preserveAspectRatio="none" onError={() => setMapOk(false)} />}
        <path d={`M0 0H${VW}V${VH}H0Z M${hexAbs}Z`} fill="#fff" fillOpacity={0.4} fillRule="evenodd" />
        <g transform={`translate(${OX} ${OY})`}>
          <g clipPath={`url(#${clip})`}>
            <rect width={W} height={H} fill={c.primary} opacity={0.26} />
            {PROJECT_IDS.map((id) => (
              <path key={id} d={`M ${MID.x} ${MID.y} L ${SPOTS[id].x} ${SPOTS[id].y}`} stroke="#fff" strokeWidth={7} strokeLinecap="round" opacity={0.85} />
            ))}
          </g>
          <polygon points={HEX} transform="translate(10 8.66) scale(.95)" fill="none" stroke="#fff" strokeOpacity={0.5} strokeWidth={2} strokeLinejoin="round" />
          <polygon points={HEX} fill="none" stroke={c.primary} strokeOpacity={0.3} strokeWidth={9} strokeLinejoin="round" />
          <polygon points={HEX} fill="none" stroke={c.primary} strokeWidth={3} strokeLinejoin="round" />
        </g>
      </svg>
      <span className="c2-base-hq" style={{ left: px(HQ_AT.x), top: py(HQ_AT.y) }}>
        <span className="c2-base-hq-art" dangerouslySetInnerHTML={{ __html: hqBannerSvg(crest, 62, 92) }} />
      </span>
      {PROJECT_IDS.map((id) => {
        const lv = projects[id]
        const Art = ART[id]
        const pos = SPOTS[id]
        return (
          <span key={id} className={`c2-plot view${lv === 0 ? ' empty' : ''}`} style={{ left: px(pos.x), top: py(pos.y), zIndex: Math.round(pos.y) }}>
            {lv > 0 && (
              <svg className="c2-plot-svg" viewBox={ART_VB} overflow="visible" aria-hidden="true">
                <g transform={`scale(${SCALE[id]})`}>
                  <Art level={lv} p={c.primary} s={c.secondary} />
                </g>
              </svg>
            )}
            {lv > 0 && <span className={`c2-plot-badge ${lv === 3 ? 'max' : 'lv'}`}>{lv}</span>}
            <span className="c2-base-pill" style={PILL_DX[id] ? { ['--pill-dx' as string]: `${PILL_DX[id]}%` } : undefined}>
              <span>{tnd(`clan2.project.${id}.name`)}</span>
            </span>
          </span>
        )
      })}
    </div>
  )
}
