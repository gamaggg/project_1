import { useEffect, useRef } from 'react'

// "Magnetic" scroll for the profile hero/body overlap (see .profile-hero's
// position:sticky + .profile-body's negative-margin cover in globals.css) —
// a small scroll shouldn't leave the sheet resting half-covering the avatar;
// once the user stops scrolling inside that transition zone, this snaps to
// fully open or fully covered, whichever edge is closer, in either scroll
// direction. Scrolling further down into ordinary body content (past the
// covered point) is left alone — only the transition zone itself is magnetic.
export function useMagneticProfileHero() {
  const heroRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const hero = heroRef.current
    if (!hero) return
    const scroller = hero.closest('.screen') as HTMLElement | null
    const body = hero.nextElementSibling as HTMLElement | null
    if (!scroller || !body) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const SNAP_MS = 220
    let debounce: ReturnType<typeof setTimeout> | null = null
    let settleGuard: ReturnType<typeof setTimeout> | null = null
    let snapping = false

    // Native `scrollTo({behavior:'smooth'})` has no duration control and
    // defaults to a noticeably slow glide for a short snap — a fixed, quick
    // rAF tween reads as an actual magnet instead of a sluggish drift.
    function animateTo(target: number) {
      const start = scroller!.scrollTop
      const change = target - start
      if (!change) return
      const t0 = performance.now()
      function step(now: number) {
        const p = Math.min(1, (now - t0) / SNAP_MS)
        const eased = 1 - Math.pow(1 - p, 3)
        scroller!.scrollTop = start + change * eased
        if (p < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }

    function evaluate() {
      if (snapping) return
      // Read live rather than caching — hero's height depends on real
      // profile content (bio present or not), so it can differ per profile.
      const overlap = -parseFloat(getComputedStyle(body!).marginTop || '0')
      const threshold = hero!.offsetHeight - overlap
      const top = scroller!.scrollTop
      if (top <= 0 || top >= threshold) return
      const target = top < threshold / 2 ? 0 : threshold
      snapping = true
      if (reduceMotion) {
        scroller!.scrollTop = target
      } else {
        animateTo(target)
      }
      settleGuard = setTimeout(() => {
        snapping = false
      }, SNAP_MS + 60)
    }

    function onScroll() {
      if (debounce) clearTimeout(debounce)
      debounce = setTimeout(evaluate, 60)
    }

    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      scroller.removeEventListener('scroll', onScroll)
      if (debounce) clearTimeout(debounce)
      if (settleGuard) clearTimeout(settleGuard)
    }
  }, [])

  return heroRef
}
