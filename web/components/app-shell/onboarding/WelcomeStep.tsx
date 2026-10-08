'use client'

import { useCallback, useRef, useState } from 'react'
import { CoinIcon } from '@/components/app-shell/CoinIcon'
import { WelcomeMap } from '@/components/app-shell/onboarding/WelcomeMap'
import type { TickerLine } from '@/lib/welcome/coastScene'

// The first screen: «Лови / Занимай / Владей» over a live map of the Batumi
// coast where sectors change hands (WelcomeMap), a ticker of those captures,
// and the two ways in.
export function WelcomeStep({
  onCapture,
  onSignIn,
  onContinue,
  invited,
}: {
  onCapture?: () => void
  onSignIn?: () => void
  onContinue?: () => void
  // From a friend's invite link: the +100 start bonus (claim_referral) shown up front.
  invited?: boolean
}) {
  const headRef = useRef<HTMLDivElement>(null)
  const footRef = useRef<HTMLDivElement>(null)
  const [line, setLine] = useState<TickerLine | null>(null)
  const onTicker = useCallback((l: TickerLine) => setLine(l), [])

  return (
    <div className="onboarding-welcome">
      <WelcomeMap headRef={headRef} footRef={footRef} onTicker={onTicker} />
      <div className="welcome-head" ref={headRef}>
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
        <img src="/brand/logo_2.svg" alt="RANGE" className="welcome-logo" />
        <h1 className="welcome-title">
          <span>Лови</span>
          <span className="welcome-title-accent">Занимай</span>
          <span>Владей</span>
        </h1>
        <p className="welcome-sub">Каждый улов меняет карту</p>
      </div>
      <div className="welcome-foot" ref={footRef}>
        {invited && (
          <div className="welcome-invite">
            <CoinIcon size={16} />
            Друг пригласил тебя · +100 монет на старт
          </div>
        )}
        <div className="welcome-ticker" aria-live="polite">
          <i className="welcome-ticker-dot" aria-hidden />
          {line && (
            <span key={`${line.name}${line.id}${line.day}`} className="welcome-ticker-text">
              <b>{line.name}</b> {line.verb} <b>{line.id}</b> {line.day}
            </span>
          )}
        </div>
        {onContinue ? (
          <button className="btn-primary" onClick={onContinue}>
            Продолжить
          </button>
        ) : (
          <>
            <button className="btn-primary" onClick={onCapture}>
              Захватить первую территорию
            </button>
            <button className="welcome-link" onClick={onSignIn}>
              У меня уже есть аккаунт
            </button>
          </>
        )}
      </div>
    </div>
  )
}
