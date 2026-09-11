'use client'

import { CITY_LIST, type CityId } from '@/lib/data/city'

// Rendered by FishZoneApp itself, not nested inside a screen's scrolling
// `.screen-inner` — same reason as EditProfileModal/ChangeColorModal (a
// position:absolute overlay inside a scrolled container inherits its scroll
// offset). Opened from the Profile screen's "Город" row.
export function CityPickerModal({ city, onChange, onClose }: { city: CityId; onChange: (id: CityId) => void; onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-card-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-close tap-scale" onClick={onClose}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.4" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </div>
        <div className="modal-title" style={{ textAlign: 'center' }}>
          Город
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
          {CITY_LIST.map((c) => (
            <button
              key={c.id}
              className="btn-secondary"
              style={c.id === city ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined}
              onClick={() => {
                onChange(c.id)
                onClose()
              }}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
