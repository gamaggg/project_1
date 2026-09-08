export function FishIcon({ size = 20, stroke = '#fff' }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <path d="M6 32c8-14 20-20 34-14-2 6-2 14 0 20-14 6-26 0-34-14z" stroke={stroke} strokeWidth={2} fill="rgba(255,255,255,0.10)" />
      <path d="M40 25c4-3 9-4 13-2-3 3-3 8 0 11-4 2-9 1-13-2" stroke={stroke} strokeWidth={2} fill="rgba(255,255,255,0.10)" />
      <circle cx="16" cy="29" r="1.7" fill={stroke} />
    </svg>
  )
}

export const ACH_ICONS: Record<string, React.ReactNode> = {
  first: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9c0 4 2.5 7 6 7s6-3 6-7" />
      <path d="M6 9V4h12v5" />
      <path d="M4 5h2M18 5h2M10 20h4M12 16v4" />
    </svg>
  ),
  territory: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17c3-5 6-7.5 9-7.5s6 2.5 9 7.5" />
      <circle cx="12" cy="7" r="2.4" />
    </svg>
  ),
  species: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 14c4-6 9-9 13-6-1 3-1 6 0 9-4 3-9 0-13-3z" />
      <circle cx="7.5" cy="12.2" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  ),
  sunrise: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 18h16M6 18a6 6 0 0 1 12 0" />
      <path d="M12 8V5M5.5 12 4 10.5M18.5 12 20 10.5" />
    </svg>
  ),
  record: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12M12 15l4-4M12 15l-4-4" />
      <path d="M5 21h14" />
    </svg>
  ),
  ten: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 21h16M12 21V7l-3 2M17 21v-8l-3 2" />
    </svg>
  ),
  universal: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
      <path d="M3 13c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
      <path d="M3 19c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
    </svg>
  ),
  allmethods: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 19 19 5" />
      <path d="M19 5c2.2 0 3 1 3 3" />
      <path d="M5 19c0 2 1 2.8 3 2" />
    </svg>
  ),
  allbaits: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h6M10 3v6.5l-4.4 8.7A2 2 0 0 0 7.4 21h9.2a2 2 0 0 0 1.8-2.8L14 9.5V3" />
      <circle cx="9.6" cy="15.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  allwaters: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" />
    </svg>
  ),
  heavy: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="3.5" width="6" height="4.5" rx="1.3" />
      <path d="M9 8V7a3 3 0 0 1 6 0v1" />
      <path d="M7.2 8h9.6l1.7 11.5a1.4 1.4 0 0 1-1.4 1.5H6.9a1.4 1.4 0 0 1-1.4-1.5z" />
    </svg>
  ),
  giant: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="9" width="18" height="6" rx="1.5" />
      <path d="M7 9v3M11 9v3M15 9v3M19 9v3" />
    </svg>
  ),
  nightowl: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
    </svg>
  ),
  loyal: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 2l4 4-4 4" />
      <path d="M3 12v-2a4 4 0 0 1 4-4h14" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 12v2a4 4 0 0 1-4 4H3" />
    </svg>
  ),
  landlord: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8l4 3 5-6 5 6 4-3-2 10H5z" />
      <path d="M5 21h14" />
    </svg>
  ),
  popular: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.5 2.5-6 6-6s6 2.5 6 6" />
      <circle cx="17" cy="9" r="2.3" />
      <path d="M15.5 14c2.7.3 4.5 2.4 4.5 6" />
    </svg>
  ),
  conqueror: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3v18" />
      <path d="M6 4c3-2 5 1 8-1 1.5-1 3 0 4 0v9c-1 0-2.5-1-4 0-3 2-5-1-8 1z" />
    </svg>
  ),
}
