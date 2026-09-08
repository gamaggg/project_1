'use client'

import { GlobeView } from '@/components/app-shell/onboarding/GlobeView'

export function WelcomeStep({ onCapture, onSignIn }: { onCapture: () => void; onSignIn: () => void }) {
  return (
    <div className="onboarding-welcome">
      <GlobeView />
      <div className="onboarding-scrim" />
      <div className="onboarding-welcome-card">
        <div className="onboarding-welcome-title">
          Когда рыбалка в радость,
          <br />
          она становится привычкой
        </div>
        <div style={{ fontSize: 14, opacity: 0.85, lineHeight: 1.5 }}>
          Двое из трёх рыбаков, занявших территорию в первый визит, вернулись за новым уловом.
        </div>
        <button className="btn-primary" onClick={onCapture}>
          Захватить первую территорию
        </button>
        <button className="onboarding-welcome-link" onClick={onSignIn}>
          У меня уже есть аккаунт
        </button>
      </div>
    </div>
  )
}
