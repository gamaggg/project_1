import type { CSSProperties } from 'react'
import type { AvatarFrame } from '@/lib/data/shopItems'

// The ring drawn behind an avatar (profile, someone else's profile, the
// shop card). Plain frames paint their gradient straight on the ring; a
// premium frame (fx) instead hands it over as --ring so its two layers can
// share it — a blurred copy that glows behind and the sharp ring on top
// (see .avatar-frame-fx in globals.css). The royal frame adds three
// sparkles riding the edge.
export function AvatarFrameRing({ frame }: { frame: AvatarFrame | null | undefined }) {
  if (!frame?.fx) {
    return <div className={`avatar-frame-ring${frame?.glow ? ' avatar-frame-glow' : ''}`} style={{ background: frame?.ring }} />
  }
  return (
    <div className={`avatar-frame-ring avatar-frame-fx fx-${frame.fx}`} style={{ '--ring': frame.ring } as CSSProperties}>
      {frame.fx === 'royal' &&
        [0, 120, 240].map((a, i) => <i key={a} className="frame-sparkle" style={{ '--a': `${a}deg`, '--d': `${i * -0.9}s` } as CSSProperties} />)}
    </div>
  )
}
