'use client'

import { useState, type ReactNode } from 'react'
import { useSharePreview, useSectorsGeometry } from '@/lib/supabase/queries'
import type { GuestShare } from '@/lib/guestShare'
import type { AchievementPreview, CatchPreview, ClanPreview, PreviewCatch, TerritoryPreview, UserPreview } from '@/lib/data/sharePreview'
import type { Territory, TerritoryKind } from '@/lib/data/types'
import { KIND_LABEL, CATEGORY_GRADIENT, type SpeciesCategory } from '@/lib/data/species'
import { formatCatchMeta, formatWhen } from '@/lib/format'
import { thumbUrl } from '@/lib/supabase/imageUrl'
import { TerritoryThumbnailMapView } from '@/components/app-shell/TerritoryThumbnailMapView'
import { ClanHero } from '@/components/app-shell/ClanHero'
import { ClanCrest } from '@/components/app-shell/ClanCrest'
import { HexBadge } from '@/components/app-shell/HexBadge'
import { FishIcon, ACH_ICONS } from '@/components/app-shell/icons'
import { CLAN_ROLE_LABEL, type ClanRole } from '@/lib/data/clanLevels'
import { computeAchievements } from '@/lib/data/achievements'
import { DEFAULT_TERRITORY_COLOR } from '@/lib/data/territoryColors'

const BONUS = 100

function initials(name: string | null) {
  return (name ?? 'Рыбак').slice(0, 2).toUpperCase()
}

function Avatar({ url, name, size = 40 }: { url: string | null; name: string | null; size?: number }) {
  return (
    <span className="guest-avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}>
      {url ? <img src={thumbUrl(url, 96)} alt="" loading="lazy" decoding="async" /> : initials(name)}
    </span>
  )
}

function CatchRow({ c, onLocked }: { c: PreviewCatch; onLocked: () => void }) {
  const meta = formatCatchMeta(c.length_cm, c.weight_kg)
  return (
    <button className="guest-catch tap-scale" onClick={onLocked}>
      <span className="fish-thumb" style={{ width: 48, height: 48, background: c.photo_url ? undefined : CATEGORY_GRADIENT[(c.category as SpeciesCategory) ?? 'marine'] }}>
        {c.photo_url ? <img src={thumbUrl(c.photo_url, 160)} alt="" loading="lazy" decoding="async" /> : <FishIcon size={18} />}
      </span>
      <span className="guest-catch-text">
        <b>{c.species ?? 'Рыба'}</b>
        <span>
          {c.user.display_name ?? 'Рыбак'}
          {meta ? ` · ${meta}` : ''}
        </span>
      </span>
      <span className="guest-catch-when">{formatWhen(c.caught_at)}</span>
    </button>
  )
}

// A «Поделиться» link opened without an account: the shared screen itself,
// read-only, with a sign-up panel pinned underneath. Everything that would
// act or lead elsewhere (a profile, a catch, the map) asks to sign in
// first — there's no way out to the rest of the app until they do. Sector
// coordinates stay hidden: the point and the route come with an account.
export function GuestShareScreen({ share, onSignUp, onSignIn }: { share: GuestShare; onSignUp: () => void; onSignIn: () => void }) {
  const { data, isLoading } = useSharePreview(share.kind, share.key)
  const [nudge, setNudge] = useState<string | null>(null)
  const bonus = !!share.ref
  const locked = (what: string) => () => setNudge(what)

  let body: ReactNode = null
  let lead = 'Лови рыбу — захватывай сектора'
  let sub = bonus ? `Создай аккаунт и получи ${BONUS} монет на старт` : 'Создай аккаунт — это займёт минуту'

  if (isLoading) {
    body = <div className="guest-empty">Загрузка…</div>
  } else if (!data) {
    body = (
      <div className="guest-empty">
        <b>Здесь пусто</b>
        <span>Ссылка устарела или экран скрыт. Но рыба на месте — присоединяйся.</span>
      </div>
    )
  } else if (share.kind === 'territory') {
    const t = data as TerritoryPreview
    body = <TerritoryBody t={t} onLocked={locked} />
    lead = t.owner ? `${t.owner.display_name ?? 'Рыбак'} держит этот сектор` : 'Этот сектор пока свободен'
    sub = t.owner
      ? bonus
        ? `Зарегистрируйся — отбей его и получи ${BONUS} монет на старт`
        : 'Зарегистрируйся — и отбей его своим уловом'
      : bonus
        ? `Займи его первым — и получи ${BONUS} монет на старт`
        : 'Займи его первым своим уловом'
  } else if (share.kind === 'user') {
    const u = data as UserPreview
    body = <UserBody u={u} onLocked={locked} />
    lead = `${u.display_name ?? 'Рыбак'} уже ловит в RANGE`
    sub = bonus ? `Присоединяйся — захватывай сектора и получи ${BONUS} монет на старт` : 'Присоединяйся — захватывай сектора рядом'
  } else if (share.kind === 'catch') {
    const c = data as CatchPreview
    body = <CatchBody c={c} onLocked={locked} />
    lead = 'Каждый улов — это заявка на сектор'
    sub = bonus ? `Поймай свою рыбу, захвати сектор и получи ${BONUS} монет на старт` : 'Поймай свою рыбу и захвати сектор'
  } else if (share.kind === 'clan') {
    const c = data as ClanPreview
    body = <ClanBody c={c} onLocked={locked} />
    lead = share.invite ? `Тебя пригласили в клан «${c.name}»` : `Вступай в клан «${c.name}»`
    sub = bonus ? `Зарегистрируйся — и получи ${BONUS} монет на старт` : 'Зарегистрируйся — и вступай'
  } else if (share.kind === 'achievement') {
    const a = data as AchievementPreview
    body = <AchievementBody a={a} onLocked={locked} />
    lead = 'Открой свои достижения'
    sub = bonus ? `Лови, захватывай — и получи ${BONUS} монет на старт` : 'Лови, захватывай, собирай награды'
  }

  return (
    <div className="guest-share">
      <div className="guest-share-scroll">
        <div className="guest-topbar">
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
          <img src="/brand/logo_2.svg" alt="RANGE" className="guest-logo" />
          <span>Рыбалка, в которой сектора можно захватить</span>
        </div>
        {body}
      </div>

      <div className="guest-cta">
        <div className="guest-cta-lead">{lead}</div>
        <div className="guest-cta-sub">{sub}</div>
        <div className="guest-cta-actions">
          <button className="btn-primary" onClick={onSignUp}>
            Создать аккаунт
          </button>
          <button className="btn-secondary guest-cta-signin" onClick={onSignIn}>
            Войти
          </button>
        </div>
      </div>

      {nudge && (
        <div className="modal-overlay guest-nudge-overlay" onClick={() => setNudge(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">{nudge}</div>
            <div className="modal-body">
              Это доступно игрокам RANGE. {bonus ? `Регистрация займёт минуту, а на старте — ${BONUS} монет.` : 'Регистрация займёт минуту.'}
            </div>
            <button className="btn-primary" onClick={onSignUp}>
              Создать аккаунт
            </button>
            <button className="comments-dialog-cancel" onClick={onSignIn}>
              У меня уже есть аккаунт
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function TerritoryBody({ t, onLocked }: { t: TerritoryPreview; onLocked: (what: string) => () => void }) {
  const { data: geometry } = useSectorsGeometry()
  const corners = t.corners ?? geometry?.find((g) => g.id === t.id)?.corners ?? null
  // Only what the static mini-map reads; no coordinates beyond the outline.
  const territory: Territory | null = corners
    ? {
        id: t.id,
        kind: t.kind as TerritoryKind,
        lat: 0,
        lng: 0,
        corners,
        status: t.owner ? 'other' : 'free',
        ownerId: t.owner ? 'owner' : null,
        ownerAvatarUrl: t.owner?.avatar_url ?? null,
        ownerDisplayName: t.owner?.display_name ?? null,
        catchCount: t.catch_count,
        lastCatchAt: t.last_catch_at,
        shieldUntil: t.shield_until,
        ownerEquippedSkin: null,
        ownerClanId: t.clan?.id ?? null,
        ownerClanName: t.clan?.name ?? null,
        ownerClanCrest: t.clan?.crest ?? null,
        coHolders: (t.co_holders ?? []).map((h) => ({ id: h.id, avatarUrl: h.avatar_url, displayName: h.display_name, isMe: false })),
        capturerId: null,
        hotUntil: null,
        legendId: null,
      }
    : null

  return (
    <>
      {territory && (
        <div className="guest-hero-map">
          <TerritoryThumbnailMapView
            territory={territory}
            myTerritoryColor={DEFAULT_TERRITORY_COLOR}
            ownerAvatarUrl={t.owner?.avatar_url ?? null}
            ownerInitials={initials(t.owner?.display_name ?? null)}
          />
        </div>
      )}
      <div className="guest-card">
        <div className="page-title" style={{ marginTop: 2 }}>
          Сектор {t.id}
        </div>
        <div className="page-sub" style={{ marginBottom: 0 }}>
          {KIND_LABEL[t.kind as TerritoryKind] ?? t.kind}
        </div>
        {t.owner ? (
          <button className="guest-owner tap-scale" onClick={onLocked('Профиль рыбака — после входа')}>
            <Avatar url={t.owner.avatar_url} name={t.owner.display_name} size={44} />
            <span>
              <small>Держит сектор</small>
              <b>{t.owner.display_name ?? 'Рыбак'}</b>
            </span>
          </button>
        ) : (
          <div className="guest-free">Сектор никому не принадлежит — первый улов сделает его твоим</div>
        )}
        {t.clan && (
          <div className="guest-clan-line">
            <ClanCrest crest={t.clan.crest} size={24} />
            <span>
              Сектор клана <b>«{t.clan.name}»</b>
            </span>
          </div>
        )}
        <button className="guest-locked tap-scale" onClick={onLocked('Точка и маршрут до сектора')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
          <span>Точка на карте и маршрут — после регистрации</span>
        </button>
        <div className="guest-stats">
          <div>
            <b>{t.catch_count}</b>
            <span>уловов</span>
          </div>
          <div>
            <b>{t.last_catch_at ? formatWhen(t.last_catch_at) : '—'}</b>
            <span>последний</span>
          </div>
        </div>
      </div>
      {t.recent.length > 0 && (
        <div className="guest-section">
          <div className="guest-section-title">Последние уловы здесь</div>
          {t.recent.map((c) => (
            <CatchRow key={c.id} c={c} onLocked={onLocked('Улов целиком — после входа')} />
          ))}
        </div>
      )}
    </>
  )
}

function UserBody({ u, onLocked }: { u: UserPreview; onLocked: (what: string) => () => void }) {
  return (
    <>
      <div className="guest-card guest-profile">
        <Avatar url={u.avatar_url} name={u.display_name} size={84} />
        <div className="guest-profile-name">{u.display_name ?? 'Рыбак'}</div>
        <div className="guest-profile-meta">
          {u.city === 'moscow' ? 'Москва' : 'Батуми'}
          {u.public_id ? ` · ID ${u.public_id}` : ''}
        </div>
        {u.clan && (
          <div className="guest-clan-line" style={{ justifyContent: 'center' }}>
            <ClanCrest crest={u.clan.crest} size={22} />
            <span>
              Клан <b>«{u.clan.name}»</b>
            </span>
          </div>
        )}
        <div className="guest-stats">
          <div>
            <b>{u.sectors}</b>
            <span>секторов</span>
          </div>
          <div>
            <b>{u.catches}</b>
            <span>уловов</span>
          </div>
        </div>
      </div>
      {u.recent.length > 0 && (
        <div className="guest-section">
          <div className="guest-section-title">Последние уловы</div>
          <div className="guest-grid">
            {u.recent.map((c) => (
              <button key={c.id} className="guest-grid-item tap-scale" onClick={onLocked('Улов целиком — после входа')}>
                {c.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- same thumb pipeline as the rest of the app
                  <img src={thumbUrl(c.photo_url, 240)} alt={c.species ?? ''} loading="lazy" decoding="async" />
                ) : (
                  <FishIcon size={20} />
                )}
                <span>{c.species ?? 'Рыба'}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

function CatchBody({ c, onLocked }: { c: CatchPreview; onLocked: (what: string) => () => void }) {
  const meta = formatCatchMeta(c.length_cm, c.weight_kg)
  return (
    <>
      <div className="guest-photo">
        {c.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- same thumb pipeline as the rest of the app
          <img src={thumbUrl(c.photo_url, 960)} alt={c.species ?? ''} decoding="async" />
        ) : (
          <FishIcon size={40} />
        )}
      </div>
      <div className="guest-card">
        <div className="page-title" style={{ marginTop: 2 }}>
          {c.species ?? 'Улов'}
        </div>
        {meta && <div className="page-sub" style={{ marginBottom: 0 }}>{meta}</div>}
        <button className="guest-owner tap-scale" onClick={onLocked('Профиль рыбака — после входа')}>
          <Avatar url={c.user.avatar_url} name={c.user.display_name} size={44} />
          <span>
            <small>Поймал · {formatWhen(c.caught_at)}</small>
            <b>{c.user.display_name ?? 'Рыбак'}</b>
          </span>
        </button>
        <div className="guest-clan-line">
          <span>
            Сектор <b>{c.territory_id}</b>
            {c.territory_kind ? ` · ${KIND_LABEL[c.territory_kind as TerritoryKind] ?? ''}` : ''}
          </span>
        </div>
        <div className="guest-reactions">
          <button className="tap-scale" onClick={onLocked('Лайкнуть улов')}>
            ♥ {c.likes}
          </button>
          <button className="tap-scale" onClick={onLocked('Комментарии')}>
            Комментарии · {c.comments}
          </button>
        </div>
      </div>
    </>
  )
}

function ClanBody({ c, onLocked }: { c: ClanPreview; onLocked: (what: string) => () => void }) {
  return (
    <>
      <ClanHero crest={c.crest} name={c.name} motto={c.motto} background={c.background} golden={c.level >= 10}>
        <div className="clan-chips">
          <span className="clan-chip">Ур. {c.level}</span>
          <span className="clan-chip">{c.trophies} трофеев</span>
          <span className="clan-chip">
            {c.members}/{c.capacity}
          </span>
          <span className="clan-chip">{c.city === 'moscow' ? 'Москва' : 'Батуми'}</span>
        </div>
      </ClanHero>
      {c.top.length > 0 && (
        <div className="guest-section">
          <div className="guest-section-title">Участники</div>
          {c.top.map((m, i) => (
            <button key={i} className="guest-member tap-scale" onClick={onLocked('Профиль рыбака — после входа')}>
              <Avatar url={m.avatar_url} name={m.display_name} size={38} />
              <b>{m.display_name ?? 'Рыбак'}</b>
              {m.role !== 'member' && <span>{CLAN_ROLE_LABEL[m.role as ClanRole]}</span>}
            </button>
          ))}
        </div>
      )}
    </>
  )
}

function AchievementBody({ a, onLocked }: { a: AchievementPreview; onLocked: (what: string) => () => void }) {
  // Titles and texts live with the achievements themselves; which one — from the link.
  const meta = computeAchievements([], { myTerritories: [], allTerritories: [], followersCount: 0, claimedFromOthers: false }, 'batumi').find(
    (x) => x.icon === a.icon
  )
  return (
    <div className="guest-card guest-achievement">
      <div className="guest-ach-badge">
        <HexBadge unlocked icon={ACH_ICONS[a.icon] ?? null} strokeWidth={3} />
      </div>
      <div className="guest-profile-name">{meta?.title ?? 'Достижение'}</div>
      {meta?.desc && <div className="guest-profile-meta">{meta.desc}</div>}
      {meta?.flavor && <div className="guest-ach-flavor">«{meta.flavor}»</div>}
      <button className="guest-owner tap-scale" style={{ justifyContent: 'center' }} onClick={onLocked('Профиль рыбака — после входа')}>
        <Avatar url={a.avatar_url} name={a.display_name} size={36} />
        <span>
          <small>Открыл</small>
          <b>{a.display_name ?? 'Рыбак'}</b>
        </span>
      </button>
    </div>
  )
}
