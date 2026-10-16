import type { CSSProperties } from 'react'
import { tn } from '@/lib/i18n/runtime'

// The loader: a hexagon of 24 small triangles that light up one after another
// round it — after «Elite Dangerous Inspired Loader» by jpanter (CodePen
// PWWQXK), pure CSS. `size` scales it (1 = 96px wide); the colour is the app's
// orange, taken from --hl-color.
// Each row is its triangles left to right: the direction (up/down), whether it
// is on the outer ring or the inner one, and its place in the ring — the place
// sets when it lights.
type T = ['up' | 'down', 'outer' | 'inner', number]
const ROWS: T[][] = [
  [['up', 'outer', 18], ['down', 'outer', 17], ['up', 'outer', 16], ['down', 'outer', 15], ['up', 'outer', 14]],
  [['up', 'outer', 1], ['down', 'outer', 2], ['up', 'inner', 6], ['down', 'inner', 5], ['up', 'inner', 4], ['down', 'outer', 13], ['up', 'outer', 12]],
  [['down', 'outer', 3], ['up', 'outer', 4], ['down', 'inner', 1], ['up', 'inner', 2], ['down', 'inner', 3], ['up', 'outer', 11], ['down', 'outer', 10]],
  [['down', 'outer', 5], ['up', 'outer', 6], ['down', 'outer', 7], ['up', 'outer', 8], ['down', 'outer', 9]],
]

export function HexLoader({ size = 1, className }: { size?: number; className?: string }) {
  // Drawn at its own size in whole pixels and scaled as a whole, so the
  // triangles keep their exact shape at any size (sizing the borders in
  // fractions of a pixel bent them).
  return (
    <div className={`hexloader${className ? ` ${className}` : ''}`} style={{ '--hl-s': size } as CSSProperties} role="status" aria-label={tn('common.loading')}>
      <div className="hexloader-inner">
        {ROWS.map((row, r) => (
          <div className="hexloader-row" key={r}>
            {row.map(([dir, ring, n]) => (
              <i key={`${ring}${n}`} className={`hexloader-tri ${dir}`} style={{ animationDelay: `${-(n / (ring === 'outer' ? 18 : 6))}s` }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
