import { createClient } from '@/lib/supabase/client'

// The home-screen web app on iPhone: the first time the keyboard opens, iOS
// shrinks the viewport by roughly the status bar's height and doesn't give it
// back until the app is killed — the app shell (position:fixed; inset:0)
// ends short and a strip shows under the bottom menu. Hiding the shell for
// one synchronous reflow makes WebKit measure the viewport again. Done only
// when the height really is stuck below the tallest one seen, after a field
// loses focus with no other field taking it; the screens' scroll positions
// are put back, since display:none resets them.
export function installStandaloneViewportHeal(): () => void {
  const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia?.('(display-mode: standalone)').matches
  if (!ios || !standalone) return () => {}

  let tallest = window.innerHeight
  let timer = 0
  const onResize = () => {
    tallest = Math.max(tallest, window.innerHeight)
  }
  const heal = () => {
    if (typing()) return
    if (tallest - window.innerHeight <= 4) return
    const shell = document.querySelector<HTMLElement>('.app-shell')
    if (!shell) return
    const scrolled = [shell, ...shell.querySelectorAll<HTMLElement>('.screen')].map((el) => [el, el.scrollTop] as const)
    shell.style.display = 'none'
    void shell.offsetHeight
    shell.style.display = ''
    for (const [el, top] of scrolled) el.scrollTop = top
  }
  // Some iPhones (seen on iOS 27, not in the simulator) give the web app a
  // viewport shorter than the screen from the very launch — no keyboard
  // involved — so everything sized to it (the shell, full-screen overlays)
  // ends short of the bottom. The shortfall goes to --vp-gap and those boxes
  // reach down by it (globals.css). Not while a field has focus: the
  // keyboard shrinks the viewport on purpose.
  const fill = () => {
    if (typing()) return
    const portrait = window.matchMedia('(orientation: portrait)').matches
    const screenH = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height)
    const gap = screenH - window.innerHeight
    document.documentElement.style.setProperty('--vp-gap', gap > 4 && gap < 120 ? `${gap}px` : '0px')
  }
  const onFocusOut = () => {
    window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      heal()
      fill()
    }, 140)
  }
  fill()
  window.addEventListener('resize', fill)
  window.addEventListener('orientationchange', fill)
  window.addEventListener('resize', onResize)
  document.addEventListener('focusout', onFocusOut)
  const debugTimer = window.setTimeout(() => void recordViewport(), 2000)
  return () => {
    window.clearTimeout(timer)
    window.clearTimeout(debugTimer)
    window.removeEventListener('resize', fill)
    window.removeEventListener('orientationchange', fill)
    window.removeEventListener('resize', onResize)
    document.removeEventListener('focusout', onFocusOut)
  }
}

function typing() {
  const a = document.activeElement
  return a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement || !!(a as HTMLElement | null)?.isContentEditable
}

// TEMPORARY (08.10): the real sizes from a phone where the strip shows, kept
// on the player's own account (user_ui_state «debug_viewport») to check the
// fix against. Remove once confirmed.
async function recordViewport() {
  try {
    const supabase = createClient()
    const { data } = await supabase.auth.getSession()
    if (!data.session) return
    const probe = document.createElement('div')
    probe.style.cssText = 'position:fixed;top:0;left:0;visibility:hidden;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)'
    document.body.appendChild(probe)
    const cs = getComputedStyle(probe)
    const safeTop = cs.paddingTop
    const safeBottom = cs.paddingBottom
    probe.remove()
    const shell = document.querySelector('.app-shell')?.getBoundingClientRect()
    await supabase.from('user_ui_state').upsert(
      {
        key: 'debug_viewport',
        value: {
          at: new Date().toISOString(),
          ua: navigator.userAgent,
          screen: [screen.width, screen.height],
          inner: [window.innerWidth, window.innerHeight],
          visual: window.visualViewport ? [window.visualViewport.width, window.visualViewport.height, window.visualViewport.offsetTop] : null,
          doc: document.documentElement.clientHeight,
          safeTop,
          safeBottom,
          gap: document.documentElement.style.getPropertyValue('--vp-gap'),
          shell: shell ? [shell.top, shell.bottom, shell.height] : null,
          dpr: window.devicePixelRatio,
        },
      },
      { onConflict: 'user_id,key' }
    )
  } catch {}
}
