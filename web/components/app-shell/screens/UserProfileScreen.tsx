'use client'

import { SkeletonRows } from '@/components/app-shell/Skeleton'
import { useRef, useState, type CSSProperties } from 'react'
import { thumbUrl } from '@/lib/supabase/imageUrl'
import {
  useProfile,
  useCatchesByUser,
  useIsFollowing,
  useSetFollowing,
  useInviteToClan,
  useIsAdmin,
  useIsSuperAdmin,
  useCanBlockUsers,
  useCanMessagePlayers,
  useSetBlocked,
  useAccountFreeze,
  useUnfreeze,
  useHasClaimedFromOthers,
  useEarnedAchievements,
  useReportDeletionCount,
  useUserAwards,
  useFollowers,
} from '@/lib/supabase/queries'
import { CoinIcon } from '@/components/app-shell/CoinIcon'
import { AwardsRing, type AwardGroup } from '@/components/app-shell/AwardsRing'
import { ProfileCatchRow, ProfileTrophies } from '@/components/app-shell/ProfileTrophies'
import { ProfileSectorRow } from '@/components/app-shell/ProfileSectors'
import { AchievementCard } from '@/components/app-shell/AchievementCard'
import { computeAchievements, heldTerritories, trophies, type Achievement } from '@/lib/data/achievements'
import { formatJoinedDate, pluralTerritories, speciesBreakdown, type SpeciesEntry } from '@/lib/format'
import type { Territory, ProfileSummary } from '@/lib/data/types'
import { CITIES } from '@/lib/data/city'
import { Flag } from '@/components/app-shell/Flag'
import { resolveHeroBackground } from '@/lib/data/heroBackgrounds'
import { resolveAvatarFrame } from '@/lib/data/shopItems'
import { AvatarFrameRing } from '@/components/app-shell/AvatarFrameRing'
import { StyledName } from '@/components/app-shell/StyledName'
import { ClanCrest } from '@/components/app-shell/ClanCrest'
import { clanErrorMessage } from '@/lib/data/clanLevels'
import { useAuth } from '@/components/providers/AuthProvider'
import { HeroBgLive } from '@/components/app-shell/HeroBgLive'
import { BackButton } from '@/components/app-shell/BackButton'
import { tn } from '@/lib/i18n'
import { AdminSupportChatSheet } from '@/components/app-shell/AdminSupportChatSheet'

// Which anti-abuse check froze the account (profiles.frozen_reason, _abuse_check_catch / abuse_scan).
const FREEZE_REASON: Record<string, string> = {
  rhythm: 'Уловы шли ровно, как по таймеру',
  teleport: '«Телепорт» между далёкими секторами',
  volume: 'Слишком много уловов за сутки',
  uploads: 'Слишком много фото за час',
  reports: 'Слишком много жалоб за час',
}

// Rendered by FishZoneApp itself, not nested inside a screen's scrolling
// `.screen-inner` — same clipping reasoning as every other app-shell-level
// modal (see DECISIONS.md). Just the photo, tap outside (or the photo itself)
// to dismiss — a peek, not a screen, so it skips the stack/back-button
// machinery CatchPhotoScreen needs for a real destination.
export function AvatarPreviewModal({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 340 }} onClick={onClose}>
        <img
          src={url}
          alt=""
          style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: 28, display: 'block', boxShadow: '0 24px 48px rgba(0,0,0,.35)' }}
        />
      </div>
    </div>
  )
}

// Read-only counterpart to ProfileScreen — someone else's territories/catches/
// achievements, plus a follow button instead of edit/sign-out controls. See
// DECISIONS.md: territories/catches for this user come from data FishZoneApp
// already has loaded (filtered by ownerId/userId), not new fetches, except the
// user's own catches (useCatchesByUser) which aren't in any existing list.
export function UserProfileScreen({
  userId,
  territories,
  allTerritories,
  onBack,
  onOpenTerritory,
  onOpenPhoto,
  onOpenAchievements,
  onOpenAchievementDetail,
  onOpenAllCatches,
  onDeleteUser,
  onOpenAward,
  onEditAdminAccess,
  onEditPublicId,
  onGrantCoins,
  onGrantSpins,
  onShareProfile,
  onOpenFollowers,
  onOpenAvatarPreview,
  onOpenSpecies,
  onOpenClan,
}: {
  userId: string
  territories: Territory[]
  allTerritories: Territory[]
  onBack: () => void
  onOpenTerritory: (id: string) => void
  // feedIds: swipe through only these catches (the «Трофеи» podium).
  onOpenPhoto: (catchId: number, feedIds?: number[]) => void
  onOpenAchievements: () => void
  onOpenAchievementDetail: (icon: Achievement['icon']) => void
  onOpenAllCatches: () => void
  onDeleteUser: (id: string) => void
  onOpenAward: (group: AwardGroup) => void
  onEditAdminAccess: (id: string) => void
  onEditPublicId: (id: string) => void
  onGrantCoins: (id: string) => void
  onGrantSpins: (id: string) => void
  onShareProfile: (publicId: string, text: string) => void
  onOpenFollowers: (people: ProfileSummary[]) => void
  onOpenAvatarPreview: (url: string) => void
  onOpenSpecies: (species: SpeciesEntry[]) => void
  onOpenClan: (id: number) => void
}) {
  const { data: profile } = useProfile(userId)
  const equippedFrame = resolveAvatarFrame(profile?.equippedFrame)
  const { data: catches = [], isPending: catchesPending } = useCatchesByUser(userId)
  const { data: isFollowing, isLoading: followLoading } = useIsFollowing(userId)
  const setFollowing = useSetFollowing()
  const isAdmin = useIsAdmin()
  const isSuperAdmin = useIsSuperAdmin()
  const canBlockUsers = useCanBlockUsers()
  const canMessagePlayers = useCanMessagePlayers()
  const [supportChatOpen, setSupportChatOpen] = useState(false)
  const setBlocked = useSetBlocked()
  const { data: freeze } = useAccountFreeze(userId, canBlockUsers)
  const unfreeze = useUnfreeze()
  const { data: claimedFromOthers = false } = useHasClaimedFromOthers(userId)
  const { data: earnedAchievements } = useEarnedAchievements(userId)
  const { data: reportDeletionCount } = useReportDeletionCount(userId)
  const { data: awards = [] } = useUserAwards(userId)
  const { data: followers = [] } = useFollowers(userId)
  const { user } = useAuth()
  const { data: me } = useProfile(user?.id ?? null)
  const inviteToClan = useInviteToClan()
  const [inviteState, setInviteState] = useState<'idle' | 'sent' | string>('idle')
  // Elders and up can invite someone from their own city who isn't in a
  // clan yet — the server re-checks all of this in invite_to_clan.
  const canInvite =
    !!me?.clanId && !!me.clanRole && me.clanRole !== 'member' && !profile?.clanId && !!profile && profile.city === me.city && user?.id !== userId

  const catchSpecies = speciesBreakdown(catches)
  const speciesCount = catchSpecies.length
  const topCatches = trophies(catches)
  const viewedCity = profile?.city ?? 'batumi'
  const achievements = computeAchievements(
    catches,
    {
      myTerritories: heldTerritories(allTerritories, userId),
      allTerritories,
      followersCount: profile?.followersCount ?? 0,
      claimedFromOthers,
      earned: earnedAchievements,
    },
    viewedCity
  )
  const recent = catches.slice(0, 3)
  const initials = (profile?.displayName ?? tn('common.angler')).slice(0, 2).toUpperCase()
  const territoriesRef = useRef<HTMLDivElement>(null)

  function handleShare() {
    if (!profile?.publicId) return
    onShareProfile(profile.publicId, profile.displayName ? tn('profile.otherShare', { name: profile.displayName }) : tn('profile.otherShareAnon'))
  }

  return (
    <>
      <div className="screen-inner">
      <div
        className="profile-hero"
        style={
          {
            background: resolveHeroBackground(profile?.heroBg).base,
            '--hero-accent-rgb': resolveHeroBackground(profile?.heroBg).accentRgb,
            '--hero-text-rgb': resolveHeroBackground(profile?.heroBg).textRgb ?? '255,255,255',
          } as CSSProperties
        }
      >
        <HeroBgLive bg={resolveHeroBackground(profile?.heroBg)} variant="hero" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
          <BackButton onClick={onBack} registerNative={false} />
          <div className="icon-btn tap-scale" onClick={handleShare}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 15V4M12 4 8 8M12 4l4 4" />
              <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
            </svg>
          </div>
        </div>
        <AwardsRing awards={awards} onOpenAward={onOpenAward}>
          <div className="profile-hero-avatar-ring">
            {equippedFrame && (
              <AvatarFrameRing frame={equippedFrame} />
            )}
            <button
              className="profile-hero-avatar-btn"
              style={{ cursor: profile?.avatarUrl ? 'pointer' : 'default' }}
              onClick={() => profile?.avatarUrl && onOpenAvatarPreview(profile.avatarUrl)}
              aria-label={profile?.avatarUrl ? tn('profile.openPhoto') : undefined}
            >
              <div className="profile-avatar">
                {profile?.avatarUrl ? (
                  <img src={thumbUrl(profile.avatarUrl, 240)} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  initials
                )}
              </div>
            </button>
          </div>
        </AwardsRing>
        <div className="profile-hero-name">
          <StyledName name={profile?.displayName ?? tn('profile.profileFallback')} styleId={profile?.equippedNameStyle} />
        </div>
        {profile?.clanId && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
            <button className="profile-clan-pill tap-scale" onClick={() => onOpenClan(profile.clanId!)}>
              <ClanCrest crest={profile.clanCrest} size={22} />
              {profile.clanName}
            </button>
          </div>
        )}
        {profile?.isBlocked && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
            <span className="badge" style={{ background: '#FDE2E2', color: '#D33' }}>{tn('profile.blocked')}</span>
          </div>
        )}
        <div className="profile-hero-meta">
          {profile?.createdAt && <>{tn('profile.joinedPre')}<b>{formatJoinedDate(profile.createdAt)}</b>{tn('profile.joinedPost')}</>}
          {profile?.publicId && <> · ID {profile.publicId}</>}
        </div>
        <div className="profile-hero-badge">
          <span className="section-link" style={{ color: 'rgba(var(--hero-text-rgb,255,255,255),.75)', cursor: 'default' }}>
            <Flag country={CITIES[viewedCity].country} height={13} />{' '}
            {tn('profile.city', { city: CITIES[viewedCity].name })}
          </span>
        </div>
        {profile?.bio && (
          <div style={{ fontSize: 13.5, color: 'rgba(var(--hero-text-rgb,255,255,255),.85)', marginTop: 10, lineHeight: 1.4, textAlign: 'center' }}>{profile.bio}</div>
        )}
      </div>
      <div className="profile-body">
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={isFollowing ? 'btn-secondary' : 'btn-primary'}
            style={{ flex: 1 }}
            disabled={followLoading || setFollowing.isPending}
            onClick={() => setFollowing.mutate({ followeeId: userId, following: !isFollowing })}
          >
            {isFollowing ? tn('profile.unfollow') : tn('profile.follow')}
          </button>
          {canBlockUsers && !profile?.isSuperAdmin && (
            <button
              className="btn-secondary"
              style={{ flex: 1, color: profile?.isBlocked ? undefined : '#D33' }}
              disabled={setBlocked.isPending}
              onClick={() => setBlocked.mutate({ userId, blocked: !profile?.isBlocked })}
            >
              {profile?.isBlocked ? 'Разблокировать' : 'Заблокировать'}
            </button>
          )}
        </div>
        {/* Frozen by the anti-abuse checks (02.11): what tripped, until when,
            and «Разморозить» for a false alarm; «Заблокировать» is above. */}
        {canBlockUsers && freeze && (
          <div className="card" style={{ marginTop: 10, padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, fontSize: 13.5, lineHeight: 1.4 }}>
              <b>Заморожен до {new Date(freeze.frozenUntil).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</b>
              <div style={{ color: 'var(--ink-soft)', marginTop: 2 }}>{FREEZE_REASON[freeze.reason ?? ''] ?? 'Подозрительная активность'}</div>
            </div>
            <button className="btn-secondary" style={{ width: 'auto', padding: '0 14px' }} disabled={unfreeze.isPending} onClick={() => unfreeze.mutate(userId)}>
              Разморозить
            </button>
          </div>
        )}

        {canInvite && (
          <button
            className="btn-secondary"
            style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            disabled={inviteToClan.isPending || inviteState === 'sent'}
            onClick={() =>
              inviteToClan.mutate({ userId, clanId: me!.clanId! }, {
                onSuccess: () => setInviteState('sent'),
                onError: (e) => setInviteState(clanErrorMessage(e)),
              })
            }
          >
            <ClanCrest crest={me?.clanCrest} size={20} />
            {inviteState === 'sent' ? tn('profile.inviteSent') : tn('profile.inviteTo', { clan: me?.clanName ?? '' })}
          </button>
        )}
        {inviteState !== 'idle' && inviteState !== 'sent' && <div className="clan-error" style={{ marginTop: 6 }}>{inviteState}</div>}

        {(isAdmin || isSuperAdmin) && reportDeletionCount !== undefined && (
          <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: reportDeletionCount > 0 ? '#D33' : 'var(--ink-faint)' }}>
            Удалённых модератором уловов: {reportDeletionCount}
          </div>
        )}

        {canMessagePlayers && user?.id !== userId && (
          <button className="btn-secondary" style={{ marginTop: 8 }} onClick={() => setSupportChatOpen(true)}>
            Написать в поддержку
          </button>
        )}
        {supportChatOpen && <AdminSupportChatSheet userId={userId} name={profile?.displayName ?? 'Игрок'} onClose={() => setSupportChatOpen(false)} />}

        {isSuperAdmin && !profile?.isSuperAdmin && (
          <div style={{ marginTop: 8 }}>
            <button className="btn-secondary" onClick={() => onEditAdminAccess(userId)}>
              {profile?.isAdmin ? 'Права администратора' : 'Выдать права админа'}
            </button>
          </div>
        )}

        {isSuperAdmin && !profile?.isAdmin && !profile?.isSuperAdmin && (
          <button
            className="btn-secondary"
            style={{ marginTop: 8, color: '#D33' }}
            onClick={() => onDeleteUser(userId)}
          >
            Удалить пользователя
          </button>
        )}

        {isSuperAdmin && (
          <button className="btn-secondary" style={{ marginTop: 8 }} onClick={() => onEditPublicId(userId)}>
            Изменить ID
          </button>
        )}

        {isSuperAdmin && (
          <button className="btn-secondary shop-price-btn" style={{ marginTop: 8 }} onClick={() => onGrantCoins(userId)}>
            Монеты: <CoinIcon size={16} /> {profile?.coins ?? 0}
          </button>
        )}

        {isSuperAdmin && (
          <button className="btn-secondary" style={{ marginTop: 8 }} onClick={() => onGrantSpins(userId)}>
            Прокруты слотов
          </button>
        )}

        <div className="hero-stat-grid" style={{ marginTop: 20 }}>
          <button className="hero-stat" onClick={() => territoriesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
            <b>{territories.length}</b>
            <span>{pluralTerritories(territories.length)}</span>
          </button>
          <button className="hero-stat" onClick={onOpenAllCatches}>
            {/* Not «0» before the catches are in — a grey bar until they are. */}
            <b>{catchesPending ? <span className="skel hero-stat-skel" /> : catches.length}</b>
            <span>{tn('sector.catchesLabel')}</span>
          </button>
          <button className="hero-stat" onClick={() => onOpenSpecies(catchSpecies)}>
            <b>{catchesPending ? <span className="skel hero-stat-skel" /> : speciesCount}</b>
            <span>{tn('profile.speciesOfFish', { count: speciesCount })}</span>
          </button>
          <button
            className="hero-stat"
            onClick={() => (profile?.followersCount ?? 0) > 0 && onOpenFollowers(followers)}
          >
            <b>{profile?.followersCount ?? 0}</b>
            <span>{tn('profile.followersLabel')}</span>
          </button>
        </div>

        <div className="section-title-row" style={{ marginTop: 24 }}>
          <div className="section-title">
            {tn('profile.achievements')}
            <span className="ach-count" aria-label={tn('ach.summary', { done: achievements.filter((x) => x.unlocked).length, total: achievements.length })}>
              <b>{achievements.filter((x) => x.unlocked).length}</b>/{achievements.length}
            </span>
          </div>
          <button className="section-link" onClick={onOpenAchievements}>
            {tn('profile.allAchievements')}
          </button>
        </div>
        <div className="ach-grid">
          {achievements.slice(0, 4).map((a, i) => (
            <AchievementCard key={a.icon} a={a} index={i} onOpen={() => onOpenAchievementDetail(a.icon)} />
          ))}
        </div>

        <div className="section-title-row" style={{ marginTop: 24 }}>
          <div className="section-title">{tn('profile.recentCatches')}</div>
          {catches.length > recent.length && (
            <button className="section-link" onClick={onOpenAllCatches}>
              {tn('profile.allCatches')}
            </button>
          )}
        </div>
        <div className="card" style={{ overflow: 'hidden' }}>
          {recent.length ? (
            recent.map((c, i) => <ProfileCatchRow key={c.id} c={c} last={i === recent.length - 1} onOpenPhoto={onOpenPhoto} />)
          ) : catchesPending ? (
            <SkeletonRows count={3} />
          ) : (
            <div style={{ padding: '22px 14px', textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5 }}>{tn('map.noCatches')}</div>
          )}
        </div>

        <div className="section-title" style={{ marginTop: 24 }} ref={territoriesRef}>
          {tn('terr.title')}
        </div>
        <div className="card" style={{ overflow: 'hidden' }}>
          {territories.length ? (
            territories.map((t, i) => (
              <ProfileSectorRow key={t.id} t={t} last={i === territories.length - 1} onOpen={onOpenTerritory} />
            ))
          ) : (
            <div style={{ padding: '22px 14px', textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5 }}>{tn('profile.noTerritoriesOther')}</div>
          )}
        </div>

        <ProfileTrophies catches={topCatches} onOpenPhoto={onOpenPhoto} />
      </div>
      </div>
    </>
  )
}
