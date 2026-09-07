'use client'

import { useAuth } from '@/components/providers/AuthProvider'
import { useProfile, useMyCatches } from '@/lib/supabase/queries'
import { computeAchievements, personalRecord } from '@/lib/data/achievements'
import { speciesInfo, SPECIES_GRADIENT, KIND_LABEL } from '@/lib/data/species'
import { formatWeight } from '@/lib/format'
import { FishIcon, ACH_ICONS } from '@/components/app-shell/icons'
import type { Territory } from '@/lib/data/types'

export function ProfileScreen({ myTerritories, onOpenTerritory, onSignOut }: { myTerritories: Territory[]; onOpenTerritory: (id: string) => void; onSignOut: () => void }) {
  const { user } = useAuth()
  const { data: profile } = useProfile(user?.id ?? null)
  const { data: myCatches = [] } = useMyCatches()

  const speciesCount = new Set(myCatches.map((c) => c.species)).size
  const record = personalRecord(myCatches)
  const achievements = computeAchievements(myCatches, myTerritories)
  const recentMine = myCatches.slice(0, 3)
  const initials = (profile?.display_name ?? 'Рыбак').slice(0, 2).toUpperCase()

  return (
    <div className="screen-inner">
      <div className="page-title" style={{ textAlign: 'center', marginTop: 14 }}>
        Профиль
      </div>
      <div className="profile-avatar">{initials}</div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 19, fontWeight: 800 }}>{profile?.display_name ?? '…'}</div>
        <div style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginTop: 2 }}>{profile?.location ?? 'Аджария, Грузия'}</div>
      </div>
      <div className="card stat-grid4" style={{ marginTop: 20, padding: '16px 8px' }}>
        <div>
          <div className="stat-num">{myTerritories.length}</div>
          <div className="stat-label">Территорий</div>
        </div>
        <div>
          <div className="stat-num">{myCatches.length}</div>
          <div className="stat-label">Уловов</div>
        </div>
        <div>
          <div className="stat-num">{speciesCount}</div>
          <div className="stat-label">Видов рыб</div>
        </div>
        <div>
          <div className="stat-num">{profile?.followers_count ?? 0}</div>
          <div className="stat-label">Подписчика</div>
        </div>
      </div>

      <div className="section-title" style={{ marginTop: 24 }}>
        Достижения
      </div>
      <div className="ach-grid">
        {achievements.map((a) => (
          <div className={`ach-card${a.unlocked ? '' : ' locked'}`} key={a.icon}>
            <div className={`ach-icon ${a.unlocked ? 'on' : 'off'}`}>{ACH_ICONS[a.icon]}</div>
            <div>
              <div className="ach-title">{a.title}</div>
              <div className="ach-desc">{a.desc}</div>
              {!a.unlocked && a.progress && <div className="ach-progress">{a.progress}</div>}
            </div>
          </div>
        ))}
      </div>

      <div className="section-title" style={{ marginTop: 24 }}>
        Последние уловы
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        {recentMine.length ? (
          recentMine.map((c, i) => {
            const sp = speciesInfo(c.species)
            return (
              <div
                key={c.id}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: i < recentMine.length - 1 ? '1px solid var(--line)' : 'none' }}
              >
                <div className="fish-thumb" style={{ width: 46, height: 46, background: SPECIES_GRADIENT[c.species] }}>
                  <FishIcon size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5 }}>{sp.name}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 1 }}>
                    {c.lengthCm} см · {formatWeight(c.weightKg)} кг
                  </div>
                </div>
              </div>
            )
          })
        ) : (
          <div style={{ padding: '22px 14px', textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5 }}>Пока нет уловов</div>
        )}
      </div>

      <div className="section-title" style={{ marginTop: 24 }}>
        Мои территории
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        {myTerritories.length ? (
          myTerritories.map((t, i) => (
            <button
              key={t.id}
              className="terr-list-item"
              style={{ borderBottom: i < myTerritories.length - 1 ? '1px solid var(--line)' : 'none' }}
              onClick={() => onOpenTerritory(t.id)}
            >
              <div style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--green)' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>{t.id}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2 }}>{KIND_LABEL[t.kind]}</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A8A9AE" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          ))
        ) : (
          <div style={{ padding: '22px 14px', textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5 }}>Пока нет своих территорий</div>
        )}
      </div>

      {record && (
        <>
          <div className="section-title" style={{ marginTop: 24 }}>
            Личный рекорд
          </div>
          <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="fish-thumb" style={{ width: 52, height: 52, background: SPECIES_GRADIENT[record.species] }}>
              <FishIcon size={24} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{speciesInfo(record.species).name}</div>
              <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 700, marginTop: 2 }}>{record.lengthCm} см</div>
            </div>
          </div>
        </>
      )}

      <div style={{ marginTop: 24 }}>
        <button className="btn-secondary" onClick={onSignOut}>
          Выйти
        </button>
      </div>
    </div>
  )
}
