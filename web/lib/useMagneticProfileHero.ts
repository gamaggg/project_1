import { useEffect, useRef } from 'react'

// The profile (own and another's) scrolls as a white sheet over a dark hero: the hero is position:sticky at the top
// of the screen, the sheet (.profile-body) slides up over it (globals.css). Rebuilt 09.11.2026 for the iPhone:
//
// - The page always scrolls freely under the finger and with its momentum — nothing here touches the scroll while
//   a finger is down or the page is still moving. (Native scroll snapping, tried first, threw a fast flick back to
//   the top on the iPhone, and a clip-path redrawn every frame made the scroll jerk.)
// - The «magnet»: with the sheet half-way over the hero and no finger on the screen, the browser's own smooth
//   scroll takes it to an edge — the one it was last moving towards (pushed down: the hero closes; pulled up: it
//   opens), or the nearer one. It starts at once when the finger is let go gently, or as soon as a flick's momentum
//   fades out inside that zone (not after the iPhone's long slow tail of it), or when the page has rested IDLE_MS.
// - Telegram fullscreen and the iPhone home-screen app: the status bar and Telegram's «Закрыть» / «⋯» float over
//   the top of the screen; .profile-top-band (right before the hero) is that tall. The covered sheet stops right
//   under it, so the hero shows above the sheet. Scrolled further, the band turns on (one class switch, a fade in
//   the hero's colour), so the content slides under it and not under Telegram's buttons.
const IDLE_MS = 110
// px/ms: a finger let go slower than this leaves no real momentum, so the glide starts at once; a momentum slower
// than FADE_SPEED inside the half-way zone is about to stop, so the glide starts then.
const RELEASE_SPEED = 0.5
const FADE_SPEED = 0.35

export function useMagneticProfileHero() {
  const heroRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const hero = heroRef.current
    if (!hero) return
    const scroller = hero.closest('.screen') as HTMLElement | null
    const body = hero.nextElementSibling as HTMLElement | null
    const prev = hero.previousElementSibling as HTMLElement | null
    const band = prev?.classList.contains('profile-top-band') ? prev : null
    if (!scroller || !body) return

    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // Where the sheet rests over the hero: its top edge under the band (or at the top of the screen). Measured on
    // mount and whenever the hero or the band changes size, never during the scroll itself.
    let covered = 0
    function measure() {
      // By layout offsets, not the on-screen box: the sheet's rise-in animation on opening moves it for a moment.
      let bodyTop = 0
      let el: HTMLElement | null = body
      while (el && el !== scroller && scroller!.contains(el)) {
        bodyTop += el.offsetTop
        el = el.offsetParent as HTMLElement | null
      }
      if (el !== scroller) bodyTop = body!.getBoundingClientRect().top - scroller!.getBoundingClientRect().top + scroller!.scrollTop
      covered = Math.max(0, Math.round(bodyTop - (band?.offsetHeight ?? 0)))
      band?.style.setProperty('--hero-h', `${hero!.offsetHeight}px`)
    }

    let lastTop = scroller.scrollTop
    let dir = 0
    let touching = false
    let gliding = false
    let idle: ReturnType<typeof setTimeout> | null = null
    let bandOn = false

    // The page's speed in px/ms (smoothed, signed), from the scroll events themselves.
    let lastT = performance.now()
    let glideTarget = 0
    let speed = 0

    // The sheet stands half-way over the hero: glide it to an edge with the browser's own smooth scroll — the edge
    // it was last moving towards (pushed down: the hero closes; pulled up: it opens), or the nearer one.
    function snap() {
      const top = scroller!.scrollTop
      if (top <= 1 || top >= covered - 1) return
      const target = dir > 0 ? covered : dir < 0 ? 0 : top < covered / 2 ? 0 : covered
      glideTarget = target
      gliding = true
      scroller!.scrollTo({ top: target, behavior: smooth ? 'smooth' : 'auto' })
    }

    function settle() {
      idle = null
      if (touching) return
      if (gliding) {
        gliding = false
        // Arrived. If something else stopped it half-way (a finger clears `gliding` on touchstart, so not that),
        // finish the job.
        if (Math.abs(scroller!.scrollTop - glideTarget) > 2) snap()
        return
      }
      snap()
    }

    function onScroll() {
      const top = scroller!.scrollTop
      const now = performance.now()
      speed = speed * 0.5 + ((top - lastTop) / Math.max(1, now - lastT)) * 0.5
      lastT = now
      if (!gliding && Math.abs(top - lastTop) >= 2) dir = top > lastTop ? 1 : -1
      lastTop = top
      const on = band !== null && top > covered + 4
      if (on !== bandOn) {
        bandOn = on
        band!.classList.toggle('on', on)
      }
      if (touching) return
      if (idle) clearTimeout(idle)
      // The momentum is fading out inside the half-way zone: glide now instead of waiting through the iPhone's long
      // slow tail of it (09.11.2026).
      if (!gliding && top > 1 && top < covered - 1 && Math.abs(speed) < FADE_SPEED) {
        idle = null
        snap()
        return
      }
      idle = setTimeout(settle, IDLE_MS)
    }
    function onTouchStart() {
      touching = true
      gliding = false
      dir = 0
      speed = 0
      if (idle) clearTimeout(idle)
      idle = null
    }
    function onTouchEnd() {
      touching = false
      if (idle) clearTimeout(idle)
      idle = null
      // A finger that held still before letting go leaves no momentum.
      if (performance.now() - lastT > 80) speed = 0
      // Let go gently: glide at once. Flicked: the momentum runs, and onScroll glides as soon as it fades.
      if (Math.abs(speed) < RELEASE_SPEED) snap()
      else idle = setTimeout(settle, IDLE_MS)
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(hero)
    if (band) ro.observe(band)
    scroller.addEventListener('scroll', onScroll, { passive: true })
    scroller.addEventListener('touchstart', onTouchStart, { passive: true })
    scroller.addEventListener('touchend', onTouchEnd, { passive: true })
    scroller.addEventListener('touchcancel', onTouchEnd, { passive: true })
    return () => {
      ro.disconnect()
      scroller.removeEventListener('scroll', onScroll)
      scroller.removeEventListener('touchstart', onTouchStart)
      scroller.removeEventListener('touchend', onTouchEnd)
      scroller.removeEventListener('touchcancel', onTouchEnd)
      if (idle) clearTimeout(idle)
      band?.classList.remove('on')
    }
  }, [])

  return heroRef
}
