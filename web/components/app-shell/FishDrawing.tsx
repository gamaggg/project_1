import { speciesImageUrl } from '@/lib/data/speciesImages'
import { SwimmingFish } from '@/components/app-shell/SwimmingFish'

// A fish's drawing (public/fish, by its base key: okun and okun_msk are one picture), or a quiet
// outline when the fish has no picture. Used by the species picker, the «new species» card after
// a catch and «Где это?»; the size comes from `className`. `swim`: the fish swims in place (SwimmingFish) — only
// where one fish is shown at a time (the «new species» card), never in lists.
export function FishDrawing({ speciesKey, className, hd = false, swim = false }: { speciesKey: string; className: string; hd?: boolean; swim?: boolean }) {
  const src = speciesImageUrl(speciesKey, hd)
  if (src && swim) return <SwimmingFish src={src} className={className} />
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- small static webp from /public/fish
    return <img className={className} src={src} alt="" loading="lazy" decoding="async" draggable={false} />
  }
  return (
    <span className={`${className} fish-drawing-none`} aria-hidden>
      <svg viewBox="0 0 48 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
        <path d="M4 12c6-8 18-9 28-3l10-5v16l-10-5C22 21 10 20 4 12z" />
        <circle cx="12" cy="11" r="1.4" fill="currentColor" stroke="none" />
      </svg>
    </span>
  )
}
