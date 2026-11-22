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
export type CityId = 'batumi' | 'moscow' | 'spb' | 'sochi' | 'tbilisi' | 'kazan' | 'nnov' | 'varna' | 'anapa' | 'kyiv' | 'odesa' | 'yerevan'
// The country a city is in: the city pickers ask for the country first (flag, then its cities).
export type CountryId = 'ge' | 'ru' | 'bg' | 'ua' | 'am'

export type CityInfo = {
  id: CityId
  country: CountryId
  idPrefix: string
  name: string
  // Shown under the page title on the Сектора tab.
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
  // Kazan and 30 km around it: the Volga (Kuibyshev reservoir), the Kazanka, the Sviyaga, lakes.
  kazan: {
    id: 'kazan',
    country: 'ru',
    idPrefix: 'K',
    get name() {
      return tn('city.kazanName')
    },
    get boundaryLabel() {
      return tn('city.kazanBoundary')
    },
    timezone: 'Europe/Moscow',
    // The Kazanka under the Kremlin.
    center: [55.8, 49.105],
    // 14.3 - 0.41 at 55.8°N.
    zoom: 13.9,
    colorPreviewCenter: [55.8, 49.105],
    seaPoint: null,
    theme: 'fresh',
    waterKinds: ['river', 'lake', 'pond'],
    zoomShift: -0.41,
  },
  // Nizhny Novgorod and 30 km around it: the Volga, the Oka, Bor, Kstovo, lakes.
  nnov: {
    id: 'nnov',
    country: 'ru',
    idPrefix: 'N',
    get name() {
      return tn('city.nnovName')
    },
    get boundaryLabel() {
      return tn('city.nnovBoundary')
    },
    timezone: 'Europe/Moscow',
    // The Strelka, where the Oka meets the Volga.
    center: [56.333, 43.975],
    // 14.3 - 0.43 at 56.3°N.
    zoom: 13.87,
    colorPreviewCenter: [56.333, 43.975],
    seaPoint: null,
    theme: 'fresh',
    waterKinds: ['river', 'lake', 'pond'],
    zoomShift: -0.43,
  },
  // «Варна/Бургас»: the whole Bulgarian Black Sea coast, a 5 km strip, with the Varna and
  // Beloslav lakes and the Burgas lakes.
  varna: {
    id: 'varna',
    country: 'bg',
    idPrefix: 'V',
    get name() {
      return tn('city.varnaName')
    },
    get boundaryLabel() {
      return tn('city.varnaBoundary')
    },
    timezone: 'Europe/Sofia',
    // Varna's beach by the Sea Garden.
    center: [43.205, 27.925],
    zoom: 14.26,
    colorPreviewCenter: [43.205, 27.925],
    seaPoint: [43.18, 28.0],
    theme: 'sea',
    waterKinds: ['sea', 'river', 'lake', 'pond'],
    zoomShift: -0.04,
  },
  // Anapa: the okrug's coast as a 5 km strip, from Blagoveshchenskaya to Sukko, with the limans.
  anapa: {
    id: 'anapa',
    country: 'ru',
    idPrefix: 'A',
    get name() {
      return tn('city.anapaName')
    },
    get boundaryLabel() {
      return tn('city.anapaBoundary')
    },
    timezone: 'Europe/Moscow',
    // Anapa's central beach.
    center: [44.895, 37.31],
    zoom: 14.22,
    colorPreviewCenter: [44.895, 37.31],
    seaPoint: [44.88, 37.2],
    theme: 'sea',
    waterKinds: ['sea', 'river', 'lake', 'pond'],
    zoomShift: -0.08,
  },
  // Kyiv and 30 km around it: the Dnieper, the Desna, the Kyiv reservoir, lakes.
  kyiv: {
    id: 'kyiv',
    country: 'ua',
    idPrefix: 'Y',
    get name() {
      return tn('city.kyivName')
    },
    get boundaryLabel() {
      return tn('city.kyivBoundary')
    },
    // «Europe/Kiev», not «Europe/Kyiv»: the new name is missing from older phones' time zone data.
    timezone: 'Europe/Kiev',
    // The Dnieper by Trukhaniv Island.
    center: [50.46, 30.535],
    // 14.3 - 0.23 at 50.5°N.
    zoom: 14.07,
    colorPreviewCenter: [50.46, 30.535],
    seaPoint: null,
    theme: 'fresh',
    waterKinds: ['river', 'lake', 'pond'],
    zoomShift: -0.23,
  },
  // Odesa and 30 km around it: the sea, the Khadzhibey and Kuyalnik limans.
  odesa: {
    id: 'odesa',
    country: 'ua',
    idPrefix: 'O',
    get name() {
      return tn('city.odesaName')
    },
    get boundaryLabel() {
      return tn('city.odesaBoundary')
    },
    timezone: 'Europe/Kiev',
    // Lanzheron beach.
    center: [46.48, 30.762],
    zoom: 14.18,
    colorPreviewCenter: [46.48, 30.762],
    seaPoint: [46.45, 30.85],
    theme: 'sea',
    waterKinds: ['sea', 'river', 'lake', 'pond'],
    zoomShift: -0.12,
  },
  // «Ереван/Севан»: Yerevan and 30 km around it (inside Armenia) and the shore of Lake Sevan.
  yerevan: {
    id: 'yerevan',
    country: 'am',
    idPrefix: 'E',
    get name() {
      return tn('city.yerevanName')
    },
    get boundaryLabel() {
      return tn('city.yerevanBoundary')
    },
    timezone: 'Asia/Yerevan',
    // The Hrazdan gorge under the Victory Bridge.
    center: [40.178, 44.496],
    zoom: 14.27,
    colorPreviewCenter: [40.178, 44.496],
    seaPoint: null,
    theme: 'fresh',
    waterKinds: ['river', 'lake', 'pond'],
    zoomShift: 0.03,
  },
}

// The cities a player can pick. A city is added here only once its rows are in the
// database (city_config, territories, cron jobs): a profile in a city the functions do not
// know would break the leaderboard, the clans and the weekly jobs.
// Kazan, Nizhny Novgorod, «Варна/Бургас», Anapa, Kyiv, Odesa and «Ереван/Севан» since 22.11.2026
// (web/supabase-drafts/cities-22-11, applied).
const LAUNCHED_CITIES: CityId[] = ['batumi', 'moscow', 'spb', 'sochi', 'tbilisi', 'kazan', 'nnov', 'varna', 'anapa', 'kyiv', 'odesa', 'yerevan']
export const CITY_LIST: CityInfo[] = LAUNCHED_CITIES.map((id) => CITIES[id])

// Countries that have a launched city, in the order the picker shows them; each with its
// launched cities.
export const COUNTRY_ORDER: CountryId[] = ['ge', 'ru', 'bg', 'ua', 'am']
export function launchedCountries(): { id: CountryId; cities: CityInfo[] }[] {
  return COUNTRY_ORDER.map((id) => ({ id, cities: CITY_LIST.filter((c) => c.country === id) })).filter((c) => c.cities.length > 0)
}

const CITY_BY_PREFIX: Record<string, CityId> = Object.fromEntries(Object.values(CITIES).map((c) => [c.idPrefix, c.id]))

// A city's sector ids as a range of the primary key, [from, to): «id >= 'K' and id < 'L'» walks the key's
// index over that city's rows only, where «id like 'K%'» reads every sector of every city (the database
// sorts text by ICU rules, which a LIKE prefix cannot use; measured 3–7 times slower, and it grows with
// each city added). Sector ids are one capital letter and digits, so the next letter closes the range.
export function sectorIdRange(prefix: string): { from: string; to: string } {
  return { from: prefix, to: String.fromCharCode(prefix.charCodeAt(0) + 1) }
}

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
