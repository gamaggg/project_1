import { useEffect, useRef } from 'react'

// The profile (own and another's) scrolls as a white sheet over a dark hero: the hero is position:sticky at the top
// of the screen, the sheet (.profile-body) slides up over it (globals.css). Rebuilt 09.11.2026, without hand-made
// tweens, timers or finger tracking:
//
// - The «magnet» is the browser's own scroll snapping (nav-glass.css: scroll-snap-type on #screen-profile and
//   #screen-user-profile, snap points on .profile-top-band and .profile-body). It works with the finger and the
//   momentum the way the phone itself does: a flick down closes the hero, a flick up opens it, a stop half-way goes
//   to the nearer edge; once the sheet covers the hero, its long content scrolls freely (a snap area taller than the
//   screen does not hold the page).
// - In Telegram fullscreen and the iPhone home-screen app the status bar and Telegram's «Закрыть» / «⋯» float over
//   the top of the screen (.profile-top-band is that tall). The covered sheet stops right under them
//   (scroll-margin-top), and when it is scrolled further its content must not run up under those buttons either:
//   this hook cuts the sheet at the band's bottom edge, keeping its rounded top, so the content slides under that
//   edge and the hero stays in view above it. Nothing happens where there is no band (an ordinary browser).
export function useMagneticProfileHero() {
  const heroRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const hero = heroRef.current
    if (!hero) return
    const scroller = hero.closest('.screen') as HTMLElement | null
    const body = hero.nextElementSibling as HTMLElement | null
    const prev = hero.previousElementSibling as HTMLElement | null
    const band = prev?.classList.contains('profile-top-band') ? prev : null
    if (!scroller || !body || !band) return

    let clipped = ''
    let frame = 0
    function clip() {
      frame = 0
      const bandH = band!.offsetHeight
      const top = body!.getBoundingClientRect().top - scroller!.getBoundingClientRect().top
      const cut = bandH > 0 ? Math.max(0, Math.round(bandH - top)) : 0
      const next = cut > 0 ? `inset(${cut}px 0 0 0 round 24px 24px 0 0)` : ''
      if (next !== clipped) {
        clipped = next
        body!.style.clipPath = next
      }
    }
    // One measurement per frame at most, however often the scroll events come.
    function onScroll() {
      if (!frame) frame = requestAnimationFrame(clip)
    }

    clip()
    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      scroller.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
      body.style.clipPath = ''
    }
  }, [])

  return heroRef
}
