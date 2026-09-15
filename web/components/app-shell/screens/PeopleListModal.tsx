'use client'

import { useState } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useIsFollowing, useSetFollowing } from '@/lib/supabase/queries'
import type { ProfileSummary } from '@/lib/data/types'

function PersonRow({ person, onOpenUser }: { person: ProfileSummary; onOpenUser: (id: string) => void }) {
  const { user } = useAuth()
  const isSelf = person.userId === user?.id
  const { data: isFollowing } = useIsFollowing(isSelf ? null : person.userId)
  const setFollowing = useSetFollowing()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
      <button
        className="tap-scale"
        onClick={() => onOpenUser(person.userId)}
        style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', font: 'inherit' }}
      >
        <div className="avatar" style={{ width: 40, height: 40, fontSize: 13, flex: '0 0 auto' }}>
          {person.avatarUrl ? <img src={person.avatarUrl} alt="" /> : person.displayName.slice(0, 1).toUpperCase()}
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{person.displayName}</span>
      </button>
      {/* Can't follow yourself — when the viewer's own row shows up (they
          follow/liked the thing themselves), skip the button instead of a
          "Подписаться" that would target their own id. */}
      {!isSelf && (
        <button
          className={isFollowing ? 'btn-secondary' : 'btn-primary'}
          // .btn-primary's box-shadow is a soft glow meant for full-width hero
          // CTAs on an unclipped screen — inside this scrollable row list, the
          // list's own overflow-y:auto implicitly clips overflow-x too (CSS
          // spec: one non-visible overflow axis forces the other to auto),
          // so that glow gets visibly cut off. Too heavy for a small inline
          // pill button anyway — dropped instead of fighting the clip.
          style={{ width: 'auto', padding: '7px 16px', fontSize: 12.5, flex: '0 0 auto', boxShadow: 'none' }}
          disabled={setFollowing.isPending}
          onClick={() => setFollowing.mutate({ followeeId: person.userId, following: !isFollowing })}
        >
          {isFollowing ? 'Отписаться' : 'Подписаться'}
        </button>
      )}
    </div>
  )
}

// A generic "list of people" sheet — rendered by FishZoneApp itself, same
// reasoning as every other app-shell-level modal (see DECISIONS.md). Reused
// for two lists that share this exact shape (avatar/name/follow button):
// CatchPhotoScreen's "Отметки «Нравится»" (already-loaded via useCatchLikes)
// and Profile/UserProfileScreen's "Подписчики" (useFollowers) — both pass
// their list in as a prop instead of this modal re-fetching either.
export function PeopleListModal({
  title,
  people,
  onClose,
  onOpenUser,
}: {
  title: string
  people: ProfileSummary[]
  onClose: () => void
  onOpenUser: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const filtered = q ? people.filter((p) => p.displayName.toLowerCase().includes(q)) : people

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-card-wide" style={{ maxHeight: '72vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-close tap-scale" onClick={onClose}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.4" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </div>
        <div className="modal-title" style={{ textAlign: 'center' }}>
          {title}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск"
          style={{
            marginTop: 14,
            padding: '10px 14px',
            borderRadius: 12,
            border: '1.5px solid var(--line)',
            fontSize: 14,
            fontFamily: 'inherit',
            width: '100%',
            boxSizing: 'border-box',
            outline: 'none',
          }}
        />
        <div style={{ overflowY: 'auto', flex: 1, marginTop: 4 }}>
          {filtered.length ? (
            filtered.map((p) => <PersonRow key={p.userId} person={p} onOpenUser={onOpenUser} />)
          ) : (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 13 }}>Никого не найдено</div>
          )}
        </div>
      </div>
    </div>
  )
}
