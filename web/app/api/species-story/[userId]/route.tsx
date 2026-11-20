import { ImageResponse } from 'next/og'
import { createAdminClient } from '@/lib/supabase/admin'
import { CATEGORIES_BY_CITY, speciesBaseKey, speciesOfCity } from '@/lib/data/species'
import { speciesImageUrl } from '@/lib/data/speciesImages'
import { translate, type Lang } from '@/lib/i18n/core'
import { ru } from '@/lib/i18n/ru'
import { nameInitials } from '@/lib/initials'
import { cityForSectorId, type CityId } from '@/lib/data/city'

// «Виды рыб» → «В историю»: a 1080×1920 card of one player's fish collection,
// drawn by the server like the catch story (app/api/story): deep water, the
// count of fish collected out of the city's list with a bar by category, the
// fish they catch most drawn big, the next ones as small drawings, three
// numbers and a dare. Counts the same way as the screen (SpeciesScreen):
// one fish whatever the city (speciesBaseKey), the collection = the city's
// fish plus the ones caught elsewhere. Telegram's shareToStory needs a
// public https image, so this is a plain GET; catches are public anyway.
// ?lang=ru|en|ka&city=<CityId>.

const W = 1080
const H = 1920
const CITIES: CityId[] = ['batumi', 'moscow', 'spb', 'sochi', 'tbilisi']
const CATEGORY_COLOR: Record<string, string> = { marine: '#3FB4DB', freshwater: '#3DBE8B', predator: '#FF7A45', peaceful: '#7CC453' }

const T: Record<Lang, { kicker: string; of: (n: number) => string; favourite: string; catches: string; record: string; newest: string; dare: string; more: (n: number) => string }> = {
  ru: { kicker: 'Моя коллекция рыб', of: (n) => `из ${n} видов`, favourite: 'Чаще всего', catches: 'Уловов', record: 'Рекорд', newest: 'Новый вид', dare: 'А сколько собрал ты?', more: (n) => `+${n}` },
  en: { kicker: 'My fish collection', of: (n) => `of ${n} species`, favourite: 'Bites most', catches: 'Catches', record: 'Record', newest: 'Newest', dare: 'How many have you got?', more: (n) => `+${n}` },
  ka: { kicker: 'ჩემი თევზების კოლექცია', of: (n) => `${n} სახეობიდან`, favourite: 'ყველაზე ხშირად', catches: 'დაჭერა', record: 'რეკორდი', newest: 'ახალი სახეობა', dare: 'შენ რამდენი შეაგროვე?', more: (n) => `+${n}` },
}

// Fonts and the logo are the same for every card: fetched once per server
// instance. Google Fonts serves plain TTF to an old user agent, which is
// what the image renderer reads.
const fontCache = new Map<string, Promise<ArrayBuffer>>()
function googleFont(family: string, weight: number): Promise<ArrayBuffer> {
  const key = `${family}:${weight}`
  let p = fontCache.get(key)
  if (!p) {
    p = fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}`, { headers: { 'User-Agent': 'Mozilla/4.0' } })
      .then((r) => r.text())
      .then((css) => {
        const url = /src: url\(([^)]+)\) format\('truetype'\)/.exec(css)?.[1]
        if (!url) throw new Error(`no ttf for ${family}`)
        return fetch(url).then((r) => r.arrayBuffer())
      })
    p.catch(() => fontCache.delete(key))
    fontCache.set(key, p)
  }
  return p
}

let logoCache: Promise<string> | null = null
function logo(origin: string): Promise<string> {
  if (!logoCache) {
    logoCache = fetch(`${origin}/brand/logo_2.svg`)
      .then((r) => r.text())
      .then((svg) => `data:image/svg+xml;base64,${Buffer.from(svg.replace(/class="cls-1"/g, 'fill="#FF6A1F"')).toString('base64')}`)
    logoCache.catch(() => (logoCache = null))
  }
  return logoCache
}

async function dataUrl(url: string | null): Promise<string | null> {
  if (!url) return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const type = res.headers.get('content-type') ?? 'image/png'
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`
  } catch {
    return null
  }
}

type Fish = { key: string; name: string; category: string; count: number; bestLen: number | null; firstAt: string; cats: Map<string, number> }

export async function GET(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return new Response('bad user id', { status: 400 })
  const url = new URL(request.url)
  const lang = (['ru', 'en', 'ka'].includes(url.searchParams.get('lang') ?? '') ? url.searchParams.get('lang') : 'ru') as Lang
  const city = (CITIES.includes(url.searchParams.get('city') as CityId) ? url.searchParams.get('city') : 'batumi') as CityId
  const t = T[lang]

  const admin = createAdminClient()
  const [{ data: profile }, { data: catches }, { data: allSpecies }] = await Promise.all([
    admin.from('profiles').select('display_name, avatar_url').eq('id', userId).maybeSingle(),
    admin.from('catches').select('species, length_cm, caught_at, territory_id').eq('user_id', userId),
    admin.from('species').select('key, name, category').order('sort_order').order('name'),
  ])
  if (!profile) return new Response('not found', { status: 404 })
  const species = allSpecies ?? []
  const localName = (key: string, name: string) => (lang !== 'ru' && key in ru.species ? translate(lang, `species.${key}` as never) : name)

  // One fish per base key, as on the screen.
  const byKey = new Map<string, Fish>()
  for (const c of catches ?? []) {
    const key = speciesBaseKey(c.species)
    const row = species.find((s) => s.key === c.species)
    let f = byKey.get(key)
    if (!f) {
      f = { key, name: localName(c.species, row?.name ?? c.species), category: row?.category ?? 'marine', count: 0, bestLen: null, firstAt: c.caught_at, cats: new Map() }
      byKey.set(key, f)
    }
    f.count += 1
    if (c.length_cm && (!f.bestLen || c.length_cm > f.bestLen)) f.bestLen = c.length_cm
    if (c.caught_at < f.firstAt) f.firstAt = c.caught_at
    if (row) f.cats.set(row.category, (f.cats.get(row.category) ?? 0) + 1)
  }
  for (const f of byKey.values()) if (f.cats.size > 1) f.category = [...f.cats.entries()].sort((a, b) => b[1] - a[1])[0][0]
  const fish = [...byKey.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

  const seen = new Set<string>()
  const once = (s: { key: string }) => {
    const b = speciesBaseKey(s.key)
    if (seen.has(b)) return false
    seen.add(b)
    return true
  }
  // As on the screen: a category of another city the player has a fish from joins whole.
  const own = CATEGORIES_BY_CITY[city] as string[]
  const joined = new Set<string>()
  const ofOthers: typeof species = []
  for (const c of catches ?? []) {
    const category = species.find((s) => s.key === c.species)?.category
    const where = cityForSectorId(c.territory_id)
    const tag = `${where}:${category}`
    if (!category || own.includes(category) || joined.has(tag) || !(CATEGORIES_BY_CITY[where] as string[]).includes(category)) continue
    joined.add(tag)
    ofOthers.push(...speciesOfCity(species, where).filter((s) => s.category === category))
  }
  const collection = [...speciesOfCity(species, city).filter(once), ...ofOthers.filter(once), ...species.filter((s) => byKey.has(speciesBaseKey(s.key))).filter(once)]
  const total = Math.max(collection.length, fish.length)
  const pct = total ? Math.min(1, fish.length / total) : 0

  const favourite = fish[0] ?? null
  const record = fish.reduce<Fish | null>((b, f) => (f.bestLen && (!b || f.bestLen > (b.bestLen ?? 0)) ? f : b), null)
  const newest = fish.reduce<Fish | null>((n, f) => (!n || f.firstAt > n.firstAt ? f : n), null)
  const byCategory = [...fish.reduce((m, f) => m.set(f.category, (m.get(f.category) ?? 0) + 1), new Map<string, number>()).entries()]
  // Six small drawings after the favourite; the sixth place says how many more there are.
  const rest = fish.slice(1)
  const shown = rest.length > 6 ? rest.slice(0, 5) : rest.slice(0, 6)
  const more = rest.length - shown.length
  const totalCatches = (catches ?? []).length
  const cm = lang === 'en' ? 'cm' : lang === 'ka' ? 'სმ' : 'см'
  const name = profile.display_name ?? 'RANGE'

  try {
    // The drawings as PNG (public/fish/story, 560×400): the image renderer
    // doesn't read the screens' WebP.
    const art = (key: string) => {
      const u = speciesImageUrl(key)
      return dataUrl(u ? `${url.origin}${u.replace(/^\/fish\/(.+)\.webp$/, '/fish/story/$1.png')}` : null)
    }
    const [logoSrc, avatar, favArt, smallArt, display, body, georgian] = await Promise.all([
      logo(url.origin),
      dataUrl(profile.avatar_url ?? null),
      favourite ? art(favourite.key) : Promise.resolve(null),
      Promise.all(shown.map((f) => art(f.key))),
      googleFont('Oswald', 700),
      googleFont('Manrope', 800),
      lang === 'ka' ? googleFont('Noto Sans Georgian', 800) : Promise.resolve(null),
    ])
    const fonts = [
      { name: 'Oswald', data: display, weight: 700 as const, style: 'normal' as const },
      { name: 'Manrope', data: body, weight: 800 as const, style: 'normal' as const },
      ...(georgian ? [{ name: 'Noto Sans Georgian', data: georgian, weight: 800 as const, style: 'normal' as const }] : []),
    ]
    const bodyFont = georgian ? 'Manrope, "Noto Sans Georgian"' : 'Manrope'
    const favName = favourite?.name ?? ''
    const favSize = favName.length > 14 ? 64 : favName.length > 9 ? 76 : 88

    return new ImageResponse(
      (
        <div
          style={{
            width: W,
            height: H,
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            padding: '92px 72px 84px',
            fontFamily: bodyFont,
            color: '#fff',
            background: 'radial-gradient(90% 45% at 85% 30%, rgba(120,214,240,0.30), rgba(120,214,240,0) 70%), linear-gradient(165deg, #12698A 0%, #0C4A65 48%, #072B3C 100%)',
          }}
        >
          {/* Rings on the water behind the favourite fish. */}
          <div style={{ position: 'absolute', left: 140, top: 660, width: 800, height: 800, borderRadius: 400, border: '2px solid rgba(255,255,255,0.06)', display: 'flex' }} />
          <div style={{ position: 'absolute', left: 240, top: 760, width: 600, height: 600, borderRadius: 300, border: '2px solid rgba(255,255,255,0.07)', display: 'flex' }} />

          {/* Logo and whose collection it is. */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- rendered by the image generator */}
            <img src={logoSrc} width={226} height={65} alt="" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <span style={{ display: 'block', fontSize: 32, maxWidth: 360, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{name}</span>
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element -- rendered by the image generator
                <img src={avatar} width={76} height={76} style={{ width: 76, height: 76, borderRadius: 38, objectFit: 'cover', border: '3px solid #FC5200' }} alt="" />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 76, height: 76, borderRadius: 38, background: '#FC5200', fontSize: 28 }}>{nameInitials(name, 2)}</div>
              )}
            </div>
          </div>

          {/* The count. */}
          <div style={{ display: 'flex', marginTop: 64, fontSize: 32, letterSpacing: 5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.66)' }}>{t.kicker}</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 26, marginTop: 26 }}>
            <span style={{ fontFamily: 'Oswald', fontSize: 240, lineHeight: 0.9 }}>{fish.length}</span>
            <span style={{ display: 'flex', paddingBottom: 22, fontFamily: 'Oswald', fontSize: 64, color: '#FFB27A' }}>{t.of(total)}</span>
          </div>
          <div style={{ display: 'flex', width: '100%', height: 24, marginTop: 26, borderRadius: 12, background: 'rgba(255,255,255,0.14)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', width: `${Math.max(3, pct * 100)}%`, height: 24, gap: 4 }}>
              {byCategory.map(([c, n]) => (
                <div key={c} style={{ display: 'flex', flexGrow: n, height: 24, borderRadius: 12, background: CATEGORY_COLOR[c] ?? '#3FB4DB' }} />
              ))}
            </div>
          </div>

          {/* The fish caught most, big. */}
          {favourite && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 24 }}>
              {favArt ? (
                // eslint-disable-next-line @next/next/no-img-element -- rendered by the image generator
                <img src={favArt} width={600} height={428} style={{ width: 600, height: 428, objectFit: 'contain' }} alt="" />
              ) : (
                <div style={{ display: 'flex', width: 600, height: 428 }} />
              )}
              <span style={{ display: 'flex', marginTop: -16, fontSize: 28, letterSpacing: 4, textTransform: 'uppercase', color: 'rgba(255,255,255,0.66)' }}>{t.favourite}</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 20, marginTop: 6 }}>
                <span style={{ fontFamily: 'Oswald', fontSize: favSize, textTransform: 'uppercase', lineHeight: 1 }}>{favName}</span>
                <span style={{ fontFamily: 'Oswald', fontSize: 56, color: '#FFB27A' }}>×{favourite.count}</span>
              </div>
            </div>
          )}

          {/* The next fish, small. */}
          {shown.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, marginTop: 36 }}>
              {shown.map((f, i) => (
                <div key={f.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 300, height: 180, padding: '12px 14px 12px', borderRadius: 28, background: 'rgba(255,255,255,0.08)', border: '2px solid rgba(255,255,255,0.10)' }}>
                  {smallArt[i] ? (
                    // eslint-disable-next-line @next/next/no-img-element -- rendered by the image generator
                    <img src={smallArt[i]!} width={210} height={118} style={{ width: 210, height: 118, objectFit: 'contain' }} alt="" />
                  ) : (
                    <div style={{ display: 'flex', width: 210, height: 118 }} />
                  )}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4, maxWidth: 276 }}>
                    <span style={{ display: 'block', fontSize: 25, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: 212 }}>{f.name}</span>
                    <span style={{ fontSize: 25, color: '#FFB27A' }}>×{f.count}</span>
                  </div>
                </div>
              ))}
              {more > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 300, height: 180, borderRadius: 28, border: '2px dashed rgba(255,255,255,0.25)', fontFamily: 'Oswald', fontSize: 84, color: 'rgba(255,255,255,0.85)' }}>
                  {t.more(more)}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', flex: 1 }} />

          {/* Three numbers: the same 300-wide cells and 18 gaps as the fish above, so the columns line up. */}
          <div style={{ display: 'flex', gap: 18, marginTop: 18 }}>
            {[
              [t.catches, String(totalCatches), null],
              [t.record, record?.bestLen ? `${record.bestLen} ${cm}` : '—', record?.name ?? null],
              [t.newest, newest?.name ?? '—', null],
            ].map(([label, value, sub], i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', width: 300, height: 180, flex: '0 0 auto', padding: '22px 24px', borderRadius: 28, background: 'rgba(255,255,255,0.08)', border: '2px solid rgba(255,255,255,0.10)' }}>
                <span style={{ fontSize: 22, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>{label}</span>
                {/* The newest fish is a name, not a number: up to two lines. */}
                <span style={{ display: 'block', marginTop: 6, fontFamily: i === 2 ? bodyFont : 'Oswald', fontSize: i === 2 ? 32 : 54, lineHeight: i === 2 ? 1.2 : 1.1, overflow: 'hidden', maxWidth: 248, maxHeight: i === 2 ? 78 : 60, ...(i === 2 ? {} : { whiteSpace: 'nowrap', textOverflow: 'ellipsis' }) }}>{value}</span>
                {sub && <span style={{ display: 'block', marginTop: 4, fontSize: 24, color: 'rgba(255,255,255,0.7)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: 248 }}>{sub}</span>}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 40 }}>
            <span style={{ fontSize: 40 }}>{t.dare}</span>
            <span style={{ fontSize: 26, color: 'rgba(255,255,255,0.45)' }}>catchrange.com</span>
          </div>
        </div>
      ),
      {
        width: W,
        height: H,
        fonts,
        // The collection grows with every new fish: kept a short while only.
        headers: { 'Cache-Control': 'public, max-age=300, s-maxage=600' },
      }
    )
  } catch (e) {
    console.error('species story image failed', e)
    return new Response('failed to draw the story', { status: 500 })
  }
}
