'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { thumbUrl } from '@/lib/supabase/imageUrl'
import { useAuth } from '@/components/providers/AuthProvider'
import {
  useClan,
  useProfile,
  useClanEligibility,
  useJoinClan,
  useCancelClanJoinRequest,
  useLeaveClan,
  useKickClanMember,
  useSetClanMemberRole,
  useRespondClanJoinRequest,
  useDeclineClanInvite,
  useIsSuperAdmin,
  useAdminModerateClan,
  useClanChatSummary,
  useClanInviteCode,
  type ClanModerationAction,
} from '@/lib/supabase/queries'
import { forgetClanInvite } from '@/lib/guestShare'
import { BackButton } from '@/components/app-shell/BackButton'
import { ClanHero } from '@/components/app-shell/ClanHero'
import { ClanChestPanel } from '@/components/app-shell/ClanChestPanel'
import { ClanRacePreview } from '@/components/app-shell/ClanRace'
import { StyledName } from '@/components/app-shell/StyledName'
import { CLAN_ROLE_LABEL, CLAN_ROLE_RANK, JOIN_TYPE_LABEL, clanErrorMessage, clanLevelProgress, leagueFor, type ClanRole } from '@/lib/data/clanLevels'
import { formatShortAgo } from '@/lib/format'
import type { ClanDetail, ClanEvent, ClanMember } from '@/lib/data/types'

type Tab = 'members' | 'chest' | 'race'

function RoleIcon({ role }: { role: ClanRole }) {
  if (role === 'member') return null
  const d =
    role === 'leader'
      ? 'M3 8l4 3 5-6 5 6 4-3-2 11H5L3 8z'
      : role === 'co_leader'
        ? 'M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7Z'
        : 'M12 3 20 7v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7Z'
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d={d} />
    </svg>
  )
}

const MODERATED_TEXT: Record<string, string> = {
  reset_name: 'Модератор сбросил название клана',
  reset_motto: 'Модератор сбросил девиз клана',
  reset_announcement: 'Модератор сбросил объявление',
  reset_crest: 'Модератор сбросил герб клана',
  void_race: 'Модератор аннулировал результат клана в битве кланов за эту неделю',
}

const ADMIN_CLAN_ACTIONS: { action: ClanModerationAction; label: string; confirm: string; danger?: boolean }[] = [
  { action: 'reset_name', label: 'Сбросить название', confirm: 'Сбросить название на «Клан N»? Глава сможет сразу задать новое.' },
  { action: 'reset_motto', label: 'Сбросить девиз', confirm: 'Удалить девиз клана?' },
  { action: 'reset_announcement', label: 'Сбросить объявление', confirm: 'Удалить объявление клана?' },
  { action: 'reset_crest', label: 'Сбросить герб', confirm: 'Вернуть клану стандартный герб?' },
  { action: 'void_race', label: 'Аннулировать битву кланов за неделю', confirm: 'Убрать клан из битвы кланов этой недели? Места, монет и трофеев за битву не будет; сундук останется.', danger: true },
  { action: 'disband', label: 'Распустить клан', confirm: 'Распустить клан? Все участники будут исключены без ожидания перед вступлением в другой клан. Отменить нельзя.', danger: true },
]

// Also the chat's system lines (see ClanChatScreen).
export function eventText(e: ClanEvent): string {
  const actor = e.actorName ?? 'Кто-то'
  const target = e.targetName ?? 'участник'
  const role = CLAN_ROLE_LABEL[(e.payload?.role as ClanRole) ?? 'member']?.toLowerCase()
  switch (e.kind) {
    case 'created':
      return `${actor} основал клан`
    case 'joined':
      return e.actorName && e.actorName !== e.targetName ? `${actor} принял ${target}` : `${target} вступил в клан`
    case 'left':
      return `${actor} вышел из клана`
    case 'kicked':
      return `${actor} исключил ${target}`
    case 'promoted':
      return `${actor} повысил ${target} до роли «${role}»`
    case 'demoted':
      return `${actor} понизил ${target} до роли «${role}»`
    case 'new_leader':
      return `${target} стал главой клана`
    case 'renamed':
      return `${actor} переименовал клан в «${String(e.payload?.to ?? '')}»`
    case 'settings':
      return `${actor} обновил настройки клана`
    case 'moderated':
      return MODERATED_TEXT[String(e.payload?.what ?? '')] ?? 'Модератор изменил клан'
    case 'week_result': {
      const place = Number(e.payload?.place ?? 0)
      const tier = Number(e.payload?.tier ?? 0)
      // place 1 without a win means the clan raced alone (a win needs 2+ clans).
      const alone = place === 1 && !e.payload?.won
      const race = e.payload?.voided
        ? 'битва кланов аннулирована модератором'
        : e.payload?.won
          ? 'победа в битве кланов!'
          : alone
            ? e.payload?.finished
              ? 'битва кланов: доплыли до финиша'
              : 'битва кланов: до финиша не доплыли'
            : e.payload?.finished
              ? `битва кланов: доплыли, ${place}-е место`
              : `битва кланов: ${place}-е место`
      return `Итоги недели — ${race}, сундук ${tier > 0 ? ['I', 'II', 'III', 'IV', 'V'][tier - 1] : 'не открыт'}`
    }
    default:
      return actor
  }
}

type MemberAction = { label: string; danger?: boolean; confirm?: string; run: () => void }

// The way into the clan chat: its latest line and how many are unread.
function ClanChatCard({ clanId, onOpen }: { clanId: number; onOpen: () => void }) {
  const { data: summary } = useClanChatSummary(clanId)
  const unread = summary?.unread ?? 0
  const last = summary?.last
  return (
    <button className={`clan-chat-card tap-scale${unread > 0 ? ' has-unread' : ''}`} onClick={onOpen}>
      <span className="clan-chat-card-icon" aria-hidden>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12Z" />
        </svg>
      </span>
      <span className="clan-chat-card-text">
        <span className="clan-chat-card-title">Чат клана</span>
        <span className="clan-chat-card-last">
          {last ? (
            <>
              <b>{last.mine ? 'Ты' : last.author}:</b> {last.body}
            </>
          ) : (
            'Пока тихо — напиши первым'
          )}
        </span>
      </span>
      {unread > 0 && <span className="clan-chat-card-badge">{unread > 99 ? '99+' : unread}</span>}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A8A9AE" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M9 6l6 6-6 6" />
      </svg>
    </button>
  )
}

export function ClanScreen({
  clanId,
  inviteCode,
  onBack,
  onOpenUser,
  onEdit,
  onShareClan,
  onOpenRace,
  onOpenChat,
}: {
  clanId: number
  // From an invite link (?clan=<id>&invite=<code>) — counts as an invitation.
  inviteCode?: string | null
  onBack: () => void
  onOpenUser: (id: string) => void
  onEdit: (clan: ClanDetail) => void
  onShareClan: (clanId: number, name: string, inviteCode?: string | null) => void
  onOpenRace: () => void
  onOpenChat: (clanId: number) => void
}) {
  const { user } = useAuth()
  const { data: clan, isLoading } = useClan(clanId)
  const { data: me } = useProfile(user?.id ?? null)
  const isMember = !!clan?.myRole
  const { data: eligibility } = useClanEligibility(!!clan && !isMember)
  const join = useJoinClan()
  const cancelRequest = useCancelClanJoinRequest()
  const leave = useLeaveClan()
  const kick = useKickClanMember()
  const setRole = useSetClanMemberRole()
  const respond = useRespondClanJoinRequest()
  const declineInvite = useDeclineClanInvite()
  const isSuperAdmin = useIsSuperAdmin()
  const moderate = useAdminModerateClan()
  // Leaders, co-leaders and elders share a link that is itself an invitation.
  const canInvite = !!clan?.myRole && CLAN_ROLE_RANK[clan.myRole] >= 2
  const { data: shareInviteCode } = useClanInviteCode(clan?.id ?? null, canInvite)

  const [tab, setTab] = useState<Tab>('members')
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ text: string; action: string; danger?: boolean; run: () => void } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2200)
    return () => clearTimeout(t)
  }, [toast])

  if (isLoading || !clan) {
    return (
      <>
        <div className="header-row">
          <BackButton onClick={onBack} registerNative={false} />
          <div />
          <div style={{ width: 36 }} />
        </div>
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5 }}>{isLoading ? 'Загрузка…' : 'Клан не найден'}</div>
      </>
    )
  }

  const myRank = clan.myRole ? CLAN_ROLE_RANK[clan.myRole] : 0
  const league = leagueFor(clan.trophies)
  const progress = clanLevelProgress(clan.xp)
  const otherCity = !!me && me.city !== clan.city
  const inOtherClan = !!me?.clanId && me.clanId !== clan.id
  const linkInvite = !!inviteCode && !isMember
  // An invitation (personal or by link) skips the clan's sector minimum.
  const lacksSectors = !!eligibility && eligibility.sectors < clan.minSectors && !clan.myInvite && !linkInvite
  const cooldownUntil = eligibility?.cooldownUntil ? new Date(eligibility.cooldownUntil) : null
  const onCooldown = !!cooldownUntil && cooldownUntil > new Date()
  const full = clan.members.length >= clan.capacity
  const joinBlocked = join.isPending || otherCity || inOtherClan || onCooldown || full

  function joinClan(code: string | null) {
    if (!clan) return
    run(
      join.mutateAsync({ clanId: clan.id, inviteCode: code }).then((r) => {
        if (r === 'requested') setToast('Заявка отправлена')
        else forgetClanInvite()
      }),
      clan.joinType === 'open' || code ? 'Добро пожаловать в клан!' : undefined
    )
  }

  function run(p: Promise<unknown>, done?: string) {
    setError(null)
    p.then(() => done && setToast(done)).catch((e) => setError(clanErrorMessage(e)))
  }

  function memberActions(m: ClanMember): MemberAction[] {
    if (!clan || m.userId === user?.id) return []
    const theirs = CLAN_ROLE_RANK[m.role]
    if (myRank < 2 || theirs >= myRank) return []
    const list: MemberAction[] = []
    const promote = (role: ClanRole, label: string) =>
      list.push({ label, run: () => run(setRole.mutateAsync({ userId: m.userId, role, clanId: clan.id }), `${m.displayName}: ${CLAN_ROLE_LABEL[role].toLowerCase()}`) })
    if (clan.myRole === 'leader') {
      if (m.role === 'member') promote('elder', 'Сделать старейшиной')
      if (m.role !== 'co_leader') promote('co_leader', 'Сделать соруководителем')
      if (m.role === 'co_leader') promote('elder', 'Понизить до старейшины')
      if (m.role === 'elder') promote('member', 'Понизить до участника')
      list.push({
        label: 'Передать главенство',
        confirm: `Передать главенство ${m.displayName}? Ты станешь соруководителем.`,
        run: () => run(setRole.mutateAsync({ userId: m.userId, role: 'leader', clanId: clan.id }), `${m.displayName} теперь глава`),
      })
    } else if (clan.myRole === 'co_leader') {
      if (m.role === 'member') promote('elder', 'Сделать старейшиной')
      if (m.role === 'elder') promote('member', 'Понизить до участника')
    }
    list.push({
      label: 'Исключить из клана',
      danger: true,
      confirm: `Исключить ${m.displayName}? Вернуться в клан он сможет только через 3 дня.`,
      run: () => run(kick.mutateAsync({ userId: m.userId, clanId: clan.id }), `${m.displayName} исключён`),
    })
    return list
  }

  const headerTop = (
    <div className="clan-hero-top">
      <BackButton onClick={onBack} registerNative={false} />
      <div style={{ display: 'flex', gap: 8 }}>
        {isMember && myRank >= 3 && (
          <button className="icon-btn tap-scale" aria-label="Настройки клана" onClick={() => onEdit(clan)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
            </svg>
          </button>
        )}
        <button className="icon-btn tap-scale" aria-label="Поделиться кланом" onClick={() => onShareClan(clan.id, clan.name, shareInviteCode)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 15V4M12 4 8 8M12 4l4 4" />
            <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
          </svg>
        </button>
      </div>
    </div>
  )

  return (
    <div className="clan-screen" onClick={() => menuFor && setMenuFor(null)}>
      <ClanHero crest={clan.crest} name={clan.name} motto={clan.motto} background={clan.background} golden={clan.level >= 10} top={headerTop}>
        <div className="clan-chips">
          <span className="clan-chip">Ур. {clan.level}</span>
          <span className="clan-chip clan-chip-league">
            <span className="clan-league-dot" style={{ background: league.color }} />
            {league.label} · {clan.trophies}
          </span>
          <span className="clan-chip">
            {clan.members.length}/{clan.capacity}
          </span>
          <span className="clan-chip">{clan.sectorsHeld} сект.</span>
          <span className="clan-chip" title="Номер клана — по нему клан находится в поиске">
            ID {clan.id}
          </span>
          {clan.raceWins > 0 && (
            <span className={`clan-chip clan-chip-race${clan.wonLastWeek ? ' fresh' : ''}`} title="Побед в битве кланов">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12.6 3.2c3.9 2.4 5.9 6.3 6.1 11.3h-6.1Z" />
                <path d="M11 6.2 6 14.5h5Z" opacity=".75" />
                <path d="M3 16.8h18l-2.3 3.2H5.3Z" />
              </svg>
              {clan.wonLastWeek ? 'Победитель битвы кланов' : 'Битва кланов'}
              {clan.raceWins > 1 || !clan.wonLastWeek ? ` ×${clan.raceWins}` : ''}
            </span>
          )}
        </div>
        {isMember && (
          <div className="clan-xp">
            <div className="clan-xp-bar">
              <div className="clan-xp-fill" style={{ width: `${Math.round(progress.pct * 100)}%` }} />
            </div>
            <div className="clan-xp-label">
              <span>Опыт клана</span>
              <span>{progress.to === null ? 'Максимальный уровень' : `${clan.xp} / ${progress.to}`}</span>
            </div>
          </div>
        )}
      </ClanHero>

      <div className="clan-body">
        {clan.disbanded ? (
          <div className="clan-note">Клан распущен</div>
        ) : isMember ? (
          <div className="clan-actions">
            <button className="btn-primary" onClick={() => onShareClan(clan.id, clan.name, shareInviteCode)}>
              Пригласить в клан
            </button>
            <button
              className="btn-secondary"
              style={{ flex: '0 0 auto', width: 'auto', padding: '0 16px' }}
              onClick={() =>
                setConfirm({
                  text:
                    clan.myRole === 'leader' && clan.members.length > 1
                      ? 'Выйти из клана? Главенство перейдёт следующему по старшинству. Вступить в другой клан можно будет через сутки.'
                      : clan.members.length === 1
                        ? 'Ты последний участник — клан будет распущен. Вступить в другой клан можно будет через сутки.'
                        : 'Выйти из клана? Вступить в другой клан можно будет через сутки.',
                  action: 'Выйти',
                  danger: true,
                  run: () => run(leave.mutateAsync(clan.id), 'Ты вышел из клана'),
                })
              }
            >
              Выйти
            </button>
          </div>
        ) : (
          <div className="clan-join-box">
            {clan.myInvite ? (
              <>
                <div className="clan-join-note">Тебя пригласили в этот клан</div>
                <div className="clan-actions">
                  <button className="btn-primary" disabled={joinBlocked} onClick={() => joinClan(null)}>
                    Принять приглашение
                  </button>
                  <button className="btn-secondary" style={{ flex: '0 0 auto', width: 'auto', padding: '0 16px' }} onClick={() => run(declineInvite.mutateAsync(clan.id))}>
                    Отклонить
                  </button>
                </div>
              </>
            ) : clan.myRequestPending ? (
              <div className="clan-actions">
                <button className="btn-secondary" disabled>
                  Заявка отправлена
                </button>
                <button className="btn-secondary" style={{ flex: '0 0 auto', width: 'auto', padding: '0 16px' }} onClick={() => run(cancelRequest.mutateAsync(clan.id))}>
                  Отменить
                </button>
              </div>
            ) : linkInvite ? (
              <>
                {clan.joinType !== 'open' && <div className="clan-join-note">Тебя пригласили в этот клан</div>}
                <button className="btn-primary" disabled={joinBlocked || lacksSectors} onClick={() => joinClan(inviteCode ?? null)}>
                  Вступить в клан
                </button>
              </>
            ) : clan.joinType === 'invite' ? (
              <div className="clan-join-note">
                В этот клан вступают только по приглашению
                <div className="clan-join-hint">Попроси главу или старейшину прислать ссылку-приглашение</div>
              </div>
            ) : (
              <button className="btn-primary" disabled={joinBlocked || lacksSectors} onClick={() => joinClan(null)}>
                {clan.joinType === 'open' ? 'Вступить в клан' : 'Подать заявку'}
              </button>
            )}
            {clan.joinType !== 'invite' && !linkInvite && !clan.myInvite && (
              <div className="clan-join-meta">
                {JOIN_TYPE_LABEL[clan.joinType]}
                {clan.minSectors > 0 && ` · от ${clan.minSectors} захваченных секторов`}
              </div>
            )}
            {otherCity && <div className="clan-join-warn">Клан из другого города</div>}
            {inOtherClan && <div className="clan-join-warn">Ты уже в клане «{me?.clanName}»</div>}
            {!otherCity && !inOtherClan && lacksSectors && (
              <div className="clan-join-warn">
                Нужно захватить {clan.minSectors} сект. — у тебя {eligibility?.sectors ?? 0}
              </div>
            )}
            {!otherCity && !inOtherClan && onCooldown && cooldownUntil && (
              <div className="clan-join-warn">
                После выхода из клана — сутки паузы. Вступить можно с{' '}
                {cooldownUntil.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
            {!otherCity && !inOtherClan && full && <div className="clan-join-warn">Свободных мест нет</div>}
          </div>
        )}
        {error && <div className="clan-error">{error}</div>}
        {isMember && !clan.disbanded && <ClanChatCard clanId={clan.id} onOpen={() => onOpenChat(clan.id)} />}

        <div className="clan-tabs" style={{ marginTop: 16 }}>
          <button className={`clan-tab${tab === 'members' ? ' on' : ''}`} onClick={() => setTab('members')}>
            Участники
          </button>
          <button className={`clan-tab${tab === 'chest' ? ' on' : ''}`} onClick={() => setTab('chest')}>
            Сундук
          </button>
          <button className={`clan-tab${tab === 'race' ? ' on' : ''}`} onClick={() => setTab('race')}>
            Битва кланов
          </button>
        </div>

        {tab === 'members' && (
          <div className="clan-tab-body" key="members">
            {clan.announcement && (
              <div className="clan-announcement">
                <div className="clan-announcement-kicker">Объявление</div>
                {clan.announcement}
              </div>
            )}

            {clan.requests && clan.requests.length > 0 && (
              <div className="clan-card">
                <div className="clan-card-title">Заявки · {clan.requests.length}</div>
                {clan.requests.map((r) => (
                  <div key={r.userId} className="clan-member-row">
                    <button className="avatar clan-member-avatar tap-scale" onClick={() => onOpenUser(r.userId)} aria-label={r.displayName}>
                      {r.avatarUrl ? <img src={thumbUrl(r.avatarUrl, 96)} alt="" loading="lazy" decoding="async" /> : r.displayName.slice(0, 1).toUpperCase()}
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="clan-member-name">{r.displayName}</div>
                      <div className="clan-member-meta">
                        Захватил {r.sectors} сект. · {formatShortAgo(r.createdAt)}
                      </div>
                    </div>
                    <button className="clan-mini-btn ok" onClick={() => run(respond.mutateAsync({ userId: r.userId, accept: true, clanId: clan.id }), `${r.displayName} в клане`)}>
                      Принять
                    </button>
                    <button className="clan-mini-btn" onClick={() => run(respond.mutateAsync({ userId: r.userId, accept: false, clanId: clan.id }))} aria-label="Отклонить">
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="clan-card">
              <div className="clan-card-title">Участники · {clan.members.length}</div>
              {clan.members.map((m, i) => {
                const actions = memberActions(m)
                return (
                  <div key={m.userId} className={`clan-member-row${menuFor === m.userId ? ' menu-open' : ''}`} style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}>
                    <button className="avatar clan-member-avatar tap-scale" onClick={() => onOpenUser(m.userId)} aria-label={m.displayName}>
                      {m.avatarUrl ? <img src={thumbUrl(m.avatarUrl, 96)} alt="" loading="lazy" decoding="async" /> : m.displayName.slice(0, 1).toUpperCase()}
                    </button>
                    <button className="clan-member-main" onClick={() => onOpenUser(m.userId)}>
                      <span className="clan-member-name">
                        <StyledName name={m.displayName} styleId={m.nameStyle} />
                        {m.userId === user?.id && <span className="clan-you">ты</span>}
                      </span>
                      <span className={`clan-role clan-role-${m.role}`}>
                        <RoleIcon role={m.role} />
                        {CLAN_ROLE_LABEL[m.role]}
                      </span>
                    </button>
                    <div className="clan-member-stats">
                      <b>{m.weekCatches}</b>
                      <span>уловов за нед.</span>
                    </div>
                    {actions.length > 0 && (
                      <div style={{ position: 'relative' }}>
                        <button
                          className="comment-more"
                          aria-label="Действия"
                          onClick={(e) => {
                            e.stopPropagation()
                            setMenuFor(menuFor === m.userId ? null : m.userId)
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                            <circle cx="5" cy="12" r="1.8" />
                            <circle cx="12" cy="12" r="1.8" />
                            <circle cx="19" cy="12" r="1.8" />
                          </svg>
                        </button>
                        {menuFor === m.userId && (
                          <div className="comment-menu" onClick={(e) => e.stopPropagation()}>
                            {actions.map((a) => (
                              <button
                                key={a.label}
                                className={a.danger ? 'danger' : undefined}
                                onClick={() => {
                                  setMenuFor(null)
                                  if (a.confirm) setConfirm({ text: a.confirm, action: a.label, danger: a.danger, run: a.run })
                                  else a.run()
                                }}
                              >
                                {a.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {clan.events.length > 0 && (
              <div className="clan-card">
                <div className="clan-card-title">Журнал клана</div>
                {clan.events.map((e, i) => (
                  <div key={i} className="clan-event">
                    <span className="clan-event-dot" />
                    <span style={{ flex: 1 }}>{eventText(e)}</span>
                    <span className="clan-event-time">{formatShortAgo(e.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'chest' && <ClanChestPanel key="chest" clanId={clan.id} isMember={isMember} />}
        {tab === 'race' && <ClanRacePreview key="race" city={clan.city} clanId={clan.id} onOpenRace={onOpenRace} />}

        {isSuperAdmin && !clan.disbanded && (
          <div className="clan-card clan-admin">
            <div className="clan-card-title">Модерация · супер-админ</div>
            <div className="clan-admin-grid">
              {ADMIN_CLAN_ACTIONS.map((a) => (
                <button
                  key={a.action}
                  className={`clan-mini-btn${a.danger ? ' danger' : ''}`}
                  disabled={moderate.isPending}
                  onClick={() =>
                    setConfirm({
                      text: a.confirm,
                      action: a.label,
                      danger: a.danger,
                      run: () => run(moderate.mutateAsync({ clanId: clan.id, action: a.action }), 'Готово'),
                    })
                  }
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {confirm &&
        createPortal(
        <div className="modal-overlay" onClick={() => setConfirm(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-body" style={{ margin: '0 0 18px', color: 'var(--ink)', fontSize: 15, fontWeight: 700 }}>
              {confirm.text}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-secondary" onClick={() => setConfirm(null)}>
                Отмена
              </button>
              <button
                className="btn-primary"
                style={confirm.danger ? { background: '#D33', boxShadow: 'none' } : undefined}
                onClick={() => {
                  confirm.run()
                  setConfirm(null)
                }}
              >
                {confirm.action}
              </button>
            </div>
          </div>
        </div>,
          document.body
        )}
      {toast && <div className="clan-toast">{toast}</div>}
    </div>
  )
}
