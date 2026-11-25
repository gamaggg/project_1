'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { tn } from '@/lib/i18n'
import { thumbUrl } from '@/lib/supabase/imageUrl'
import { nameInitials } from '@/lib/initials'
import { ClanCrest } from '@/components/app-shell/ClanCrest'
import { sectorCapturer, sectorOtherHolders } from '@/lib/data/sectorHolders'
import type { Territory, TerritoryCoHolder } from '@/lib/data/types'

// «Держат сектор» (24.11.2026): who captured the sector, the clan-mates sharing it and the clan, in one card
// instead of three blocks (capturer card, co-holder chips, clan line). Overlapping avatars, the capturer
// first and larger in the brand's orange ring. With co-holders a tap opens the list of everyone holding it;
// alone, a tap opens the capturer's profile.
function Avatar({ h, className, z }: { h: TerritoryCoHolder; className: string; z?: number }) {
  return (
    <span className={className} style={z === undefined ? undefined : { zIndex: z }}>
      {h.avatarUrl ? <img src={thumbUrl(h.avatarUrl, 96)} alt="" loading="lazy" decoding="async" /> : nameInitials(h.displayName ?? tn('common.angler'), 2)}
    </span>
  )
}

const nameOf = (h: TerritoryCoHolder) => (h.isMe ? tn('sector.you') : h.displayName ?? tn('common.angler'))

export function SectorHoldersCard({
  territory,
  onOpenUser,
  onOpenClan,
}: {
  territory: Territory
  onOpenUser: (id: string) => void
  onOpenClan: (id: number) => void
}) {
  const [listOpen, setListOpen] = useState(false)
  const capturer = sectorCapturer(territory)
  if (!capturer) return null
  const others = sectorOtherHolders(territory)
  const shared = others.length > 0
  const sub = shared
    ? tn('sector.holdersWith', { names: others.map((h) => (h.isMe ? tn('sector.youWith') : h.displayName ?? tn('common.angler'))).join(', ') })
    : tn('sector.holderCaptured')
  const tap = () => (shared ? setListOpen(true) : onOpenUser(capturer.id))
  const clanId = territory.ownerClanId

  return (
    <div className="sector-holders">
      <div className="sector-holders-head">
        <span className="sector-holders-label">{tn(shared ? 'sector.holdersTitle' : 'sector.holderTitle')}</span>
        {clanId && (
          <button type="button" className="sector-holders-clan tap-scale" onClick={() => onOpenClan(clanId)}>
            <ClanCrest crest={territory.ownerClanCrest} size={18} />
            <span>
              {tn('sector.qOpen')}
              {territory.ownerClanName}
              {tn('sector.qClose')}
            </span>
          </button>
        )}
      </div>
      <button type="button" className="sector-holders-row tap-scale" onClick={tap} disabled={!shared && capturer.isMe}>
        <span className="sector-holders-stack">
          {/* Each avatar lies over the next one: the capturer on top, then the others in order. */}
          <Avatar h={capturer} className="sector-holders-avatar main" z={others.length + 1} />
          {others.map((h, i) => (
            <Avatar key={h.id} h={h} className="sector-holders-avatar" z={others.length - i} />
          ))}
        </span>
        <span className="sector-holders-text">
          <span className="sector-holders-name">{nameOf(capturer)}</span>
          <span className="sector-holders-sub">{sub}</span>
        </span>
        {(shared || !capturer.isMe) && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A8A9AE" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 6l6 6-6 6" />
          </svg>
        )}
      </button>
      {listOpen &&
        createPortal(
          <div className="move-sheet-overlay" onClick={() => setListOpen(false)}>
            <div className="move-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={tn('sector.holdersTitle')}>
              <div className="move-sheet-handle" />
              <div className="move-head">
                <div>
                  <div className="move-kicker">{tn('sector.idLabel', { id: territory.id })}</div>
                  <div className="move-title">{tn('sector.holdersTitle')}</div>
                </div>
              </div>
              <div className="move-body">
                {[capturer, ...others].map((h, i) => (
                  <button
                    key={h.id}
                    type="button"
                    className="sector-holders-item tap-scale"
                    disabled={h.isMe}
                    onClick={() => {
                      setListOpen(false)
                      onOpenUser(h.id)
                    }}
                  >
                    <Avatar h={h} className={`sector-holders-avatar${i === 0 ? ' main' : ''}`} />
                    <span className="sector-holders-text">
                      <span className="sector-holders-name">{nameOf(h)}</span>
                      <span className="sector-holders-sub">{tn(i === 0 ? 'sector.holderRoleCaptured' : 'sector.holderRoleShare')}</span>
                    </span>
                  </button>
                ))}
                <p className="sector-holders-note">{tn('sector.holdersNote')}</p>
                <button className="btn-primary" style={{ margin: '12px 0 18px' }} onClick={() => setListOpen(false)}>
                  {tn('common.close')}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
