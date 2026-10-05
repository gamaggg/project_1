// «Неделя в городе» — the city's last full week (Mon–Sun) as story slides,
// like a music service's year in review. Shared by the in-app player and
// the server that draws a slide as an image for «Поделиться», so nothing
// here touches the browser.

export type WeekRecap = {
  weekStart: string
  weekEnd: string
  catches: number
  anglers: number
  captures: number
  newPlayers: number
  prev: { catches: number; anglers: number; captures: number }
  topSpecies: { key: string; name: string; count: number; photoUrl: string | null }[]
  trophy: { catchId: number; species: string; lengthCm: number | null; weightKg: number | null; photoUrl: string; territoryId: string; userId: string; name: string | null; avatarUrl: string | null } | null
  angler: { userId: string; name: string | null; avatarUrl: string | null; catches: number; captures: number } | null
  sector: { territoryId: string; catches: number; kind: string | null } | null
  contested: { territoryId: string; changes: number } | null
  hours: number[]
  weekdays: number[]
  me: {
    catches: number
    captures: number
    species: number
    place: number | null
    best: { species: string | null; lengthCm: number | null; weightKg: number | null; photoUrl: string } | null
    name: string | null
    avatarUrl: string | null
  } | null
}

type Raw = {
  week_start: string
  week_end: string
  catches: number
  anglers: number
  captures: number
  new_players: number
  prev: { catches: number; anglers: number; captures: number }
  top_species: { key: string; name: string | null; count: number; photo_url: string | null }[]
  trophy: { catch_id: number; species: string | null; length_cm: number | null; weight_kg: number | null; photo_url: string; territory_id: string; user_id: string; name: string | null; avatar_url: string | null } | null
  angler: { user_id: string; name: string | null; avatar_url: string | null; catches: number; captures: number } | null
  sector: { territory_id: string; catches: number; kind: string | null } | null
  contested: { territory_id: string; changes: number } | null
  hours: number[]
  weekdays: number[]
  me: {
    catches: number
    captures: number
    species: number
    place: number | null
    best: { species: string | null; length_cm: number | null; weight_kg: number | null; photo_url: string } | null
    name: string | null
    avatar_url: string | null
  } | null
}

export function mapRecap(d: Raw): WeekRecap {
  return {
    weekStart: d.week_start,
    weekEnd: d.week_end,
    catches: d.catches,
    anglers: d.anglers,
    captures: d.captures,
    newPlayers: d.new_players,
    prev: d.prev,
    topSpecies: d.top_species.map((s) => ({ key: s.key, name: s.name ?? s.key, count: s.count, photoUrl: s.photo_url })),
    trophy: d.trophy
      ? {
          catchId: d.trophy.catch_id,
          species: d.trophy.species ?? '',
          lengthCm: d.trophy.length_cm,
          weightKg: d.trophy.weight_kg == null ? null : Number(d.trophy.weight_kg),
          photoUrl: d.trophy.photo_url,
          territoryId: d.trophy.territory_id,
          userId: d.trophy.user_id,
          name: d.trophy.name,
          avatarUrl: d.trophy.avatar_url,
        }
      : null,
    angler: d.angler ? { userId: d.angler.user_id, name: d.angler.name, avatarUrl: d.angler.avatar_url, catches: d.angler.catches, captures: d.angler.captures } : null,
    sector: d.sector ? { territoryId: d.sector.territory_id, catches: d.sector.catches, kind: d.sector.kind } : null,
    contested: d.contested ? { territoryId: d.contested.territory_id, changes: d.contested.changes } : null,
    hours: d.hours,
    weekdays: d.weekdays,
    me: d.me
      ? {
          catches: d.me.catches,
          captures: d.me.captures,
          species: d.me.species,
          place: d.me.place,
          best: d.me.best
            ? { species: d.me.best.species, lengthCm: d.me.best.length_cm, weightKg: d.me.best.weight_kg == null ? null : Number(d.me.best.weight_kg), photoUrl: d.me.best.photo_url }
            : null,
          name: d.me.name,
          avatarUrl: d.me.avatar_url,
        }
      : null,
  }
}

export type SlideId = 'intro' | 'numbers' | 'species' | 'trophy' | 'angler' | 'sector' | 'time' | 'you' | 'final'

// Which slides this week has: a slide with nothing to show is skipped
// (no sized catch → no trophy, and so on). «Ты за неделю» is always there.
export function recapSlides(r: WeekRecap): SlideId[] {
  const out: SlideId[] = ['intro', 'numbers']
  if (r.topSpecies.length) out.push('species')
  if (r.trophy) out.push('trophy')
  if (r.angler) out.push('angler')
  if (r.sector) out.push('sector')
  if (r.hours.some((h) => h > 0)) out.push('time')
  out.push('you', 'final')
  return out
}

// The busiest 3-hour stretch of the day, wrapping past midnight.
export function busiestWindow(hours: number[]): { from: number; to: number } | null {
  if (hours.reduce((a, b) => a + b, 0) < 3) return null
  let best = -1
  let start = 0
  for (let h = 0; h < 24; h++) {
    const sum = hours[h] + hours[(h + 1) % 24] + hours[(h + 2) % 24]
    if (sum > best) {
      best = sum
      start = h
    }
  }
  return { from: start, to: (start + 3) % 24 }
}

// Image-service URL for a Supabase public photo at a given box.
export function sizedPhoto(url: string, width: number, height: number): string {
  const marker = '/storage/v1/object/public/'
  const i = url.indexOf(marker)
  if (i === -1) return url
  return `${url.slice(0, i)}/storage/v1/render/image/public/${url.slice(i + marker.length).split('?')[0]}?width=${width}&height=${height}&resize=cover&quality=75`
}
