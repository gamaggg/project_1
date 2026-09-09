'use client'

export function WelcomeStep({ onCapture, onSignIn }: { onCapture: () => void; onSignIn: () => void }) {
  return (
    <div className="onboarding-welcome">
      <svg className="onboarding-welcome-bg" viewBox="0 0 400 880" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <path id="welcomeFish" d="M0 0C3 -5 13 -5 18 -1C21 -3 25 -3 27 0C25 3 21 3 18 1C13 5 3 5 0 0Z" />
        </defs>
        <g fill="none" stroke="#DEDBD2" strokeWidth="1.5">
          <path d="M-20,130 C60,108 100,150 180,128 S 300,96 430,118" />
          <path d="M-20,192 C70,175 112,207 192,185 S 312,158 430,178" opacity=".75" />
          <path d="M-20,252 C82,235 132,267 204,243 S 322,216 430,233" opacity=".55" />
          <path d="M-20,700 C70,680 120,715 200,695 S 320,665 430,685" opacity=".4" />
        </g>
        <path
          d="M28,44 C46,132 12,206 58,296 C96,368 176,392 214,458 C246,514 256,586 288,634"
          fill="none"
          stroke="#FB6A16"
          strokeWidth="2"
          strokeDasharray="1 8"
          strokeLinecap="round"
          opacity=".5"
        />
        <g transform="translate(288,634)" opacity=".65">
          <circle r="9" fill="none" stroke="#FB6A16" strokeWidth="2" />
          <circle r="3" fill="#FB6A16" />
          <line x1="0" y1="9" x2="0" y2="32" stroke="#FB6A16" strokeWidth="2" />
        </g>
        <g fill="#C9C6BC">
          <use href="#welcomeFish" transform="translate(150,318) scale(1.15) rotate(18)" />
          <use href="#welcomeFish" transform="translate(196,352) scale(0.85) rotate(24)" />
          <use href="#welcomeFish" transform="translate(124,368) scale(0.7) rotate(6)" />
        </g>
        <g fill="var(--accent)" opacity=".92">
          <path d="M-40,920 L-40,842 C-36,800 10,776 56,786 C100,796 118,832 106,864 C96,892 66,920 30,920 Z" />
          <ellipse cx="86" cy="800" rx="10" ry="16" transform="rotate(-22 86 800)" />
          <path d="M440,920 L440,830 C436,782 388,760 344,774 C302,788 288,826 304,860 C318,890 356,920 396,920 Z" />
          <ellipse cx="366" cy="756" rx="9" ry="15" transform="rotate(-14 366 756)" />
        </g>
      </svg>
      <div className="onboarding-welcome-meta onboarding-welcome-meta--left">
        <div>41.617° N</div>
        <div>41.637° E</div>
        <div className="onboarding-welcome-meta-dash" />
      </div>
      <div className="onboarding-welcome-meta onboarding-welcome-meta--right">
        <div>БОЛЬШЕ РЫБЫ</div>
        <div>ГРОМЧЕ ИСТОРИЙ</div>
        <div className="onboarding-welcome-meta-dash" />
      </div>
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
