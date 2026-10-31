import type { ForecastPoint } from './bite'

// «Завтра утром хороший клёв у твоего сектора» (api/telegram/forecast-alert): the
// sectors held in a city, grouped by forecast point so one Open-Meteo call covers
// every sector around it, and the messages to ask queue_sector_forecast for.

export type HeldSector = { id: string; kind: string; lat: number; lng: number; owner_id: string | null }
export type SectorShare = { territory_id: string; user_id: string }

export type ForecastGroup = {
  point: ForecastPoint
  // Sea sectors read waves at their own point, as the sector's forecast card does.
  sea: ForecastPoint | null
  sectors: { id: string; holders: string[] }[]
}

export type SectorForecastItem = { user_id: string; territory_id: string; score: number; from: string; to: string }

// 0.1° is a few kilometres — finer than the weather model tells apart.
const GRID = 10

export function groupHeldSectors(sectors: HeldSector[], shares: SectorShare[]): ForecastGroup[] {
  const sharers = new Map<string, string[]>()
  for (const s of shares) sharers.set(s.territory_id, [...(sharers.get(s.territory_id) ?? []), s.user_id])
  const groups = new Map<string, ForecastGroup>()
  for (const t of sectors) {
    const holders = [...new Set([...(t.owner_id ? [t.owner_id] : []), ...(sharers.get(t.id) ?? [])])]
    if (!holders.length) continue
    const sea = t.kind === 'sea'
    const lat = Math.round(t.lat * GRID) / GRID
    const lng = Math.round(t.lng * GRID) / GRID
    const key = `${lat},${lng},${sea ? 'sea' : 'land'}`
    let g = groups.get(key)
    if (!g) {
      g = { point: { lat, lng }, sea: sea ? { lat, lng } : null, sectors: [] }
      groups.set(key, g)
    }
    g.sectors.push({ id: t.id, holders })
  }
  return [...groups.values()]
}

const hh = (h: number) => `${String(h % 24).padStart(2, '0')}:00`

// One item per holder and sector of a group whose morning scored 4–5; the
// database keeps one message per player (the best sector) and the weekly limits.
export function sectorForecastItems(group: ForecastGroup, morning: { score: number; from: number; to: number } | null): SectorForecastItem[] {
  if (!morning || morning.score < 4) return []
  return group.sectors.flatMap((s) =>
    s.holders.map((user_id) => ({ user_id, territory_id: s.id, score: morning.score, from: hh(morning.from), to: hh(morning.to) }))
  )
}
