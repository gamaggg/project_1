// Drawn stand-ins for the shop's photos and goods on the demo card. A real shop sends its own pictures.

export function GallerySlide({ n }: { n: number }) {
  if (n === 0) {
    return (
      <svg viewBox="0 0 400 240" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="gs-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#9FD3F5" />
            <stop offset="1" stopColor="#E8F4FB" />
          </linearGradient>
          <linearGradient id="gs-wall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFF4E8" />
            <stop offset="1" stopColor="#F3DCC3" />
          </linearGradient>
        </defs>
        <rect width="400" height="240" fill="url(#gs-sky)" />
        <ellipse cx="80" cy="52" rx="46" ry="14" fill="#fff" opacity="0.8" />
        <ellipse cx="320" cy="34" rx="36" ry="11" fill="#fff" opacity="0.7" />
        <rect y="196" width="400" height="44" fill="#8E9AA5" />
        <rect y="196" width="400" height="6" fill="#B7C0C8" />
        <rect x="70" y="70" width="260" height="128" rx="6" fill="url(#gs-wall)" />
        <rect x="70" y="52" width="260" height="30" fill="#17181B" />
        {Array.from({ length: 10 }, (_, i) => (
          <path key={i} d={`M${70 + i * 26},82 h26 l-5,24 h-26 z`} fill={i % 2 ? '#FFFFFF' : '#FC5200'} />
        ))}
        <rect x="92" y="112" width="120" height="68" rx="4" fill="#BFE3F7" stroke="#17181B" strokeWidth="3" />
        <path d="M110,176 L150,122 M130,176 L186,118 M156,176 L204,128" stroke="#17181B" strokeWidth="2.5" strokeLinecap="round" opacity="0.55" />
        <rect x="232" y="112" width="70" height="86" rx="4" fill="#17181B" />
        <circle cx="290" cy="156" r="3.5" fill="#FC5200" />
        <rect x="244" y="124" width="46" height="26" rx="3" fill="#BFE3F7" />
        <g transform="translate(336 120)">
          <path d="M0,76 L18,-30" stroke="#17181B" strokeWidth="3" strokeLinecap="round" />
          <path d="M18,-30 q16,6 14,34" stroke="#17181B" strokeWidth="1.5" fill="none" />
          <circle cx="8" cy="40" r="7" fill="#FC5200" />
        </g>
      </svg>
    )
  }
  if (n === 1) {
    return (
      <svg viewBox="0 0 400 240" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="gs-wood" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#4A3A2E" />
            <stop offset="1" stopColor="#2E241C" />
          </linearGradient>
        </defs>
        <rect width="400" height="240" fill="url(#gs-wood)" />
        {Array.from({ length: 8 }, (_, i) => (
          <rect key={i} x={i * 50} width="2" height="240" fill="#00000030" />
        ))}
        {Array.from({ length: 9 }, (_, i) => {
          const x = 38 + i * 40
          const lean = (i % 3) * 4 - 4
          const cols = ['#FC5200', '#3E7BFA', '#2FA84F', '#F5B301', '#E63946']
          return (
            <g key={i}>
              <path d={`M${x},232 L${x + lean + 6},18`} stroke="#E9E4DC" strokeWidth="4" strokeLinecap="round" />
              <path d={`M${x + 1},232 L${x + lean + 6},18`} stroke={cols[i % 5]} strokeWidth="1.6" strokeLinecap="round" opacity="0.9" />
              <rect x={x - 5} y="166" width="10" height="34" rx="4" fill="#17181B" />
              <circle cx={x + 9} cy="178" r="9" fill="#C7CCD1" stroke="#17181B" strokeWidth="2" />
              <circle cx={x + 9} cy="178" r="3" fill={cols[(i + 2) % 5]} />
            </g>
          )
        })}
        <rect x="0" y="206" width="400" height="34" fill="#2E241C" />
        <rect x="0" y="206" width="400" height="4" fill="#5C4838" />
      </svg>
    )
  }
  const lures: [number, number, string, number][] = [
    [74, 70, '#FC5200', -12],
    [196, 62, '#2FA84F', 8],
    [318, 74, '#3E7BFA', -6],
    [118, 138, '#F5B301', 10],
    [250, 136, '#E63946', -10],
    [330, 176, '#A88EF5', 6],
    [70, 196, '#4CC9F0', -4],
  ]
  return (
    <svg viewBox="0 0 400 240" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="400" height="240" fill="#EFF3F6" />
      <rect x="20" y="20" width="360" height="200" rx="14" fill="#fff" stroke="#D5DDE4" strokeWidth="3" />
      <path d="M20 110 H380 M200 20 V220" stroke="#E3E9EE" strokeWidth="3" />
      {lures.map(([x, y, c, r], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}>
          <path d="M-30,0 C-14,-16 16,-16 32,0 C16,16 -14,16 -30,0 Z" fill={c} />
          <path d="M-8,-12 C-2,-4 -2,4 -8,12" stroke="#fff" strokeWidth="2.4" fill="none" opacity="0.7" />
          <path d="M32,0 L44,-10 L44,10 Z" fill={c} opacity="0.85" />
          <circle cx="-18" cy="-2" r="3.6" fill="#fff" />
          <circle cx="-18" cy="-2" r="1.6" fill="#17181B" />
          <path d="M6,13 q3,10 -2,13" stroke="#8A9199" strokeWidth="2" fill="none" strokeLinecap="round" />
        </g>
      ))}
      <rect x="296" y="126" width="62" height="70" rx="10" fill="#E9D8BF" stroke="#B89A72" strokeWidth="3" />
      <rect x="292" y="118" width="70" height="14" rx="5" fill="#FC5200" />
      <path d="M310,160 q8,-14 18,0 t18,0" stroke="#B5513A" strokeWidth="5" fill="none" strokeLinecap="round" />
    </svg>
  )
}

// Product icons in the app's own line style (24 grid, round 2.2 stroke, like the profile icons).
const ICONS: React.ReactNode[] = [
  // rod
  <g key="rod">
    <path d="M4 20 17 7" />
    <path d="M17 7c2.6-.4 4 .6 4 3v5" />
    <path d="M21 15a2 2 0 1 1-3.6 1.2" />
    <path d="M7.5 13.5l3 3" />
  </g>,
  // spinning reel
  <g key="reel">
    <circle cx="11.5" cy="13.5" r="6.5" />
    <circle cx="11.5" cy="13.5" r="2.4" />
    <path d="M11.5 7V3.5M8.5 3.5h6" />
    <path d="M18 13.5h3.5v3.5" />
  </g>,
  // wobbler with a hook
  <g key="lure">
    <path d="M5 11c3-3.5 9-3.5 13 0-4 3.5-10 3.5-13 0z" />
    <path d="M5 11 2.5 13.5M18 11l3-2.5v5z" />
    <circle cx="8.6" cy="10.4" r="0.9" fill="currentColor" stroke="none" />
    <path d="M11.5 14.6v2.2a1.8 1.8 0 0 0 3.6 0" />
  </g>,
  // hook with a worm
  <g key="bait">
    <path d="M13 3.5v10.5a4 4 0 0 1-8 0" />
    <circle cx="13" cy="3.5" r="1.5" />
    <path d="M12.5 21c1.6-2.2 2.8 1 4.3 0s2.6-2.2 4.2-.6" />
  </g>,
  // boat
  <g key="boat">
    <path d="M3 14h18l-2.6 5H5.6z" />
    <path d="M12 14V4.5l5.5 9.5" />
    <path d="M12 8.5 7.5 14" />
  </g>,
  // jacket
  <g key="wear">
    <path d="M8.5 4 4 7l2 3 2-1v11h8V9l2 1 2-3-4.5-3c-.7 1.6-2 2.4-3.5 2.4S9.2 5.6 8.5 4z" />
    <path d="M12 6.5V20" />
  </g>,
]

export function ProductIcon({ i }: { i: number }) {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[i % ICONS.length]}
    </svg>
  )
}
