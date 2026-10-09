// One spotlight at a time: the screen tours (SpotlightTours) and the weekly
// hot-sector tour (HotSectorsTour) both dim the screen, and two starting in
// the same tick would stack. Whoever takes the lock first goes; the other
// waits for it.
let holder: string | null = null

export function tryLockTour(id: string): boolean {
  if (holder && holder !== id) return false
  holder = id
  return true
}

export function releaseTour(id: string) {
  if (holder === id) holder = null
}

export function tourLocked(): boolean {
  return holder !== null
}
