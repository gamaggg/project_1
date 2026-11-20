'use client'

import { useState, type CSSProperties } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useClanInviteCode, useProfile } from '@/lib/supabase/queries'
import { CLAN_ROLE_RANK } from '@/lib/data/clanLevels'
import { useI18n } from '@/lib/i18n'
import { shareImageToStory } from '@/lib/story'
import { shareLink } from '@/lib/telegram/startParam'
import { refParam } from '@/lib/guestShare'
import { ClanCrest } from '@/components/app-shell/ClanCrest'
import { ClanFrame } from '@/components/clan2/ClanItems'
import { clanStoryColors } from '@/lib/data/clanCrests'
import { C2Avatar, C2Card, speciesName, useC2 } from '@/components/clan2/C2Common'
import { useDemoState } from '@/lib/clan2/demoStore'
import { formatCatchMeta } from '@/lib/format'
import { leagueFor } from '@/lib/data/clanLevels'
import { currentLocale, tn } from '@/lib/i18n/runtime'
import { thumbUrl } from '@/lib/supabase/imageUrl'

// «Зал славы»: the clan's records — the biggest fish of each species among its
// members — and the clan card for a Telegram story built from them.

// onOpenCatch: a tap on a record opens its photo, and the swipe there goes through the hall's records only.
export function GloryTab({ onOpenCatch }: { onOpenCatch?: (id: number, ids: number[]) => void } = {}) {
  const s = useDemoState()
  const { say } = useC2()
  const league = leagueFor(s.clan.trophies)
  // Every species the clan has caught: its longest fish, longest first — size is the length; the weight only breaks a tie.
  const records = [...s.hall].sort((a, b) => (b.cm ?? -1) - (a.cm ?? -1) || (b.kg ?? -1) - (a.kg ?? -1))
  const date = (at: number) => new Date(at).toLocaleDateString(currentLocale(), { day: 'numeric', month: 'short' })
  const top = records.slice(0, 3)
  const hallIds = records.flatMap((r) => (r.catchId ? [r.catchId] : []))
  const open = (id: number | undefined) => {
    if (id && onOpenCatch) onOpenCatch(id, hallIds)
  }
  const hq = s.hq.sectorId
  // The card is the story picture's preview (app/api/clan-story): water in shades of the crest's colour with a glow of it,
  // and the frame bought in the shop.
  const card = clanStoryColors(s.clan.crest)
  const frame = s.equipped.frame

  // «Поделиться в истории»: the card as a picture (app/api/clan-story) with
  // the clan's invite link — a working «Вступить» for anyone who opens it
  // (with the invite code for an elder and up, as the clan's «Пригласить»).
  // The demo clan has no real id: there the button only says what it does.
  const { lang } = useI18n()
  const { user } = useAuth()
  const { data: me } = useProfile(user?.id ?? null)
  const clanId = s.live?.clanId ?? null
  const canInvite = !!s.live && CLAN_ROLE_RANK[s.live.realRole] >= 2
  const { data: inviteCode } = useClanInviteCode(clanId, canInvite)
  const [sharing, setSharing] = useState(false)
  const share = async () => {
    if (!clanId) {
      say(tn('clan2.glory.shareDone'))
      return
    }
    setSharing(true)
    const invite = inviteCode ? `&invite=${encodeURIComponent(inviteCode)}` : ''
    const link = shareLink(`clan=${clanId}${invite}${refParam(me?.publicId)}`)
    const v = `${s.clan.level}-${s.clan.trophies}-${hq ?? ''}-${top.map((r) => r.cm ?? r.kg ?? 0).join('.')}-${card.tone}`
    const result = await shareImageToStory(`${window.location.origin}/api/clan-story/${clanId}?lang=${lang}&v=${encodeURIComponent(v)}`, tn('clan2.glory.storyCaption', { name: s.clan.name }), link, 'range-clan.png')
    setSharing(false)
    if (result === 'downloaded') say(tn('story.downloaded'))
    if (result === 'failed') say(tn('story.failed'))
  }

  return (
    <div className="c2-stack">
      <C2Card title={tn('clan2.glory.title')} hint={tn('clan2.glory.hint')} tour="glory-hall">
        <ul className="c2-hall">
          {records.map((r, i) => (
            <li
              key={r.species}
              className={onOpenCatch && r.catchId ? 'c2-hall-tap tap-scale' : undefined}
              role={onOpenCatch && r.catchId ? 'button' : undefined}
              tabIndex={onOpenCatch && r.catchId ? 0 : undefined}
              onClick={() => open(r.catchId)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') open(r.catchId)
              }}
            >
              <div className={`c2-hall-photo${r.photo ? ' has' : ''}`} style={{ background: `linear-gradient(150deg, hsl(${r.hue} 55% 62%), hsl(${(r.hue + 40) % 360} 55% 38%))` }}>
                {r.photo ? (
                  <img src={thumbUrl(r.photo, 240)} alt={speciesName(r.species)} loading="lazy" decoding="async" />
                ) : (
                  <svg viewBox="0 0 64 40" width="44" height="28" aria-hidden>
                    <path d="M4 20c9-12 26-14 40-4l10-8v24l-10-8C30 34 13 32 4 20z" fill="rgba(255,255,255,.9)" />
                    <circle cx="14" cy="18" r="2" fill="rgba(0,0,0,.45)" />
                  </svg>
                )}
                {i === 0 && <span className="c2-hall-crown" aria-label={tn('clan2.glory.top')}>1</span>}
              </div>
              <div className="c2-hall-main">
                <strong>{speciesName(r.species)}</strong>
                <div className="c2-hall-size">
                  {formatCatchMeta(r.cm, r.kg)}
                  {i === 0 && <span className="c2-chip warn">{tn('clan2.glory.top')}</span>}
                </div>
                <div className="c2-muted small c2-hall-by">
                  <C2Avatar member={{ name: r.member, hue: r.hue, avatarUrl: r.avatarUrl }} size={18} />
                  <span>{tn('clan2.glory.by', { name: r.member, date: date(r.at) })}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </C2Card>

      <C2Card title={tn('clan2.glory.shareTitle')} hint={tn('clan2.glory.shareHint')} tour="glory-card">
        <div
          className="c2-sharecard"
          style={{ background: `radial-gradient(90% 45% at 50% 22%, rgba(${card.glowRgb},0.5), rgba(${card.glowRgb},0) 70%), ${card.water}`, '--hero-text-rgb': '255,255,255' } as CSSProperties}
        >
          <div className="c2-sharecard-crest">
            <ClanFrame id={frame} size={72} crest={s.clan.crest}>
              <ClanCrest crest={s.clan.crest} size={72} shine />
            </ClanFrame>
          </div>
          <div className="c2-sharecard-name">{s.clan.name}</div>
          <div className="c2-sharecard-meta">
            {tn('clan2.clan.level', { n: s.clan.level })} · {tn('clan2.glory.cardLeague', { name: league.label })}
          </div>
          <div className="c2-sharecard-meta">{hq ? tn('clan2.glory.cardHq', { id: hq }) : tn('clan2.glory.cardNoHq')}</div>
          <div className="c2-sharecard-records">
            <span>{tn('clan2.glory.cardRecords')}</span>
            {top.map((r) => (
              <b key={r.species}>
                {speciesName(r.species)}
                {r.cm || r.kg ? ` ${formatCatchMeta(r.cm, r.cm ? null : r.kg)}` : ''}
              </b>
            ))}
          </div>
        </div>
        <button className="story-btn big" style={{ marginTop: 12 }} disabled={sharing} onClick={() => void share()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <circle cx="12" cy="12" r="9" strokeDasharray="4 2.6" />
            <path d="M12 8v8M8 12h8" />
          </svg>
          {sharing ? tn('story.preparing') : tn('clan2.glory.shareBtn')}
        </button>
      </C2Card>
    </div>
  )
}
