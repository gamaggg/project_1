// A "city" is a lens over one shared sectors/territories world. Every sector
// id already carries its city as a prefix (see tools/fishing-hex: Batumi =
// "B", Moscow = "M"), so a city is just that prefix plus some display/map-
// defaults metadata. Which city an account is currently in is a real
// `profiles.city` column (set at onboarding's CityStep, changeable later from
// Профиль) — loadStoredCity/storeCity below are only a same-device, no-
// network-wait cache of that value for the first paint, not the source of
// truth. Adding a third city later means one more entry here plus a
// migration to teach get_weekly_leaderboard's p_city_prefix about it.
export type CityId = 'batumi' | 'moscow'

export type CityInfo = {
  id: CityId
  idPrefix: string
  name: string
  // Shown under the page title on the Территории tab.
  boundaryLabel: string
  timezone: string
  center: [number, number]
  zoom: number
  // Anchor for ChangeColorModal's neighborhood preview — a real, recognizable,
  // densely-claimed spot rather than "wherever the viewer's own first sector
  // happens to be" (which could be anywhere, or not exist yet for a brand-new
  // account with zero territories).
  colorPreviewCenter: [number, number]
}

export const CITIES: Record<CityId, CityInfo> = {
  batumi: {
    id: 'batumi',
    idPrefix: 'B',
    name: 'Батуми',
    boundaryLabel: 'Море, реки и озёра Батуми',
    timezone: 'Asia/Tbilisi',
    center: [41.6513, 41.6325],
    zoom: 14.3,
    // Batumi sea port.
    colorPreviewCenter: [41.6555, 41.6414],
  },
  moscow: {
    id: 'moscow',
    idPrefix: 'M',
    // Moskva river bend right by the Kremlin (sector M2065, ~300m away) —
    // same idea as Batumi's own anchor below: a real sector cluster, not the
    // geometric centroid of the whole city, zoomed in to match Batumi's own
    // close-up default instead of showing the entire MKAD ring at once.
    name: 'Москва',
    boundaryLabel: 'Реки, озёра и пруды Москвы',
    timezone: 'Europe/Moscow',
    center: [55.7522, 37.6228],
    zoom: 14.3,
    // Kremlin embankment.
    colorPreviewCenter: [55.7485, 37.6180],
  },
}

export const CITY_LIST: CityInfo[] = [CITIES.batumi, CITIES.moscow]

export function cityForSectorId(id: string): CityId {
  return id.startsWith(CITIES.moscow.idPrefix) ? 'moscow' : 'batumi'
}

const STORAGE_KEY = 'range-city'

export function loadStoredCity(): CityId {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'batumi' || saved === 'moscow') return saved
  } catch {}
  return 'batumi'
}

export function storeCity(city: CityId) {
  try {
    localStorage.setItem(STORAGE_KEY, city)
  } catch {}
}
