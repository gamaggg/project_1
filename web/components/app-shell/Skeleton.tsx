'use client'

import type { CSSProperties } from 'react'

// Grey shimmering placeholders for what's still loading — the shape of the
// block that's coming, so it doesn't pop in and push the page down, and a
// list never says «пусто» before it knows. `.skel` in globals.css.

// Rows like the catch lists: a thumbnail and two lines.
export function SkeletonRows({ count = 3, thumb = 46, round = false, className }: { count?: number; thumb?: number; round?: boolean; className?: string }) {
  return (
    <div className={`skel-rows${className ? ` ${className}` : ''}`} aria-busy="true" aria-label="Загрузка">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skel-row" style={{ '--d': `${i * 90}ms` } as CSSProperties}>
          <span className="skel" style={{ width: thumb, height: thumb, borderRadius: round ? '50%' : 13, flex: '0 0 auto' }} />
          <span className="skel-row-lines">
            <span className="skel" style={{ width: '38%', height: 10 }} />
            <span className="skel" style={{ width: '62%', height: 13 }} />
          </span>
        </div>
      ))}
    </div>
  )
}

// One block of a given size.
export function SkeletonBlock({ height, width = '100%', radius = 16, style }: { height: number; width?: number | string; radius?: number; style?: CSSProperties }) {
  return <span className="skel skel-block" aria-hidden style={{ height, width, borderRadius: radius, ...style }} />
}
