'use client'

import { memo, useId } from 'react'
import { crestShape, crestSymbol, resolveCrest, shadeHex } from '@/lib/data/clanCrests'

type Part = ReturnType<typeof crestSymbol>['parts'][number]

function SymbolParts({ parts, fg, bg }: { parts: Part[]; fg: string; bg: string }) {
  return (
    <>
      {parts.map((p, i) => {
        if ('circle' in p) {
          const [cx, cy, r] = p.circle
          return p.mode === 'stroke' ? (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={fg} strokeWidth={p.w ?? 3} />
          ) : (
            <circle key={i} cx={cx} cy={cy} r={r} fill={p.mode === 'fill-bg' ? bg : fg} />
          )
        }
        if (p.mode === 'fill' || p.mode === 'fill-bg') return <path key={i} d={p.d} fill={p.mode === 'fill' ? fg : bg} />
        return (
          <path
            key={i}
            d={p.d}
            fill="none"
            stroke={p.mode === 'stroke' ? fg : bg}
            strokeWidth={('w' in p ? p.w : undefined) ?? 3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )
      })}
    </>
  )
}

// A clan's crest at any size. Small sizes (lists, next to names, map
// labels) drop the gradient, gloss and shine — they'd be invisible at 16px
// and there can be dozens on screen; only the big hero crest animates.
export const ClanCrest = memo(function ClanCrest({
  crest,
  size = 40,
  shine = false,
  golden = false,
  title,
  className,
}: {
  crest: unknown
  size?: number
  shine?: boolean
  golden?: boolean
  title?: string
  className?: string
}) {
  const c = resolveCrest(crest)
  const shape = crestShape(c.shape)
  const symbol = crestSymbol(c.symbol)
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const small = size <= 28
  const tiny = size <= 18
  const edge = shadeHex(c.primary, -0.38)
  const top = shadeHex(c.primary, 0.24)

  return (
    <span
      className={`clan-crest${className ? ` ${className}` : ''}`}
      style={{ width: size, height: size }}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <svg viewBox="0 0 100 100" width={size} height={size}>
        {!small && (
          <defs>
            <linearGradient id={`cg${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={top} />
              <stop offset="0.65" stopColor={c.primary} />
              <stop offset="1" stopColor={shadeHex(c.primary, -0.12)} />
            </linearGradient>
            <clipPath id={`cc${uid}`}>
              <path d={shape.d} />
            </clipPath>
          </defs>
        )}
        {golden && <path d={shape.d} fill="none" stroke="#F0C35A" strokeWidth={11} strokeLinejoin="round" />}
        <path d={shape.d} fill={small ? c.primary : `url(#cg${uid})`} stroke={edge} strokeWidth={small ? 5 : 3.5} strokeLinejoin="round" />
        {!tiny && (
          <g transform="translate(50 50) scale(.8) translate(-50 -50)">
            <path d={shape.d} fill="none" stroke={c.secondary} strokeWidth={small ? 6.5 : 4.5} strokeLinejoin="round" />
          </g>
        )}
        {!small && (
          <g transform="translate(22.4 23.8) scale(1.15)" opacity={0.3}>
            <SymbolParts parts={symbol.parts} fg={edge} bg={edge} />
          </g>
        )}
        <g transform="translate(22.4 22.4) scale(1.15)">
          <SymbolParts parts={symbol.parts} fg="#FFFFFF" bg={c.primary} />
        </g>
        {!small && (
          <g clipPath={`url(#cc${uid})`}>
            <ellipse cx="50" cy="6" rx="48" ry="28" fill="#FFFFFF" opacity={0.16} />
            {shine && <rect className="clan-crest-shine" x="-40" y="-10" width="22" height="120" fill="#FFFFFF" opacity={0.32} />}
          </g>
        )}
      </svg>
    </span>
  )
})
