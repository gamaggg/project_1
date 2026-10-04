'use client'

import { useEffect, useState } from 'react'

// The current time for render-time comparisons ("is this still hot?"),
// refreshed on an interval — calling Date.now() during render isn't pure.
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}
