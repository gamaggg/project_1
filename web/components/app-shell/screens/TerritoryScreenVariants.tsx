'use client'

// TEMPORARY — 3 redesign variants of TerritoryScreen.tsx for live
// comparison (see FishZoneApp's sector-variant-switcher). All three keep
// the exact same data/behavior as the original screen — only composition
// changes. Delete the two not picked, and fold the winner back into
// TerritoryScreen.tsx as the only implementation, once one is chosen.

import { useCatchesByTerritory, useProfile, useCanAddCatchManually, useIsSuperAdmin } from '@/lib/supabase/queries'
import { KIND_LABEL } from '@/lib/data/species'
import { formatCatchMeta, formatWhen } from '@/lib/format'
import type { Territory } from '@/lib/data/types'
import { TerritoryThumbnailMapView } from '@/components/app-shell/TerritoryThumbnailMapView'
import { BackButton } from '@/components/app-shell/BackButton'
import { statusBadge, OwnerRow, CatcherLabel } from '@/components/app-shell/screens/TerritoryScreen'

type Props = {
  territory: Territory
  isMostPopular: boolean
  onBack: () => void
  onOpenUser: (id: string) => void
  onOpenPhoto: (catchId: number) => void
  onAdminCatch: (territoryId: string) => void
  onDeleteTerritory: (territoryId: string) => void
  onShare: () => void
  onOpenAllCatches: () => void
  myTerritoryColor: string
}

function ShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#17181B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 15V4M12 4 8 8M12 4l4 4" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  )
}

// ---------- Variant A: map-led, identity card docked over a hero map ----------
export function TerritoryScreenVariantA({
  territory,
  isMostPopular,
  onBack,
  onOpenUser,
  onOpenPhoto,
  onAdminCatch,
  onDeleteTerritory,
  onShare,
  onOpenAllCatches,
  myTerritoryColor,
}: Props) {
  const canAddCatchManually = useCanAddCatchManually()
  const isSuperAdmin = useIsSuperAdmin()
  const { data: catches = [] } = useCatchesByTerritory(territory.id)
  const { data: ownerProfile } = useProfile(territory.ownerId ?? null)
  const recent = catches.slice(0, 3)

  return (
    <div className="screen-inner" style={{ padding: 0 }}>
      <div className="sector-hero-map">
        <TerritoryThumbnailMapView
          territory={territory}
          myTerritoryColor={myTerritoryColor}
          ownerAvatarUrl={ownerProfile?.avatarUrl ?? null}
          ownerInitials={(ownerProfile?.displayName ?? 'Рыбак').slice(0, 2).toUpperCase()}
        />
        <div className="sector-hero-map-icons">
          <BackButton onClick={onBack} registerNative={false} />
          <div className="icon-btn tap-scale" onClick={onShare}>
            <ShareIcon />
          </div>
        </div>
      </div>
      <div style={{ padding: '0 20px 100px' }}>
        <div className="sector-dock-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div className="page-title" style={{ marginTop: 2 }}>
              Сектор {territory.id}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
              {statusBadge(territory.status, myTerritoryColor)}
              {isMostPopular && <span className="badge badge-accent">🔥 Самый популярный</span>}
            </div>
          </div>
          <div className="page-sub" style={{ marginBottom: 0 }}>
            {KIND_LABEL[territory.kind]}
          </div>
          {territory.ownerId && <OwnerRow ownerId={territory.ownerId} isMine={territory.status === 'mine'} onOpenUser={onOpenUser} />}
          {canAddCatchManually && (
            <button className="btn-secondary" style={{ marginTop: 12 }} onClick={() => onAdminCatch(territory.id)}>
              Добавить улов (админ)
            </button>
          )}
        </div>

        <div className="sector-stat-strip">
          <div>
            <div className="value">{territory.catchCount}</div>
            <div className="label">Уловов</div>
          </div>
          <div>
            <div className="value" style={{ fontSize: 14 }}>{territory.lastCatchAt ? formatWhen(territory.lastCatchAt) : '—'}</div>
            <div className="label">Последний</div>
          </div>
          <div>
            <div className="value">≈600 м</div>
            <div className="label">Размер</div>
          </div>
          <div>
            <div className="value" style={{ fontSize: 14 }}>{KIND_LABEL[territory.kind]}</div>
            <div className="label">Тип</div>
          </div>
        </div>

        <div className="section-title-row" style={{ marginTop: 22 }}>
          <div className="section-title">Последние уловы</div>
          {catches.length > recent.length && (
            <button className="section-link" onClick={onOpenAllCatches}>
              Все уловы
            </button>
          )}
        </div>
        {recent.length ? (
          recent.map((c) => {
            const meta = formatCatchMeta(c.lengthCm, c.weightKg)
            return (
              <div key={c.id} className="sector-row-plain tap-scale" style={{ cursor: 'pointer' }} onClick={() => onOpenPhoto(c.id)}>
                <div className="fish-thumb" style={{ width: 46, height: 46 }}>
                  <img src={c.photoUrl} alt={c.speciesName} />
                </div>
                <div style={{ flex: 1 }}>
                  <CatcherLabel userId={c.userId} mine={c.mine} onOpenUser={onOpenUser} />
                  <div style={{ fontWeight: 700, fontSize: 14.5 }}>{c.speciesName}</div>
                  {meta && <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 1 }}>{meta}</div>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-faint)', fontWeight: 600 }}>{formatWhen(c.caughtAt).split('·')[0].trim()}</div>
              </div>
            )
          })
        ) : (
          <div style={{ padding: '22px 0', textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5 }}>Пока нет уловов в этом секторе</div>
        )}

        {isSuperAdmin && (
          <button className="btn-secondary" style={{ marginTop: 24, color: '#D33' }} onClick={() => onDeleteTerritory(territory.id)}>
            Удалить сектор
          </button>
        )}
      </div>
    </div>
  )
}

// ---------- Variant B: editorial — display headline + scoreboard + film-strip catches ----------
export function TerritoryScreenVariantB({
  territory,
  isMostPopular,
  onBack,
  onOpenUser,
  onOpenPhoto,
  onAdminCatch,
  onDeleteTerritory,
  onShare,
  onOpenAllCatches,
  myTerritoryColor,
}: Props) {
  const canAddCatchManually = useCanAddCatchManually()
  const isSuperAdmin = useIsSuperAdmin()
  const { data: catches = [] } = useCatchesByTerritory(territory.id)
  const { data: ownerProfile } = useProfile(territory.ownerId ?? null)
  const recent = catches.slice(0, 6)

  return (
    <>
      <div className="header-row">
        <BackButton onClick={onBack} registerNative={false} />
        <div className="icon-btn tap-scale" onClick={onShare}>
          <ShareIcon />
        </div>
      </div>
      <div className="screen-inner">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {statusBadge(territory.status, myTerritoryColor)}
          {isMostPopular && <span className="badge badge-accent">🔥 Самый популярный</span>}
        </div>
        <div className="sector-editorial-head">
          <div>
            <div className="sector-editorial-title">{territory.id}</div>
            <div className="sector-editorial-kind">{KIND_LABEL[territory.kind]} · ≈600 м</div>
          </div>
          <div className="sector-editorial-thumb">
            <TerritoryThumbnailMapView
              territory={territory}
              myTerritoryColor={myTerritoryColor}
              ownerAvatarUrl={ownerProfile?.avatarUrl ?? null}
              ownerInitials={(ownerProfile?.displayName ?? 'Рыбак').slice(0, 2).toUpperCase()}
            />
          </div>
        </div>

        <div className="sector-scoreboard">
          <div>
            <div className="value">{territory.catchCount}</div>
            <div className="label">Уловов</div>
          </div>
          <div>
            <div className="value" style={{ fontSize: 15 }}>{territory.lastCatchAt ? formatWhen(territory.lastCatchAt) : '—'}</div>
            <div className="label">Последний улов</div>
          </div>
        </div>

        {territory.ownerId && (
          <div style={{ marginTop: 4 }}>
            <OwnerRow ownerId={territory.ownerId} isMine={territory.status === 'mine'} onOpenUser={onOpenUser} />
          </div>
        )}
        {canAddCatchManually && (
          <button className="btn-secondary" style={{ marginTop: 12 }} onClick={() => onAdminCatch(territory.id)}>
            Добавить улов (админ)
          </button>
        )}

        <div className="section-title-row" style={{ marginTop: 26 }}>
          <div className="section-title">Последние уловы</div>
          {catches.length > recent.length && (
            <button className="section-link" onClick={onOpenAllCatches}>
              Все уловы
            </button>
          )}
        </div>
        {recent.length ? (
          <div className="sector-filmstrip">
            {recent.map((c) => {
              const meta = formatCatchMeta(c.lengthCm, c.weightKg)
              return (
                <div key={c.id} className="sector-filmstrip-item tap-scale" onClick={() => onOpenPhoto(c.id)}>
                  <div className="sector-filmstrip-photo">
                    <img src={c.photoUrl} alt={c.speciesName} />
                  </div>
                  <div className="sector-filmstrip-caption">
                    <div style={{ fontWeight: 700, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.speciesName}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 1 }}>{meta || formatWhen(c.caughtAt).split('·')[0].trim()}</div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ padding: '22px 0', textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5 }}>Пока нет уловов в этом секторе</div>
        )}

        {isSuperAdmin && (
          <button className="btn-secondary" style={{ marginTop: 26, color: '#D33' }} onClick={() => onDeleteTerritory(territory.id)}>
            Удалить сектор
          </button>
        )}
      </div>
    </>
  )
}

// ---------- Variant C: continuous flow — no nested cards, compact identity + inline stats ----------
export function TerritoryScreenVariantC({
  territory,
  isMostPopular,
  onBack,
  onOpenUser,
  onOpenPhoto,
  onAdminCatch,
  onDeleteTerritory,
  onShare,
  onOpenAllCatches,
  myTerritoryColor,
}: Props) {
  const canAddCatchManually = useCanAddCatchManually()
  const isSuperAdmin = useIsSuperAdmin()
  const { data: catches = [] } = useCatchesByTerritory(territory.id)
  const { data: ownerProfile } = useProfile(territory.ownerId ?? null)
  const recent = catches.slice(0, 3)

  return (
    <>
      <div className="header-row">
        <BackButton onClick={onBack} registerNative={false} />
        <div className="icon-btn tap-scale" onClick={onShare}>
          <ShareIcon />
        </div>
      </div>
      <div className="screen-inner">
        <div className="sector-compact-head">
          <div className="sector-compact-thumb">
            <TerritoryThumbnailMapView
              territory={territory}
              myTerritoryColor={myTerritoryColor}
              ownerAvatarUrl={ownerProfile?.avatarUrl ?? null}
              ownerInitials={(ownerProfile?.displayName ?? 'Рыбак').slice(0, 2).toUpperCase()}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div className="page-title" style={{ marginTop: 0, fontSize: 24 }}>
                Сектор {territory.id}
              </div>
              {statusBadge(territory.status, myTerritoryColor)}
            </div>
            <div className="page-sub" style={{ marginBottom: 0 }}>
              {KIND_LABEL[territory.kind]}
              {isMostPopular && <> · 🔥 Самый популярный</>}
            </div>
          </div>
        </div>

        <div className="sector-inline-stats">
          <div>
            <span className="label">Уловов</span>
            <span className="value">{territory.catchCount}</span>
          </div>
          <div>
            <span className="label">Последний</span>
            <span className="value">{territory.lastCatchAt ? formatWhen(territory.lastCatchAt) : '—'}</span>
          </div>
          <div>
            <span className="label">Размер</span>
            <span className="value">≈600 м</span>
          </div>
        </div>

        {territory.ownerId && <OwnerRow ownerId={territory.ownerId} isMine={territory.status === 'mine'} onOpenUser={onOpenUser} />}
        {canAddCatchManually && (
          <button className="btn-secondary" style={{ marginTop: 12 }} onClick={() => onAdminCatch(territory.id)}>
            Добавить улов (админ)
          </button>
        )}

        <div className="section-title-row" style={{ marginTop: 22 }}>
          <div className="section-title">Последние уловы</div>
          {catches.length > recent.length && (
            <button className="section-link" onClick={onOpenAllCatches}>
              Все уловы
            </button>
          )}
        </div>
        {recent.length ? (
          recent.map((c) => {
            const meta = formatCatchMeta(c.lengthCm, c.weightKg)
            return (
              <div key={c.id} className="sector-row-plain tap-scale" style={{ cursor: 'pointer' }} onClick={() => onOpenPhoto(c.id)}>
                <div className="fish-thumb" style={{ width: 46, height: 46 }}>
                  <img src={c.photoUrl} alt={c.speciesName} />
                </div>
                <div style={{ flex: 1 }}>
                  <CatcherLabel userId={c.userId} mine={c.mine} onOpenUser={onOpenUser} />
                  <div style={{ fontWeight: 700, fontSize: 14.5 }}>{c.speciesName}</div>
                  {meta && <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 1 }}>{meta}</div>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-faint)', fontWeight: 600 }}>{formatWhen(c.caughtAt).split('·')[0].trim()}</div>
              </div>
            )
          })
        ) : (
          <div style={{ padding: '22px 0', textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5 }}>Пока нет уловов в этом секторе</div>
        )}

        {isSuperAdmin && (
          <div className="sector-danger-zone">
            <button className="btn-secondary" style={{ color: '#D33' }} onClick={() => onDeleteTerritory(territory.id)}>
              Удалить сектор
            </button>
          </div>
        )}
      </div>
    </>
  )
}
