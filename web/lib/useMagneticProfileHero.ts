import { useEffect, useRef } from 'react'

// "Magnetic" scroll for the profile hero/body overlap (see .profile-hero's
// position:sticky + .profile-body's negative-margin cover in globals.css) —
// a small scroll shouldn't leave the sheet resting half-covering the avatar;
// once the user stops scrolling inside that transition zone, this snaps to
// fully open or fully covered, whichever edge is closer, in either scroll
// direction. Scrolling further down into ordinary body content (past the
// covered point) is left alone — only the transition zone itself is magnetic.
//
// The snap only ever happens with no finger on the screen (07.11.2026): before,
// it fired 60 ms after the last scroll event, so a slow drag that paused for a
// moment was snapped out from under the finger, and a new touch during the snap
// fought the running tween — on a phone the page jumped. Now a touch (or a wheel
// turn) stops a snap at once, and the snap waits until the finger is up and the
// momentum has died out.
export function useMagneticProfileHero() {
  const heroRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const hero = heroRef.current
    if (!hero) return
    const scroller = hero.closest('.screen') as HTMLElement | null
    const body = hero.nextElementSibling as HTMLElement | null
    if (!scroller || !body) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const SNAP_MS = 180
    // How long the page must be still (no scroll events) before it counts as settled: iOS momentum sends its
    // scroll events further apart near its end, 60 ms was too short.
    const SETTLE_MS = 90
    // Which way the page was last moving (1 down, -1 up, 0 unknown): the snap follows it (08.11.2026), so a
    // short push down closes the hero and a short pull up opens it, instead of waiting for the half-way mark.
    let lastTop = scroller.scrollTop
    let dir = 0
    let debounce: ReturnType<typeof setTimeout> | null = null
    let touching = false
    // The running snap, if any: the frame to cancel when the user takes over.
    let frame = 0
    let snapping = false

    function stopSnap() {
      if (frame) cancelAnimationFrame(frame)
      frame = 0
      snapping = false
      lastTop = scroller!.scrollTop
    }

    // Native `scrollTo({behavior:'smooth'})` has no duration control and
    // defaults to a noticeably slow glide for a short snap — a fixed, quick
    // rAF tween reads as an actual magnet instead of a sluggish drift.
    function animateTo(target: number) {
      const start = scroller!.scrollTop
      const change = target - start
      if (!change) return
      const t0 = performance.now()
      snapping = true
      function step(now: number) {
        if (!snapping) return
        const p = Math.min(1, (now - t0) / SNAP_MS)
        const eased = 1 - Math.pow(1 - p, 3)
        scroller!.scrollTop = start + change * eased
        if (p < 1) frame = requestAnimationFrame(step)
        else {
          frame = 0
          snapping = false
          lastTop = scroller!.scrollTop
          dir = 0
        }
      }
      frame = requestAnimationFrame(step)
    }

    function evaluate() {
      debounce = null
      if (snapping || touching) return
      // Read live rather than caching — hero's height depends on real
      // profile content (bio present or not), so it can differ per profile.
      const overlap = -parseFloat(getComputedStyle(body!).marginTop || '0')
      const threshold = hero!.offsetHeight - overlap
      const top = scroller!.scrollTop
      if (top <= 0 || top >= threshold) return
      const target = dir > 0 ? threshold : dir < 0 ? 0 : top < threshold / 2 ? 0 : threshold
      if (reduceMotion) scroller!.scrollTop = target
      else animateTo(target)
    }

    function schedule() {
      if (debounce) clearTimeout(debounce)
      debounce = setTimeout(evaluate, SETTLE_MS)
    }

    function onScroll() {
      // The snap's own frames scroll too; they must not re-arm the timer or change the direction.
      if (snapping) return
      const top = scroller!.scrollTop
      if (Math.abs(top - lastTop) >= 2) dir = top > lastTop ? 1 : -1
      lastTop = top
      if (touching) return
      schedule()
    }
    function onTouchStart() {
      touching = true
      stopSnap()
      lastTop = scroller!.scrollTop
      dir = 0
      if (debounce) clearTimeout(debounce)
      debounce = null
    }
    function onTouchEnd() {
      touching = false
      // The momentum (if any) keeps scrolling and re-arms the timer; with none, this settles it.
      schedule()
    }
    function onWheel() {
      stopSnap()
    }

    scroller.addEventListener('scroll', onScroll, { passive: true })
    scroller.addEventListener('touchstart', onTouchStart, { passive: true })
    scroller.addEventListener('touchend', onTouchEnd, { passive: true })
    scroller.addEventListener('touchcancel', onTouchEnd, { passive: true })
    scroller.addEventListener('wheel', onWheel, { passive: true })
    return () => {
      scroller.removeEventListener('scroll', onScroll)
      scroller.removeEventListener('touchstart', onTouchStart)
      scroller.removeEventListener('touchend', onTouchEnd)
      scroller.removeEventListener('touchcancel', onTouchEnd)
      scroller.removeEventListener('wheel', onWheel)
      if (debounce) clearTimeout(debounce)
      stopSnap()
    }
  }, [])

  return heroRef
}
