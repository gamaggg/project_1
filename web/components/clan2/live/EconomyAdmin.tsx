'use client'

import '@/app/clan2.css'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

// «Клановая экономика» in the super admin's «Управление»: the switch of the clan update for everybody and the pilot
// clans that have it before (supabase-drafts/clan-update-06-11: clan_economy.enabled, pilot_clans; admin_set_clan_economy).
// Until the migrations are applied there is nothing to switch: the window says so. Admin tools are in Russian only.

type Economy = { enabled: boolean; pilot: number[] }
type ClanRow = { id: number; name: string; city: string }

const any = (s: ReturnType<typeof createClient>) => s as unknown as {
  from: (t: string) => { select: (c: string) => { eq: (k: string, v: number) => { maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: unknown }> }; is: (k: string, v: null) => { order: (c: string) => Promise<{ data: Record<string, unknown>[] | null; error: unknown }> } } }
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }>
}

export function EconomyAdmin({ onClose }: { onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['clan2-economy-admin'],
    queryFn: async (): Promise<{ econ: Economy | null; clans: ClanRow[] }> => {
      const s = any(createClient())
      const [e, c] = await Promise.all([
        s.from('clan_economy').select('enabled,pilot_clans').eq('id', 1).maybeSingle(),
        s.from('clans').select('id,name,city').is('disbanded_at', null).order('name'),
      ])
      const econ = e.error || !e.data ? null : { enabled: !!e.data.enabled, pilot: ((e.data.pilot_clans as number[] | null) ?? []).map(Number) }
      return { econ, clans: (c.data ?? []).map((r) => ({ id: Number(r.id), name: String(r.name), city: String(r.city) })) }
    },
  })
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card c2-econ-admin" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Клановая экономика</div>
        {isLoading ? (
          <div className="modal-body">Загружаю…</div>
        ) : !data?.econ ? (
          <div className="modal-body">На сервере ещё нет кланового обновления: миграции не применены.</div>
        ) : (
          <EconomyForm econ={data.econ} clans={data.clans} onDone={onClose} />
        )}
        <button className="btn-secondary" style={{ marginTop: 8 }} onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  )
}

function EconomyForm({ econ, clans, onDone }: { econ: Economy; clans: ClanRow[]; onDone: () => void }) {
  const qc = useQueryClient()
  const [enabled, setEnabled] = useState(econ.enabled)
  const [pilot, setPilot] = useState<number[]>(econ.pilot)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const save = async () => {
    setSaving(true)
    setError(null)
    const { error: err } = await any(createClient()).rpc('admin_set_clan_economy', { p: { enabled, pilot_clans: pilot } })
    setSaving(false)
    if (err) return setError('Не получилось: ' + err.message)
    await qc.invalidateQueries({ queryKey: ['clan2-access'] })
    await qc.invalidateQueries({ queryKey: ['clan2-economy-admin'] })
    onDone()
  }
  return (
    <>
      <div className="modal-body">
        Пока выключено для всех, обновление работает только у пробных кланов (и его видишь ты). Включить для всех — это и есть запуск;
        личную Казну после этого закрывают отдельной командой (последний сбор начисляется игрокам сам).
      </div>
      <label className="c2-econ-switch">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        <b>Включено для всех кланов</b>
      </label>
      <div className="c2-econ-sub">Пробные кланы</div>
      <div className="c2-econ-list">
        {clans.map((c) => (
          <label key={c.id} className="c2-econ-row">
            <input type="checkbox" checked={pilot.includes(c.id)} onChange={(e) => setPilot((p) => (e.target.checked ? [...p, c.id] : p.filter((x) => x !== c.id)))} />
            <span>{c.name}</span>
            <small>{c.city}</small>
          </label>
        ))}
      </div>
      {error && <div className="c2-econ-error">{error}</div>}
      <button className={enabled && !econ.enabled ? 'btn-danger' : 'btn-primary'} disabled={saving} onClick={() => void save()}>
        {enabled && !econ.enabled ? 'Включить для всех' : 'Сохранить'}
      </button>
    </>
  )
}
