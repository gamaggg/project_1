'use client'

import { useEffect, useState } from 'react'
import { formatChallengeCountdown } from '@/lib/format'

// Pill in the week card's corner (see ChallengesScreen). Ticks every 30s —
// the display never shows finer than whole minutes, so anything tighter
// would just be wasted re-renders — and switches to a quieter "Завершено"
// look once the deadline passes instead of counting into negative time.
export function ChallengeCountdown({ endsAt }: { endsAt: string | null }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  if (!endsAt) return null
  const { text, done } = formatChallengeCountdown(new Date(endsAt).getTime() - now)

  return (
    <div className={`challenge-countdown${done ? ' challenge-countdown-done' : ''}`}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.5 2" />
      </svg>
      {text}
    </div>
  )
}
