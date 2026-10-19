import { tn } from '@/lib/i18n/runtime'
// A "city" is a lens over one shared sectors/territories world. Every sector
// id already carries its city as a prefix (see tools/fishing-hex: Batumi =
// "B", Moscow = "M"), so a city is just that prefix plus some display/map-
// defaults metadata. Which city an account is currently in is a real
// `profiles.city` column (set at onboarding's CityStep, changeable later from
// Профиль) — loadStoredCity/storeCity below are only a same-device, no-
// network-wait cache of that value for the first paint, not the source of
// truth. Adding a city means one more entry here, a row in public.city_config (prefix,
// time zone, theme, jackpot frame: every SQL function reads the city from there) and its
// sectors in public.territories (tools/fishing-hex/build_hex_city.mjs).
export type CityId = 'batumi' | 'moscow' | 'spb' | 'sochi' | 'tbilisi'
// The country a city is in: the city pickers ask for the country first (flag, then its cities).
export type CountryId = 'ge' | 'ru'

export type CityInfo = {
  id: CityId
  country: CountryId
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
  // Open sea off the city for the bite forecast's waves (Open-Meteo marine).
  // Null where there's no sea.
  seaPoint: [number, number] | null
  // Which set of species and achievements the city plays: «sea» has the marine /
  // freshwater split (Batumi, Sochi), «fresh» the predator / peaceful one (Moscow,
  // Saint Petersburg, Tbilisi). Same value as public.city_config.theme.
  theme: 'sea' | 'fresh'
  // The water kinds the city's map actually has (see lib/data/species).
  waterKinds: ('sea' | 'river' | 'lake' | 'pond')[]
  // The map zoom is written for Batumi; the same zoom shows a sector bigger the further
  // north the city is, so each city carries a FIXED shift to the zoom: log2(cos(lat) /
  // cos(41.65°)) rounded, never computed from the map centre (that moved label
  // thresholds by a hair, LeafletMap.tsx).
  zoomShift: number
}

export const CITIES: Record<CityId, CityInfo> = {
  batumi: {
    id: 'batumi',
    country: 'ge',
    idPrefix: 'B',
    get name() {
      return tn('city.batumiName')
    },
    get boundaryLabel() {
      return tn('city.batumiBoundary')
    },
    timezone: 'Asia/Tbilisi',
    center: [41.6513, 41.6325],
    zoom: 14.3,
    // Batumi sea port.
    colorPreviewCenter: [41.6555, 41.6414],
    seaPoint: [41.66, 41.6],
    theme: 'sea',
    waterKinds: ['sea', 'river', 'lake', 'pond'],
    zoomShift: 0,
  },
  moscow: {
    id: 'moscow',
    country: 'ru',
    idPrefix: 'M',
    // Moskva river bend right by the Kremlin (sector M2065, ~300m away) —
    // same idea as Batumi's own anchor below: a real sector cluster, not the
    // geometric centroid of the whole city, zoomed in to match Batumi's own
    // close-up default instead of showing the entire MKAD ring at once.
    get name() {
      return tn('city.moscowName')
    },
    get boundaryLabel() {
      return tn('city.moscowBoundary')
    },
    timezone: 'Europe/Moscow',
    center: [55.7522, 37.6228],
    // 13.9, not Batumi's 14.3: at Moscow's latitude the same zoom draws a sector
    // ~1.33× bigger (web mercator), so 14.3 − log2(cos 41.65° / cos 55.75°) gives
    // sectors the size they have on the Batumi screen.
    zoom: 13.9,
    // Kremlin embankment.
    colorPreviewCenter: [55.7485, 37.6180],
    seaPoint: null,
    theme: 'fresh',
    waterKinds: ['river', 'lake', 'pond'],
    zoomShift: -0.41,
  },
  // Saint Petersburg, with Kronstadt: the Neva, rivers and canals, the Gulf of Finland.
  spb: {
    id: 'spb',
    country: 'ru',
    idPrefix: 'P',
    get name() {
      return tn('city.spbName')
    },
    get boundaryLabel() {
      return tn('city.spbBoundary')
    },
    timezone: 'Europe/Moscow',
    // The Neva by the Palace Bridge: a dense run of sectors, not the geometric middle of
    // the city (which is Gulf coast and suburbs).
    center: [59.94, 30.315],
    // 14.3 - 0.58 at 59.9°N: a sector takes the space it has on the Batumi screen.
    zoom: 13.7,
    colorPreviewCenter: [59.9386, 30.3141],
    // Open water of the Gulf of Finland, west of the city.
    seaPoint: [59.97, 29.85],
    theme: 'fresh',
    waterKinds: ['sea', 'river', 'lake', 'pond'],
    zoomShift: -0.58,
  },
  // Sochi with Adler: the whole Black Sea coast from the Psou to the north-west end.
  sochi: {
    id: 'sochi',
    country: 'ru',
    idPrefix: 'S',
    get name() {
      return tn('city.sochiName')
    },
    get boundaryLabel() {
      return tn('city.sochiBoundary')
    },
    timezone: 'Europe/Moscow',
    // The Sochi sea port.
    center: [43.5855, 39.7231],
    zoom: 14.25,
    colorPreviewCenter: [43.5845, 39.7173],
    seaPoint: [43.5, 39.62],
    theme: 'sea',
    waterKinds: ['sea', 'river', 'lake', 'pond'],
    zoomShift: -0.05,
  },
  // Tbilisi: the Kura, the Tbilisi Sea, Lisi and the Turtle lakes.
  tbilisi: {
    id: 'tbilisi',
    country: 'ge',
    idPrefix: 'T',
    get name() {
      return tn('city.tbilisiName')
    },
    get boundaryLabel() {
      return tn('city.tbilisiBoundary')
    },
    timezone: 'Asia/Tbilisi',
    // The Kura below Rustaveli Avenue.
    center: [41.6985, 44.808],
    zoom: 14.3,
    colorPreviewCenter: [41.6941, 44.81],
    seaPoint: null,
    theme: 'fresh',
    waterKinds: ['river', 'lake', 'pond'],
    zoomShift: 0,
  },
}

// The cities a player can pick. A city is added here only once its rows are in the
// database (city_config, territories, cron jobs): a profile in a city the functions do not
// know would break the leaderboard, the clans and the weekly jobs.
const LAUNCHED_CITIES: CityId[] = ['batumi', 'moscow', 'spb', 'sochi', 'tbilisi']
export const CITY_LIST: CityInfo[] = LAUNCHED_CITIES.map((id) => CITIES[id])

// Countries that have a launched city, in the order the picker shows them; each with its
// launched cities.
export const COUNTRY_ORDER: CountryId[] = ['ge', 'ru']
export function launchedCountries(): { id: CountryId; cities: CityInfo[] }[] {
  return COUNTRY_ORDER.map((id) => ({ id, cities: CITY_LIST.filter((c) => c.country === id) })).filter((c) => c.cities.length > 0)
}

const CITY_BY_PREFIX: Record<string, CityId> = Object.fromEntries(Object.values(CITIES).map((c) => [c.idPrefix, c.id]))

export function cityForSectorId(id: string): CityId {
  return CITY_BY_PREFIX[id.charAt(0)] ?? 'batumi'
}

// A value from the database or the URL that may name a city: a known id, else Batumi.
export function asCityId(value: unknown): CityId {
  return typeof value === 'string' && value in CITIES ? (value as CityId) : 'batumi'
}

const STORAGE_KEY = 'range-city'

export function loadStoredCity(): CityId {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && saved in CITIES) return saved as CityId
  } catch {}
  return 'batumi'
}

export function storeCity(city: CityId) {
  try {
    localStorage.setItem(STORAGE_KEY, city)
  } catch {}
}

// A player's sectors across the cities, the given city's first, each group
// keeping its order — profiles and «Мои» list them like this.
export function cityFirst<T extends { id: string }>(list: T[], city: CityId): T[] {
  return [...list].sort((a, b) => Number(cityForSectorId(a.id) !== city) - Number(cityForSectorId(b.id) !== city))
}
