'use client'

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { HexLoader } from '@/components/app-shell/HexLoader'
import { thumbUrl } from '@/lib/supabase/imageUrl'
import { useAddClanWarPlayers, useClanWarCandidates, useStartClanWar } from '@/lib/supabase/queries'
import { CLAN_ROLE_LABEL, clanErrorMessage } from '@/lib/data/clanLevels'
import { formatShortAgo } from '@/lib/format'
import { tn } from '@/lib/i18n/runtime'
import type { ClanRoleId } from '@/lib/data/types'

const MIN_ROSTER = 3

// The leader's / co-leader's screen for opening the clan battle: who rows this
// week. Every member with last week's activity next to the face, «Выбрать всех»
// and «Снять выделение», at least 3 picked, then a confirmation — after the
// start the roster cannot lose anyone. In `add` mode the same sheet adds players
// to a roster already started (only those not in it yet, at least one).
export function ClanWarRosterSheet({ clanId, onClose, mode = 'start' }: { clanId: number; onClose: () => void; mode?: 'start' | 'add' }) {
  const adding = mode === 'add'
  const { data: all, isLoading, isError } = useClanWarCandidates(clanId, true)
  const members = useMemo(() => (adding ? (all ?? []).filter((m) => !m.inRoster) : all), [all, adding])
  const startWar = useStartClanWar()
  const addPlayers = useAddClanWarPlayers()
  const start = adding ? addPlayers : startWar
  const [picked, setPicked] = useState<Set<string>>(() => new Set())
  const [step, setStep] = useState<'pick' | 'confirm' | 'done'>('pick')

  const total = members?.length ?? 0
  const count = picked.size
  const enough = count >= (adding ? 1 : MIN_ROSTER)
  const allIds = useMemo(() => (members ?? []).map((m) => m.userId), [members])

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function go() {
    start.mutate(
      { clanId, userIds: [...picked] },
      { onSuccess: () => setStep('done'), onError: () => setStep('pick') }
    )
  }

  return createPortal(
    <div className="move-sheet-overlay" onClick={start.isPending ? undefined : onClose}>
      <div className="move-sheet war-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={adding ? tn('race.warAddTitle') : tn('race.warRosterTitle')}>
        <div className="move-sheet-handle" />
        {step === 'done' ? (
          <div className="move-done">
            <div className="move-done-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="m5 12.5 4.5 4.5L19 7.5" />
              </svg>
            </div>
            <div className="move-done-title">{adding ? tn('race.warAddDone') : tn('race.warStarted')}</div>
            <button className="btn-primary" style={{ marginTop: 18 }} onClick={onClose}>
              {tn('common.done')}
            </button>
          </div>
        ) : step === 'confirm' ? (
          <div className="move-done">
            <div className="move-done-title">{adding ? tn('race.warAddConfirmTitle') : tn('race.warConfirmTitle')}</div>
            {/* Everyone picked, face by face, right under the title. */}
            <div className="war-confirm-faces">
              {(members ?? [])
                .filter((m) => picked.has(m.userId))
                .map((m) => (
                  <span key={m.userId} className="avatar war-roster-face" title={m.displayName}>
                    {m.avatarUrl ? <img src={thumbUrl(m.avatarUrl, 96)} alt={m.displayName} loading="lazy" decoding="async" /> : m.displayName.slice(0, 1).toUpperCase()}
                  </span>
                ))}
            </div>
            <p className="war-confirm-body">{adding ? tn('race.warAddConfirmBody', { players: tn('race.warPlayers', { count }), m: count * 200 }) : tn('race.warConfirmBody', { players: tn('race.warPlayers', { count }) })}</p>
            {start.isError && <div className="move-error">{clanErrorMessage(start.error)}</div>}
            <div className="war-confirm-actions">
              <button className="btn-secondary" disabled={start.isPending} onClick={() => setStep('pick')}>
                {tn('race.warBack')}
              </button>
              <button className="btn-primary" disabled={start.isPending} onClick={go}>
                {start.isPending ? tn('race.warStarting') : adding ? tn('race.warAddConfirmGo') : tn('race.warConfirmGo')}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="move-head">
              <div>
                <div className="move-kicker">{tn('race.warRosterKicker')}</div>
                <div className="move-title">{adding ? tn('race.warAddTitle') : tn('race.warRosterTitle')}</div>
              </div>
              <button className="icon-btn tap-scale" aria-label={tn('common.close')} onClick={onClose}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            <div className="move-body">
              <div className="move-note" style={{ textAlign: 'left', marginBottom: 10 }}>
                {adding ? tn('race.warAddNote') : tn('race.warRosterNote')}
              </div>
              <div className="war-pick-bar">
                <b>{tn('race.warSelected', { count, total })}</b>
                <span className="war-pick-actions">
                  <button type="button" className="clan-mini-btn" disabled={!total || count === total} onClick={() => setPicked(new Set(allIds))}>
                    {tn('race.warSelectAll')}
                  </button>
                  <button type="button" className="clan-mini-btn" disabled={count === 0} onClick={() => setPicked(new Set())}>
                    {tn('race.warClear')}
                  </button>
                </span>
              </div>

              {isLoading ? (
                <div className="move-empty">
                  <HexLoader size={0.5} />
                </div>
              ) : isError || !members ? (
                <div className="move-empty">{tn('common.noData')}</div>
              ) : (
                <div className="move-list">
                  {members.map((m) => {
                    const on = picked.has(m.userId)
                    return (
                      <button key={m.userId} type="button" className={`move-row war-pick-row${on ? ' on' : ''}`} aria-pressed={on} onClick={() => toggle(m.userId)}>
                        <span className={`war-pick-check${on ? ' on' : ''}`} aria-hidden>
                          {on && (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
                              <path d="m5 12.5 4.5 4.5L19 7.5" />
                            </svg>
                          )}
                        </span>
                        <span className="avatar war-pick-avatar">
                          {m.avatarUrl ? <img src={thumbUrl(m.avatarUrl, 96)} alt="" loading="lazy" decoding="async" /> : m.displayName.slice(0, 1).toUpperCase()}
                        </span>
                        <span className="move-row-main">
                          <b>
                            {m.displayName}
                            <small className="war-pick-role">{CLAN_ROLE_LABEL[(m.role as ClanRoleId) ?? 'member'] ?? ''}</small>
                          </b>
                          <span>{tn('race.warPrevWeek', { catches: tn('race.warCatches', { count: m.catches }), meters: m.meters })}</span>
                          <span>{m.lastCatchAt ? tn('race.warLastCatch', { when: formatShortAgo(m.lastCatchAt) }) : tn('race.warNoCatchYet')}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="move-footer">
              {start.isError && <div className="move-error">{clanErrorMessage(start.error)}</div>}
              {!enough && <div className="move-note">{adding ? tn('race.warNeedOne') : tn('race.warNeedThree')}</div>}
              <button className="btn-primary" disabled={!enough} onClick={() => setStep('confirm')}>
                {adding ? tn('race.warAddGo') : tn('race.warStartBtn')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
