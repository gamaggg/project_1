'use client'

// Finds out when the phone kills the app's page. When iOS runs short of memory it
// throws the WebView away without a word — no error, no log — and the player
// just sees the app start over. A note left on the phone tells that apart from a
// normal close: while the app is in front it keeps «where we are» (the screen,
// how big the page is); going to the background, or any normal reload, marks the
// note «left cleanly». If the next launch finds a note that was NOT marked, the
// last launch ended without warning — and that is reported to the super admins
// with the screen it happened on and what the page weighed.
const KEY = 'range:beacon'
const REPORTED_KEY = 'range:beaconReported'
const HEARTBEAT_MS = 15_000
const MAX_AGE_MS = 15 * 60_000
const REPORT_EVERY_MS = 60 * 60_000

type Beacon = { screen: string; at: number; started: number; clean: boolean; nodes: number; canvases: number; screens: number; heapMB: number | null }

function read(): Beacon | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Beacon) : null
  } catch {
    return null
  }
}
function write(b: Beacon) {
  try {
    localStorage.setItem(KEY, JSON.stringify(b))
  } catch {
    // storage off: no beacon, nothing else changes
  }
}

function activeScreen(): string {
  return document.querySelector('.screens .screen.active')?.id ?? document.querySelector('.screen.active')?.id ?? 'none'
}

function heapMB(): number | null {
  const m = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory
  return m ? Math.round(m.usedJSHeapSize / 1048576) : null
}

function platform(): string {
  const tg = window.Telegram?.WebApp as { platform?: string; version?: string } | undefined
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return [tg?.platform ? `Telegram ${tg.platform} ${tg.version ?? ''}`.trim() : standalone ? 'главный экран' : 'браузер', `${innerWidth}×${innerHeight}`, `dpr ${devicePixelRatio}`].join(', ')
}

// `report` is how the super admins hear of it (lib/supabase/queries.ts reportClientError).
export function installCrashBeacon(report: (message: string) => void): () => void {
  const prev = read()
  const now = Date.now()
  if (prev && !prev.clean && now - prev.at < MAX_AGE_MS) {
    let last = 0
    try {
      last = Number(localStorage.getItem(REPORTED_KEY) ?? 0)
    } catch {}
    if (now - last > REPORT_EVERY_MS) {
      try {
        localStorage.setItem(REPORTED_KEY, String(now))
      } catch {}
      const lived = Math.round((prev.at - prev.started) / 1000)
      report(
        `страница сброшена без ухода в фон: экран ${prev.screen}; жила ${lived} с, последний сигнал ${Math.round((now - prev.at) / 1000)} с назад; ` +
          `узлов ${prev.nodes}, экранов ${prev.screens}, canvas ${prev.canvases}${prev.heapMB !== null ? `, куча ${prev.heapMB} МБ` : ''}; ${platform()}`
      )
    }
  }

  const started = now
  const beat = (clean: boolean) => {
    write({
      screen: activeScreen(),
      at: Date.now(),
      started,
      clean,
      nodes: document.getElementsByTagName('*').length,
      canvases: document.getElementsByTagName('canvas').length,
      screens: document.querySelectorAll('.screen').length,
      heapMB: heapMB(),
    })
  }
  beat(false)
  const timer = window.setInterval(() => {
    if (document.visibilityState === 'visible') beat(false)
  }, HEARTBEAT_MS)
  // A screen change is worth a note at once: it is what the report names.
  const root = document.querySelector('.screens') ?? document.body
  let pending = 0
  const observer = new MutationObserver(() => {
    window.clearTimeout(pending)
    pending = window.setTimeout(() => beat(false), 400)
  })
  observer.observe(root, { attributes: true, attributeFilter: ['class'], subtree: true })
  const onVisibility = () => beat(document.visibilityState === 'hidden')
  const onHide = () => beat(true)
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', onHide)
  return () => {
    window.clearInterval(timer)
    window.clearTimeout(pending)
    observer.disconnect()
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pagehide', onHide)
  }
}
