// A lighter map for old and weak phones. The Mapbox canvas is the biggest single memory
// user on the map screen (it draws at the device's pixel ratio, and iOS discards the page
// without a word when graphics memory runs out — see lib/crashBeacon.ts), so on a phone
// that is short of it the map is drawn at a lower pixel ratio, with a smaller tile cache and
// smaller off-screen buffers. Other phones keep the full quality.
//
// A phone counts as weak when it says so (little RAM or few cores on Android; a small or
// old screen size on iPhone, where the model is not exposed) or when this device's last
// launch was discarded by the system (crashBeacon calls markDeviceStrained): then the next
// 30 days start in light mode whatever the phone is.

const STRAINED_KEY = 'range:lightMap'
const STRAINED_FOR_MS = 30 * 24 * 60 * 60 * 1000
// The sharpest pixel ratio a light map is drawn at.
const LIGHT_PIXEL_RATIO = 2

export function markDeviceStrained() {
  try {
    window.localStorage.setItem(STRAINED_KEY, String(Date.now()))
  } catch {
    // storage off: the rule below still applies to weak phones
  }
}

function wasStrained(): boolean {
  try {
    const at = Number(window.localStorage.getItem(STRAINED_KEY) ?? 0)
    return at > 0 && Date.now() - at < STRAINED_FOR_MS
  } catch {
    return false
  }
}

function isWeakDevice(): boolean {
  const nav = navigator as Navigator & { deviceMemory?: number }
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent)
  if (ios) {
    // The model is not exposed; the screen size stands in for it: iPhone 8 and older
    // (4.7″, 5.5″ and 4″) and the 5.8″ X-class (375 pt wide) are the ones with 2–4 GB.
    const short = Math.min(screen.width, screen.height)
    const long = Math.max(screen.width, screen.height)
    return short <= 375 || long <= 736
  }
  if (nav.deviceMemory !== undefined && nav.deviceMemory <= 4) return true
  return navigator.hardwareConcurrency !== undefined && navigator.hardwareConcurrency <= 4
}

export type MapLoad = {
  light: boolean
  // Mapbox canvas: how far beyond the screen it is drawn (the bridge's default is 0.1).
  glPadding: number
  // Sector canvas: the same for the polygons (0.3 on a full map).
  polygonPadding: number
  // Mapbox tile cache, in tiles; undefined leaves the library's own default.
  tileCache: number | undefined
}

let decided: MapLoad | null = null

// Decide once per page and, in light mode, cap the pixel ratio the page reports. Mapbox
// reads window.devicePixelRatio itself, with no option to say otherwise, so the cap is put
// there; the real value stays in __realDevicePixelRatio (the crash report names it).
export function mapLoad(): MapLoad {
  if (decided) return decided
  const light = wasStrained() || isWeakDevice()
  if (light && window.devicePixelRatio > LIGHT_PIXEL_RATIO) {
    try {
      ;(window as Window & { __realDevicePixelRatio?: number }).__realDevicePixelRatio = window.devicePixelRatio
      Object.defineProperty(window, 'devicePixelRatio', { configurable: true, get: () => LIGHT_PIXEL_RATIO })
    } catch {
      // not allowed here: the map just stays at the device's ratio
    }
  }
  decided = light ? { light, glPadding: 0.05, polygonPadding: 0.15, tileCache: 8 } : { light, glPadding: 0.1, polygonPadding: 0.3, tileCache: undefined }
  return decided
}

// For the crash report: «лёгкая карта» when the map was drawn lighter, else nothing.
export function lightMapLabel(): string {
  return decided?.light ? 'лёгкая карта' : ''
}

export function realPixelRatio(): number {
  return (window as Window & { __realDevicePixelRatio?: number }).__realDevicePixelRatio ?? window.devicePixelRatio
}
