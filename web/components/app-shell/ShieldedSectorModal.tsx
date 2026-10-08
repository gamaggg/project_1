'use client'

import { ClanCrest } from '@/components/app-shell/ClanCrest'
import { thumbUrl } from '@/lib/supabase/imageUrl'
import { useNow } from '@/lib/useNow'

// A catch sent to someone else's sector while a shield is up (confirm_catch's
// SHIELDED:<until>): it can't count there, but the photo and the fish needn't
// be lost — «Добавить в дневник» keeps them in the angler's own diary, with
// the sector left as it is. «Закрыть» just closes, leaving the catch form as
// it was. The hero is the sector itself: its hexagon with the holder's face,
// ringed by the shield — the ring is what's left of the shield's 24 hours.
const SHIELD_HOURS = 24
const RING_R = 58
const RING_C = 2 * Math.PI * RING_R

export function ShieldedSectorModal({
  territoryId,
  until,
  ownerName,
  ownerAvatarUrl,
  ownerClanCrest,
  ownerClanName,
  catchPhotoUrl,
  speciesName,
  catchMeta,
  saving,
  onAddToDiary,
  onClose,
}: {
  territoryId: string
  until: string
  ownerName: string | null
  ownerAvatarUrl: string | null
  ownerClanCrest: unknown
  ownerClanName: string | null
  catchPhotoUrl: string
  speciesName: string
  catchMeta: string
  saving: boolean
  onAddToDiary: () => void
  onClose: () => void
}) {
  const now = useNow(30_000)
  const leftMs = Math.max(0, new Date(until).getTime() - now)
  const minutes = Math.max(1, Math.ceil(leftMs / 60_000))
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const share = Math.min(1, leftMs / (SHIELD_HOURS * 3_600_000))

  return (
    <div className="modal-overlay" onClick={saving ? undefined : onClose}>
      <div className="modal-card shield-modal" role="dialog" aria-label={`${territoryId} под щитом`} onClick={(e) => e.stopPropagation()}>
        <div className="shield-modal-hero" aria-hidden>
          <svg className="shield-modal-ring" width="140" height="140" viewBox="0 0 140 140">
            <defs>
              <linearGradient id="shield-ring-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#5FD3C0" />
                <stop offset="1" stopColor="#0E8074" />
              </linearGradient>
            </defs>
            <circle cx="70" cy="70" r={RING_R} fill="none" stroke="rgba(14,128,116,.14)" strokeWidth="7" />
            <circle
              className="shield-modal-ring-left"
              cx="70"
              cy="70"
              r={RING_R}
              fill="none"
              stroke="url(#shield-ring-grad)"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={RING_C}
              strokeDashoffset={RING_C * (1 - share)}
              style={{ ['--ring-c' as string]: RING_C }}
              transform="rotate(-90 70 70)"
            />
          </svg>
          <div className="shield-modal-hex">
            <div className="shield-modal-hex-in">
              {ownerAvatarUrl ? <img src={thumbUrl(ownerAvatarUrl, 192)} alt="" decoding="async" /> : <span>{(ownerName ?? '?').slice(0, 2).toUpperCase()}</span>}
            </div>
          </div>
          <div className="shield-modal-badge">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff">
              <path d="M12 2l8 3v6c0 5-3.4 8.7-8 11-4.6-2.3-8-6-8-11V5l8-3z" />
            </svg>
          </div>
        </div>

        <div className="modal-title shield-modal-title">{territoryId} под щитом</div>
        {ownerName && (
          <div className="shield-modal-owner">
            держит <b>{ownerName}</b>
            {ownerClanCrest != null && <ClanCrest crest={ownerClanCrest} size={16} title={ownerClanName ?? undefined} />}
          </div>
        )}

        <div className="shield-modal-timer">
          <b>
            {h > 0 && (
              <>
                {h}
                <small>ч</small>{' '}
              </>
            )}
            {m}
            <small>мин</small>
          </b>
          <span>до конца щита — пока он стоит, чужой улов здесь не засчитать</span>
        </div>

        <div className="shield-modal-catch">
          <img src={thumbUrl(catchPhotoUrl, 160)} alt="" decoding="async" />
          <div>
            <b>{speciesName}</b>
            <span>{catchMeta || 'Твой улов'}</span>
          </div>
        </div>

        <button className="btn-primary" disabled={saving} onClick={onAddToDiary}>
          {saving ? 'Сохраняем…' : 'Добавить в дневник'}
        </button>
        <button className="shield-modal-close" disabled={saving} onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  )
}
