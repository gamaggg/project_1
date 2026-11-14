'use client'

import { useState } from 'react'
import { BackButton } from '@/components/app-shell/BackButton'
import { PartnerStatsView } from '@/components/app-shell/PartnerStatsView'
import { useSharedPartnerPoints } from '@/lib/supabase/queries'

// «Статистика точки» for a partner: the points whose statistics the super admin shared with this account
// (partner_points_shared_with_me), one at a time; with several, chips to switch between them.
export function PartnerStatsScreen({ onBack, active }: { onBack: () => void; active: boolean }) {
  const { data: points = [], isLoading } = useSharedPartnerPoints(active)
  const [picked, setPicked] = useState<number | null>(null)
  const point = points.find((p) => p.id === picked) ?? points[0] ?? null

  return (
    <>
      <div className="header-row">
        <BackButton onClick={onBack} registerNative={false} />
        <div style={{ fontWeight: 800, fontSize: 15 }}>Статистика точки</div>
        <div style={{ width: 36 }} />
      </div>
      <div className="screen-inner">
        {isLoading && <div className="stats-note">Загружаем…</div>}
        {!isLoading && !point && <div className="stats-note">Статистику точек вам пока не открывали.</div>}
        {points.length > 1 && (
          <div className="ppa-chips">
            {points.map((p) => (
              <button key={p.id} type="button" className={`filter-chip${point?.id === p.id ? ' active' : ''}`} onClick={() => setPicked(p.id)}>
                {p.name}
              </button>
            ))}
          </div>
        )}
        {point && active && <PartnerStatsView key={point.id} pointId={point.id} city={point.city} name={point.name} startsAt={point.startsAt} />}
      </div>
    </>
  )
}
