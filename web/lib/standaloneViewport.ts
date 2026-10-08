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
  // Also set before the first paint by app/layout.tsx; CSS keys off it.
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
  const onFocusOut = () => {
    window.clearTimeout(timer)
    timer = window.setTimeout(heal, 140)
  }
  window.addEventListener('resize', onResize)
  document.addEventListener('focusout', onFocusOut)
  return () => {
    window.clearTimeout(timer)
    window.removeEventListener('resize', onResize)
    document.removeEventListener('focusout', onFocusOut)
  }
}

function typing() {
  const a = document.activeElement
  return a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement || !!(a as HTMLElement | null)?.isContentEditable
}
