'use client'

import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

// The admin tools in the profile (02.11): one dark «Управление» card instead
// of a column of up to eleven buttons, as in the approved mockup. A tap opens
// a sheet of tiles in three groups; what each tile opens is unchanged. An
// admin with a single tool gets the same card, and it opens that tool
// straight away.
export type AdminTone = 'mod' | 'data' | 'manage'
export type AdminItem = { id: string; label: string; icon: ReactNode; tone: AdminTone; badge?: number; onClick: () => void }

const stroke = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

const GROUPS: { tone: AdminTone; title: string }[] = [
  { tone: 'mod', title: 'Модерация' },
  { tone: 'data', title: 'Данные' },
  { tone: 'manage', title: 'Управление' },
]

// active: the profile is on screen with no admin window over it. A tile
// closes the sheet and opens its screen or window; once the profile is
// active again (back from the screen, the window closed) the sheet comes
// back, so «Назад» returns to «Управление», not to the bare profile.
export function AdminPanel({ items, active }: { items: AdminItem[]; active: boolean }) {
  const [open, setOpen] = useState(false)
  const [returnToSheet, setReturnToSheet] = useState(false)
  // Adjusted while rendering, not in an effect: the tile's own click sets
  // returnToSheet together with the screen or window it opens (one batch),
  // so this only fires once the profile is active again.
  if (active && returnToSheet) {
    setReturnToSheet(false)
    setOpen(true)
  }
  if (items.length === 0) return null
  const total = items.reduce((n, i) => n + (i.badge ?? 0), 0)
  const single = items.length === 1 ? items[0] : null

  return (
    <>
      <button className="profile-admin-card tap-scale" onClick={() => (single ? single.onClick() : setOpen(true))}>
        <span className="profile-admin-shield" aria-hidden>
          <svg {...stroke} width={24} height={24}>
            <path d="M12 21a12 12 0 0 1-8.5-15 12 12 0 0 0 8.5-3 12 12 0 0 0 8.5 3c.568 1.933.635 3.957.223 5.89" />
            <circle cx="19" cy="19" r="2" />
            <path d="M19 15.5V17M19 21v1.5M22.03 17.25l-1.3.75M17.27 20l-1.3.75M15.97 17.25l1.3.75M20.73 20l1.3.75" />
          </svg>
        </span>
        <span className="profile-clan-text">
          <span className="profile-admin-title">Управление</span>
          {/* The super admin's card reads as in the mockup; an admin's names
              just the tools they were given («Жалобы на фото, Статистика»). */}
          <span className="profile-admin-sub">{items.some((i) => i.id === 'coins') ? 'Жалобы, статистика, монеты…' : items.map((i) => i.label).join(', ')}</span>
        </span>
        {total > 0 && <span className="profile-admin-badge">{total}</span>}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flex: '0 0 auto', opacity: 0.7 }}>
          <path d="M9 5l7 7-7 7" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div className="move-sheet-overlay" onClick={() => setOpen(false)}>
            <div className="move-sheet admin-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Управление">
              <div className="move-sheet-handle" />
              <div className="admin-sheet-scroll">
                <div className="admin-sheet-title">Управление</div>
                {GROUPS.map((g) => {
                  const list = items.filter((i) => i.tone === g.tone)
                  if (list.length === 0) return null
                  return (
                    <div key={g.tone}>
                      <div className="admin-sheet-group">{g.title}</div>
                      <div className="admin-sheet-grid">
                        {list.map((i) => (
                          <button
                            key={i.id}
                            className={`admin-tile admin-tone-${i.tone} tap-scale`}
                            onClick={() => {
                              setOpen(false)
                              setReturnToSheet(true)
                              i.onClick()
                            }}
                          >
                            <span className="admin-tile-icon" aria-hidden>
                              {i.icon}
                              {!!i.badge && <span className="admin-tile-badge">{i.badge}</span>}
                            </span>
                            <span className="admin-tile-label">{i.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}

// The icons of the approved mockup (Tabler outline, MIT). «Прокруты слотов»
// is a slot machine in the same line style: three reels and the lever.
export const ADMIN_ICONS = {
  reports: (
    <svg {...stroke}>
      <path d="M5 5a5 5 0 0 1 7 0 5 5 0 0 0 7 0v9a5 5 0 0 1-7 0 5 5 0 0 0-7 0V5zM5 21v-7" />
    </svg>
  ),
  panoramas: (
    <svg {...stroke}>
      <path d="M9 11a3 3 0 1 0 6 0 3 3 0 0 0-6 0" />
      <path d="M15 19.32l-1.59 1.58a2 2 0 0 1-2.82 0l-4.25-4.24a8 8 0 1 1 13.66-5.59" />
      <path d="M19 22v.01M19 19a2 2 0 0 0 .91-3.78 1.98 1.98 0 0 0-2.41.48" />
    </svg>
  ),
  stats: (
    <svg {...stroke}>
      <path d="M3 13a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM15 9a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1zM9 5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1zM4 20h14" />
    </svg>
  ),
  limits: (
    <svg {...stroke}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="1" />
      <path d="M13.41 10.59 16 8M7 12a5 5 0 0 1 5-5" />
    </svg>
  ),
  log: (
    <svg {...stroke}>
      <path d="M12 8v4l2 2M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5" />
    </svg>
  ),
  access: (
    <svg {...stroke}>
      <path d="M16.56 3.84l3.6 3.6a2.88 2.88 0 0 1 0 4.07l-2.64 2.64a2.88 2.88 0 0 1-4.07 0l-.3-.3-6.56 6.56a2 2 0 0 1-1.24.58l-.18.01H4a1 1 0 0 1-1-1v-1.17a2 2 0 0 1 .47-1.28l.12-.13.41-.42h2v-2h2v-2l2.14-2.14-.3-.3a2.88 2.88 0 0 1 0-4.07l2.64-2.64a2.88 2.88 0 0 1 4.07 0zM15 9h.01" />
    </svg>
  ),
  post: (
    <svg {...stroke}>
      <path d="M18 8a3 3 0 0 1 0 6M10 8v11a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-5" />
      <path d="M12 8l4.52-3.77a.9.9 0 0 1 1.48.69v12.16a.9.9 0 0 1-1.48.69L12 14H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1h8" />
    </svg>
  ),
  publicId: (
    <svg {...stroke}>
      <path d="M3 7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z" />
      <circle cx="9" cy="10" r="2" />
      <path d="M15 8h2M15 12h2M7 16h10" />
    </svg>
  ),
  coins: (
    <svg {...stroke}>
      <circle cx="12" cy="12" r="9" />
      <path d="M14.8 9a2 2 0 0 0-1.8-1h-2a2 2 0 1 0 0 4h2a2 2 0 1 1 0 4h-2a2 2 0 0 1-1.8-1M12 7v10" />
    </svg>
  ),
  spins: (
    <svg {...stroke}>
      <path d="M3 8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M5.5 9.5h9v5h-9zM8.5 9.5v5M11.5 9.5v5" />
      <path d="M17 13h2.5a1 1 0 0 0 1-1V7" />
      <circle cx="20.5" cy="5" r="1.5" />
    </svg>
  ),
}
