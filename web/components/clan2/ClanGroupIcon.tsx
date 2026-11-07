// Line icons for the clan screen's four paired tabs (and the admin tab): coins for the treasury and HQ, a sail for
// the outing and week, two people for members and the hall, crossed swords for the battle and chest.

export type ClanGroupId = 'money' | 'outing' | 'people' | 'battle' | 'admin'

export function ClanGroupIcon({ id }: { id: ClanGroupId }) {
  return (
    <svg className="clan-group-icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {id === 'money' && (
        <>
          <ellipse cx="12" cy="6" rx="7" ry="3" />
          <path d="M5 6v5.5c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
          <path d="M5 11.5V17c0 1.7 3.1 3 7 3s7-1.3 7-3v-5.5" />
        </>
      )}
      {id === 'outing' && (
        <>
          <path d="M12 3v13" />
          <path d="M12 4.5l6.5 10H12" />
          <path d="M3.5 17h17l-2.6 3.6H6.1z" />
        </>
      )}
      {id === 'people' && (
        <>
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3 20c.6-3.4 3-5.5 6-5.5s5.4 2.1 6 5.5" />
          <circle cx="17" cy="9" r="2.6" />
          <path d="M16.6 14.6c2.3.3 3.9 2 4.4 4.6" />
        </>
      )}
      {id === 'battle' && (
        <>
          <path d="M14.5 17.5L3 6V3h3l11.5 11.5" />
          <path d="M13 19l6-6M16 16l4 4M19 21l2-2" />
          <path d="M9.5 17.5L21 6V3h-3L6.5 14.5" />
          <path d="M11 19l-6-6M8 16l-4 4M5 21l-2-2" />
        </>
      )}
      {id === 'admin' && (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
        </>
      )}
    </svg>
  )
}
