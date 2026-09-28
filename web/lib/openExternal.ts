// A link that leaves RANGE (a maps app, a website). Inside the Telegram Mini
// App a plain window.open is swallowed, so it goes through Telegram's own
// openLink; in a browser it's a new tab.
export function openExternal(url: string) {
  const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined
  if (tg?.openLink) tg.openLink(url)
  else window.open(url, '_blank', 'noopener,noreferrer')
}

// "41.54334, 41.55939" — the form every maps app accepts in its search box.
export function formatCoords(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}

// Route-to links for the maps people actually use here.
export function mapsLinks(lat: number, lng: number): { id: string; label: string; url: string }[] {
  const ll = `${lat.toFixed(6)},${lng.toFixed(6)}`
  return [
    { id: 'google', label: 'Google Карты', url: `https://www.google.com/maps/dir/?api=1&destination=${ll}` },
    { id: 'yandex', label: 'Яндекс Карты', url: `https://yandex.ru/maps/?rtext=~${ll}&rtt=auto` },
    { id: 'apple', label: 'Apple Карты', url: `https://maps.apple.com/?daddr=${ll}` },
  ]
}
