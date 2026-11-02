'use client'

import type { Catch } from '@/lib/data/types'
import { formatCatchMeta } from '@/lib/format'
import { tn } from '@/lib/i18n'
import { thumbUrl } from '@/lib/supabase/imageUrl'

// «Трофеи» on both profiles (own and someone else's): up to three biggest sized
// catches (trophies() in lib/data/achievements.ts), a tap opens the photo.
export function ProfileTrophies({ catches, onOpenPhoto }: { catches: Catch[]; onOpenPhoto: (id: number) => void }) {
  if (!catches.length) return null
  return (
    <>
      <div className="section-title" style={{ marginTop: 24 }}>
        {tn('profile.trophies')}
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        {catches.map((c, i) => (
          <button
            key={c.id}
            className="terr-list-item tap-scale"
            style={{ gap: 14, padding: 16, borderBottom: i < catches.length - 1 ? '1px solid var(--line)' : 'none' }}
            onClick={() => onOpenPhoto(c.id)}
          >
            <div className="fish-thumb" style={{ width: 52, height: 52, flex: '0 0 auto' }}>
              <img src={thumbUrl(c.photoUrl, 720)} alt={c.speciesName} loading="lazy" decoding="async" />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{c.speciesName}</div>
              <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 700, marginTop: 2 }}>{formatCatchMeta(c.lengthCm, c.weightKg)}</div>
            </div>
          </button>
        ))}
      </div>
    </>
  )
}
