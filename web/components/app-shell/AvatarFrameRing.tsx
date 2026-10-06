import type { CSSProperties } from 'react'
import type { AvatarFrame } from '@/lib/data/shopItems'

// The ring drawn behind an avatar (profile, someone else's profile, the
// shop card). Plain frames paint their gradient straight on the ring; a
// premium frame (fx) instead hands it over as --ring so its two layers can
// share it — a blurred copy that glows behind and the sharp ring on top
// (see .avatar-frame-fx in globals.css). The royal frame adds three
// sparkles riding the edge. The jackpot frames (Катран, Сом) get a gold rim,
// the katran's white spots or the catfish's rising bubbles, and their fish
// swimming round on top of everything — a sibling of the ring, since the
// turning ring is its own stacking context and the photo paints over it.
export function AvatarFrameRing({ frame }: { frame: AvatarFrame | null | undefined }) {
  if (!frame?.fx) {
    return <div className={`avatar-frame-ring${frame?.glow ? ' avatar-frame-glow' : ''}`} style={{ background: frame?.ring }} />
  }
  const ring = (
    <div className={`avatar-frame-ring avatar-frame-fx fx-${frame.fx}`} style={{ '--ring': frame.ring } as CSSProperties}>
      {frame.fx === 'royal' &&
        [0, 120, 240].map((a, i) => <i key={a} className="frame-sparkle" style={{ '--a': `${a}deg`, '--d': `${i * -0.9}s` } as CSSProperties} />)}
      {frame.fx === 'katran' &&
        [20, 95, 160, 230, 300].map((a, i) => <i key={a} className="frame-spot" style={{ '--a': `${a}deg`, '--d': `${i * -0.7}s` } as CSSProperties} />)}
      {frame.fx === 'som' &&
        [35, 150, 265].map((a, i) => <i key={a} className="frame-bubble" style={{ '--a': `${a}deg`, '--d': `${i * -1.1}s` } as CSSProperties} />)}
    </div>
  )
  if (!frame.swimmer) return ring
  return (
    <>
      {ring}
      <div className={`frame-swim swim-${frame.fx}`} aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element -- a small static sprite from public/slots */}
        <img src={frame.swimmer} alt="" draggable={false} />
      </div>
    </>
  )
}
