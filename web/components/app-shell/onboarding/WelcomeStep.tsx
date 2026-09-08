'use client'

export function WelcomeStep({ onCapture, onSignIn }: { onCapture: () => void; onSignIn: () => void }) {
  return (
    <div className="onboarding-welcome">
      <div className="onboarding-welcome-logo">
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none">
          <path d="M3 17c3-5 6-7.5 9-7.5s6 2.5 9 7.5" stroke="#FC5200" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M3 12.5c3-5 6-7.5 9-7.5s6 2.5 9 7.5" stroke="#FC5200" strokeWidth="2.2" strokeLinecap="round" opacity="0.4" />
        </svg>
        <span>FishZone</span>
      </div>
      <div className="onboarding-welcome-card">
        <div className="onboarding-welcome-title">
          Когда рыбалка в радость,
          <br />
          она становится привычкой
        </div>
        <div className="onboarding-welcome-sub">
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
