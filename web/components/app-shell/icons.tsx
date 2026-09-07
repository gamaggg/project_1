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
}
