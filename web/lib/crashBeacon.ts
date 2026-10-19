'use client'

// Finds out when the phone kills the app's page. When iOS runs short of memory it
// throws the WebView away without a word — no error, no log — and the player
// just sees the app start over. A note left on the phone tells that apart from a
// normal close: while the app is in front it keeps «where we are» (the screen,
// how big the page is); going to the background, or any normal reload, marks the
// note «left cleanly». If the next launch finds a note that was NOT marked, the
// last launch ended without warning — and that is reported to the super admins
// with the screen it happened on and what the page weighed.
// The build this page runs (short): the report names the one that died, and the one the next launch runs.
const BUILD = (process.env.APP_VERSION ?? 'dev').slice(0, 7)
const KEY = 'range:beacon'
const REPORTED_KEY = 'range:beaconReported'
// Close together while the app starts (that is when it is most at risk), then easy.
const HEARTBEAT_EARLY_MS = 3_000
const HEARTBEAT_MS = 15_000
const EARLY_FOR_MS = 60_000
// A last beat older than this is a page that was set aside, not one killed in front of the player.
const AWAY_AFTER_MS = 60_000
const REPORT_EVERY_MS = 60 * 60_000

type Beacon = { screen: string; at: number; started: number; clean: boolean; nodes: number; canvases: number; screens: number; images: number; heapMB: number | null; nav: string; trail: string; ver?: string }

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

// «Loading» until the app's screens are on the page (the launch screen is all there is).
function activeScreen(): string {
  const id = document.querySelector('.screens .screen.active')?.id ?? document.querySelector('.screen.active')?.id
  if (id) return id
  return document.querySelector('.screen') ? 'none' : 'загрузка'
}

// How this page was opened: a fresh visit, a reload, or back/forward.
function navigationType(): string {
  return (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type ?? '?'
}

function heapMB(): number | null {
  const m = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory
  return m ? Math.round(m.usedJSHeapSize / 1048576) : null
}

function platform(): string {
  const tg = window.Telegram?.WebApp as { platform?: string; version?: string } | undefined
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  // Outside Telegram the script still answers, with platform «unknown».
  const inTelegram = !!tg?.platform && tg.platform !== 'unknown'
  return [inTelegram ? `Telegram ${tg?.platform} ${tg?.version ?? ''}`.trim() : standalone ? 'главный экран' : 'браузер (не Telegram)', `${innerWidth}×${innerHeight}`, `dpr ${devicePixelRatio}`].join(', ')
}

// `report` is how the super admins hear of it (lib/supabase/queries.ts reportClientError).
export function installCrashBeacon(report: (message: string) => void): () => void {
  const prev = read()
  const now = Date.now()
  // The page beats every 15 s while it is in front. A last beat minutes old means the page
  // was not running — the player had left (iOS freezes the page without a word, then
  // discards it) — so the relaunch is not a crash in front of them and is not reported.
  if (prev && !prev.clean && now - prev.at < AWAY_AFTER_MS) {
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
          `узлов ${prev.nodes}, экранов ${prev.screens}, canvas ${prev.canvases}${prev.images !== undefined ? `, картинок ${prev.images}` : ''}${prev.heapMB !== null ? `, куча ${prev.heapMB} МБ` : ''}; открыта как ${prev.nav ?? '?'}; версия ${prev.ver ?? '?'}${prev.ver && prev.ver !== BUILD ? `, теперь ${BUILD}` : ''}; ${platform()}${prev.trail ? `; путь: ${prev.trail}` : ''}`
      )
    }
  }

  const started = now
  const navType = navigationType()
  // The last few screens and when (seconds since launch): how the player got here.
  const trail: string[] = []
  const beat = (clean: boolean) => {
    const screen = activeScreen()
    const name = screen.replace('screen-', '')
    if (trail[trail.length - 1]?.split('@')[0] !== name) {
      trail.push(`${name}@${Math.round((Date.now() - started) / 1000)}`)
      if (trail.length > 5) trail.shift()
    }
    write({
      screen,
      at: Date.now(),
      started,
      clean,
      nodes: document.getElementsByTagName('*').length,
      canvases: document.getElementsByTagName('canvas').length,
      screens: document.querySelectorAll('.screen').length,
      images: document.getElementsByTagName('img').length,
      heapMB: heapMB(),
      nav: navType,
      trail: trail.join(' → '),
      ver: BUILD,
    })
  }
  beat(false)
  let timer = 0
  // Set aside by Telegram (collapsed): the page may still say «visible», but no signal.
  let away = false
  const tick = () => {
    if (document.visibilityState === 'visible' && !away) beat(false)
    timer = window.setTimeout(tick, Date.now() - started < EARLY_FOR_MS ? HEARTBEAT_EARLY_MS : HEARTBEAT_MS)
  }
  timer = window.setTimeout(tick, HEARTBEAT_EARLY_MS)
  // A screen change is worth a note at once: it is what the report names.
  const root = document.querySelector('.screens') ?? document.body
  let pending = 0
  const observer = new MutationObserver(() => {
    window.clearTimeout(pending)
    pending = window.setTimeout(() => {
      if (!away) beat(false)
    }, 400)
  })
  observer.observe(root, { attributes: true, attributeFilter: ['class'], subtree: true })
  const onVisibility = () => beat(document.visibilityState === 'hidden')
  const onHide = () => beat(true)
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', onHide)
  document.addEventListener('freeze', onHide)
  // Telegram's «collapse» (the chevron beside «Закрыть») and leaving Telegram do not
  // always reach the page as a visibility change; its own events do. A page that was
  // set aside this way and thrown away later is not a crash in front of the player.
  const tg = window.Telegram?.WebApp as { onEvent?: (e: string, f: () => void) => void; offEvent?: (e: string, f: () => void) => void } | undefined
  const onDeactivated = () => {
    away = true
    beat(true)
  }
  const onActivated = () => {
    away = false
    beat(false)
  }
  tg?.onEvent?.('deactivated', onDeactivated)
  tg?.onEvent?.('activated', onActivated)
  return () => {
    tg?.offEvent?.('deactivated', onDeactivated)
    tg?.offEvent?.('activated', onActivated)
    document.removeEventListener('freeze', onHide)
    window.clearTimeout(timer)
    window.clearTimeout(pending)
    observer.disconnect()
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pagehide', onHide)
  }
}
