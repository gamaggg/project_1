import type { CountryId } from '@/lib/data/city'

// Country flags as small inline SVGs: the same on every phone (emoji flags are drawn as two
// letters on some systems), and no image to load. A rounded sticker, 3:2: the corners are cut by the
// svg's own border-radius (.flag in globals.css), not a clipPath with an id — several flags of one
// country sit on the page at once (every mounted screen), and url(#id) takes the first one in the
// document, which may be on a hidden screen, where it clips everything away.
export function Flag({ country, height = 18 }: { country: CountryId; height?: number }) {
  const width = Math.round((height * 3) / 2)
  return (
    <svg className="flag" width={width} height={height} viewBox="0 0 30 20" aria-hidden role="img">
      <g>
        {country === 'ru' ? (
          <>
            <rect width="30" height="7" fill="#FFFFFF" />
            <rect y="6.67" width="30" height="6.67" fill="#1C57A5" />
            <rect y="13.33" width="30" height="6.67" fill="#D52B1E" />
          </>
        ) : (
          <>
            <rect width="30" height="20" fill="#FFFFFF" />
            <rect x="13" width="4" height="20" fill="#E8112D" />
            <rect y="8" width="30" height="4" fill="#E8112D" />
            {[
              [6.5, 4],
              [23.5, 4],
              [6.5, 16],
              [23.5, 16],
            ].map(([x, y]) => (
              <g key={`${x}-${y}`} fill="#E8112D">
                <rect x={x - 0.8} y={y - 2.4} width="1.6" height="4.8" />
                <rect x={x - 2.4} y={y - 0.8} width="4.8" height="1.6" />
              </g>
            ))}
          </>
        )}
      </g>
      <rect width="30" height="20" rx="3" fill="none" stroke="rgba(23,24,27,0.18)" />
    </svg>
  )
}
