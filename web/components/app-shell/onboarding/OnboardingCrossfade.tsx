'use client'

import { useEffect, useState, type ReactNode } from 'react'

// The night picture (the welcome and the two intro screens, one map) and the
// light forms after it are two different worlds — cutting from one to the other,
// either way, is a jolt. This holds the one that is being left on screen, as the
// very same instance (nothing in it is remounted or reset), for a moment after
// the other has taken its place: it dissolves while the new one comes up under
// it. `journey` is the welcome / intro element (null on any other step), `rest`
// is the step that is not one of them (null while on the journey).
const FADE_MS = 750

export function OnboardingCrossfade({ journey, rest }: { journey: ReactNode; rest: ReactNode }) {
  // The last of each, kept for the moment it is being left (what the parent
  // stops passing is gone from the props, but still has to be drawn).
  const [lastJourney, setLastJourney] = useState<ReactNode>(null)
  const [lastRest, setLastRest] = useState<ReactNode>(null)
  if (journey && journey !== lastJourney) setLastJourney(journey)
  if (rest && rest !== lastRest) setLastRest(rest)
  // «Just crossed over» — decided while rendering, so what is being left never
  // goes missing for even one frame.
  const [onJourney, setOnJourney] = useState(!!journey)
  const [leaving, setLeaving] = useState<'journey' | 'rest' | null>(null)
  if (!!journey !== onJourney) {
    setOnJourney(!!journey)
    setLeaving(journey ? 'rest' : 'journey')
  }
  useEffect(() => {
    if (!leaving) return
    const id = window.setTimeout(() => setLeaving(null), FADE_MS)
    return () => clearTimeout(id)
  }, [leaving])

  const journeyLeaving = !journey && leaving === 'journey'
  const restLeaving = !rest && leaving === 'rest'
  return (
    <div className="ob-stage">
      {(journey || journeyLeaving) && (
        <div className={journeyLeaving ? 'ob-leaving' : journey && leaving ? 'ob-fadein' : 'ob-journey'}>{journey ?? lastJourney}</div>
      )}
      {(rest || restLeaving) && <div className={restLeaving ? 'ob-leaving ob-leaving--light' : rest && leaving ? 'ob-enter' : 'ob-rest'}>{rest ?? lastRest}</div>}
    </div>
  )
}
