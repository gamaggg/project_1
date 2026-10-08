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
  // The home-screen app on iOS runs without the manifest (app/layout.tsx), so
  // `display-mode: standalone` doesn't match there — CSS keys off this.
  document.documentElement.classList.add('ios-standalone')

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
  // Some iPhones (seen on a 390×844 one with iOS 27; not in the simulator)
  // give the web app a viewport the status bar's height short of the screen
  // from the very launch: innerHeight 797 on an 844 screen. iOS paints those
  // last 47pt itself in the page background and won't show content there,
  // so instead of reaching into it the bottom menu turns solid white like
  // that strip and drops its home-indicator padding (the indicator sits in
  // the strip) — the menu and the strip read as one (.vp-short, globals.css).
  // Not while a field has focus: the keyboard shrinks the viewport on purpose.
  const fill = () => {
    if (typing()) return
    const portrait = window.matchMedia('(orientation: portrait)').matches
    const screenH = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height)
    const gap = screenH - window.innerHeight
    document.documentElement.classList.toggle('vp-short', gap >= 20 && gap < 120)
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
  return () => {
    window.clearTimeout(timer)
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
