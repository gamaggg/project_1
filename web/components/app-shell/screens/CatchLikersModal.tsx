'use client'

import { useState } from 'react'
import { useIsFollowing, useSetFollowing } from '@/lib/supabase/queries'
import type { CatchLiker } from '@/lib/data/types'

function LikerRow({ liker, onOpenUser }: { liker: CatchLiker; onOpenUser: (id: string) => void }) {
  const { data: isFollowing } = useIsFollowing(liker.userId)
  const setFollowing = useSetFollowing()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
      <button
        onClick={() => onOpenUser(liker.userId)}
        style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', font: 'inherit' }}
      >
        <div className="avatar" style={{ width: 40, height: 40, fontSize: 13, flex: '0 0 auto' }}>
          {liker.avatarUrl ? <img src={liker.avatarUrl} alt="" /> : liker.displayName.slice(0, 1).toUpperCase()}
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{liker.displayName}</span>
      </button>
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
        onClick={() => setFollowing.mutate({ followeeId: liker.userId, following: !isFollowing })}
      >
        {isFollowing ? 'Отписаться' : 'Подписаться'}
      </button>
    </div>
  )
}

// Instagram-style "liked by" sheet — rendered by FishZoneApp itself, same
// reasoning as every other app-shell-level modal (see DECISIONS.md). The
// likers list is already loaded by CatchPhotoScreen's useCatchLikes, so this
// takes it as a prop instead of re-fetching.
export function CatchLikersModal({
  likers,
  onClose,
  onOpenUser,
}: {
  likers: CatchLiker[]
  onClose: () => void
  onOpenUser: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const filtered = q ? likers.filter((l) => l.displayName.toLowerCase().includes(q)) : likers

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-card-wide" style={{ maxHeight: '72vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-close tap-scale" onClick={onClose}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.4" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </div>
        <div className="modal-title" style={{ textAlign: 'center' }}>
          Отметки «Нравится»
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
            filtered.map((l) => <LikerRow key={l.userId} liker={l} onOpenUser={onOpenUser} />)
          ) : (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 13 }}>Никого не найдено</div>
          )}
        </div>
      </div>
    </div>
  )
}
