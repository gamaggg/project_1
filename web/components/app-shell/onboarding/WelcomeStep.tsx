'use client'

export function WelcomeStep({ onCapture, onSignIn }: { onCapture: () => void; onSignIn: () => void }) {
  return (
    <div className="onboarding-welcome">
      <div className="onboarding-welcome-logo">
        <div className="onboarding-welcome-mark-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset, next/image's optimizer is overkill here */}
          <img src="/brand/logo_1.svg" alt="RANGE" className="onboarding-welcome-mark" />
          {/* Same image, recolored pure white via filter (so its own alpha channel gives
              a pixel-perfect silhouette — no CSS mask/luminance guessing), then a plain
              gradient mask sweeps a band across just that white copy for the shine. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
          <img src="/brand/logo_1.svg" alt="" aria-hidden="true" className="onboarding-welcome-shine" />
        </div>
      </div>
      <div className="onboarding-welcome-card">
        <div className="onboarding-welcome-title">
          <span>Лови</span>
          <span className="onboarding-welcome-title-accent">Занимай</span>
          <span>Владей</span>
        </div>
        <div className="onboarding-welcome-sub">
          Двое из трёх рыбаков, занявших территорию
          <br />
          в первый визит, вернулись за новым уловом.
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
