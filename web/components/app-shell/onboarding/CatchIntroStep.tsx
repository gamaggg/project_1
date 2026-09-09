'use client'

export function CatchIntroStep({ onDone }: { onDone: () => void }) {
  return (
    <div className="intro-screen intro-screen--catch">
      <div className="intro-illustration">
        <div className="intro-camwrap">
          <div className="intro-camring">
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#FC5200" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 7h3.2L9 4.5h6L16.8 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" />
              <circle cx="12" cy="13" r="3.4" />
            </svg>
          </div>
          <div className="intro-flash" />
          <div className="intro-photocard">
            <div className="intro-photocard-inner">
              <svg width="44" height="28" viewBox="0 0 48 30" fill="#fff">
                <path d="M2 15c6-11 26-14 34-6 2 2 4 2 6-1-1 6-1 9 0 14-2-3-4-3-6-1-8 8-28 5-34-6z" />
                <circle cx="13" cy="13" r="2" fill="#C7430B" />
              </svg>
            </div>
          </div>
          <div className="intro-badge">
            <span className="intro-badge-hex" />
            <span className="intro-badge-label">Сектор твой</span>
          </div>
        </div>
      </div>
      <div className="intro-copy">
        <div className="intro-title">Поймал — значит занял</div>
        <div className="intro-sub">Сфотографируй улов на месте — и сектор мгновенно переходит к тебе.</div>
        <button className="intro-cta" onClick={onDone}>
          Продолжить
        </button>
      </div>
    </div>
  )
}
