'use client'

import { hqBannerSvg, ruinsMarkerHtml } from '@/lib/clan2/live/hqMarker'
import { resolveCrest } from '@/lib/data/clanCrests'
import { tn } from '@/lib/i18n/runtime'

// The moments of a headquarters, played over its sector in the manner of the sector capture of solo play (the white
// label with a coloured dot, the ring that bursts on impact, the colour flooding the hexagon, the coins): a shield
// knocked off, a siege, a siege broken, the HQ fallen — for the clan that holds it — and, for the one that attacks,
// the shield it knocked off, the siege it started, the HQ it took.

export type HqMomentKind = 'hit' | 'siege' | 'saved' | 'fell' | 'captured'
export type HqMomentSide = 'defender' | 'attacker'

const SHIELD = 'M12 2.5l7.5 2.8v5.6c0 4.7-3.2 8.3-7.5 10.6-4.3-2.3-7.5-5.9-7.5-10.6V5.3z'

export function HqMoment({
  kind,
  side,
  crest,
  attackerCrest,
  clanName,
  defense = 0,
  minutes = 90,
  coins = 0,
  name,
  size = 240,
}: {
  kind: HqMomentKind
  side: HqMomentSide
  // the crest of the clan whose HQ it is; the attackers' (for the HQ taken)
  crest: unknown
  attackerCrest?: unknown
  clanName?: string
  // shields left after the moment (hit), the siege's minutes, coins (the reward, the loot)
  defense?: number
  minutes?: number
  coins?: number
  // who broke the siege
  name?: string
  size?: number
}) {
  const own = resolveCrest(crest).primary
  const them = resolveCrest(attackerCrest ?? crest).primary
  // A regular flat-topped hexagon, wide like a sector on the map (hex-aspect: 2 : √3). The label sits on its top edge,
  // the shields, the siege clock and the coins go under it, so the box is taller than it is wide.
  const r = size * 0.42
  const half = size / 2
  const hh = r * (Math.sqrt(3) / 2)
  const cy = 26 + hh
  const below = cy + hh + 10
  const height = Math.round(below + 66)
  const hex = [0, 1, 2, 3, 4, 5]
    .map((i) => {
      const a = (Math.PI / 3) * i
      return `${(half + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`
    })
    .join(' ')
  const clip = `hqx-${kind}-${side}-${size}`
  const floods = kind === 'captured' || kind === 'fell'
  const danger = kind === 'hit' || kind === 'siege' || kind === 'fell'
  const label =
    kind === 'hit'
      ? side === 'attacker'
        ? tn('clan2.moment.hitAttacker', { n: defense })
        : tn('clan2.moment.hitDefender', { n: defense })
      : kind === 'siege'
        ? side === 'attacker'
          ? tn('clan2.moment.siegeAttacker', { clan: clanName ?? '', m: minutes })
          : tn('clan2.moment.siegeDefender', { m: minutes })
        : kind === 'saved'
          ? tn('clan2.moment.saved', { name: name ?? '' })
          : kind === 'fell'
            ? tn('clan2.moment.fell')
            : tn('clan2.moment.captured', { clan: clanName ?? '' })
  const bannerW = size * 0.28
  const bannerH = bannerW * (124 / 84)
  // The shields under the banner: lost (hit), all gone and blinking (siege), one back (saved).
  const shields = kind === 'hit' ? defense + 1 : kind === 'saved' ? 1 : 0
  return (
    <div className={`hqx hqx-${kind} hqx-${side}${danger ? ' danger' : ''}`} style={{ width: size, height, ['--hqx-own' as string]: own, ['--hqx-them' as string]: them, ['--hqx-r' as string]: `${r}px`, ['--hqx-cy' as string]: `${cy}px` }}>
      <svg className="hqx-hex" width={size} height={height} viewBox={`0 0 ${size} ${height}`} aria-hidden>
        <defs>
          <clipPath id={clip}>
            <polygon points={hex} />
          </clipPath>
        </defs>
        <polygon className="hqx-hex-old" points={hex} fill={own} fillOpacity={0.24} stroke={own} strokeWidth={2.4} strokeLinejoin="round" />
        {floods && (
          <g clipPath={`url(#${clip})`}>
            <circle className="hqx-flood" cx={half} cy={cy} r={r * 1.05} fill={them} fillOpacity={0.36} />
          </g>
        )}
        {floods && <polygon className="hqx-hex-new" points={hex} fill="none" stroke={them} strokeWidth={2.4} strokeLinejoin="round" />}
        {kind === 'siege' && <polygon className="hqx-alarm" points={hex} fill="none" stroke="#E24B4A" strokeWidth={4} strokeLinejoin="round" />}
      </svg>
      <span className="hqx-ring" />
      {/* the HQ's banner: shaken by a hit, trembling under a siege, knocked over when it falls */}
      <span className="hqx-banner" style={{ width: bannerW, height: bannerH, left: half - bannerW / 2, top: cy - bannerH * 0.72 }} dangerouslySetInnerHTML={{ __html: hqBannerSvg(crest, bannerW, bannerH) }} />
      {kind === 'captured' && <span className="hqx-banner hqx-banner-new" style={{ width: bannerW, height: bannerH, left: half - bannerW / 2, top: cy - bannerH * 0.72 }} dangerouslySetInnerHTML={{ __html: hqBannerSvg(attackerCrest ?? crest, bannerW, bannerH) }} />}
      {kind === 'fell' && <span className="hqx-ruins" style={{ left: half - 24, top: cy - 26 }} dangerouslySetInnerHTML={{ __html: ruinsMarkerHtml('', 2) }} />}
      {/* the shields */}
      {(kind === 'hit' || kind === 'siege' || kind === 'saved') && (
        <span className="hqx-shields" style={{ top: below }}>
          {[0, 1, 2].map((i) => {
            const lost = kind === 'hit' && i === defense
            const on = i < shields && !lost
            const cls = lost ? 'lost' : kind === 'saved' && i === 0 ? 'gained' : on ? 'on' : ''
            return (
              <svg key={i} className={cls} width="18" height="22" viewBox="3.5 1.5 17 21" aria-hidden>
                <path d={SHIELD} />
                {lost && <path className="hqx-crack" d="M12 4 L10.4 9 L13.2 11.4 L11 17" fill="none" />}
              </svg>
            )
          })}
        </span>
      )}
      {kind === 'siege' && (
        <span className="hqx-clock" style={{ top: below + 36 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
            <circle cx="12" cy="13" r="8" />
            <path d="M12 9v4l2.5 2.5M9 2h6" />
          </svg>
          {tn('clan2.moment.minutes', { m: minutes })}
        </span>
      )}
      <div className="hqx-label">
        <i />
        {label}
      </div>
      {coins !== 0 && (kind === 'saved' || kind === 'fell' || kind === 'captured') && <span className={`hqx-coins${coins < 0 ? ' minus' : ''}`} style={{ top: kind === 'saved' ? below + 36 : below + 4 }}>{coins > 0 ? `+${coins}` : `−${Math.abs(coins)}`}</span>}
    </div>
  )
}
