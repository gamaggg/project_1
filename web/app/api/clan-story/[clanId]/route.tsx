import { ImageResponse } from 'next/og'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { clanStoryColors, crestSvgMarkup, shadeHex } from '@/lib/data/clanCrests'
import { clanLevel, leagueFor } from '@/lib/data/clanLevels'
import { speciesImageUrl } from '@/lib/data/speciesImages'
import { translate, type Lang } from '@/lib/i18n/core'
import { ru } from '@/lib/i18n/ru'
import type { CityId } from '@/lib/data/city'

// «Зал славы» → «Поделиться в истории»: a 1080×1920 card of a clan, drawn by
// the server like the catch and the species stories: deep water in shades
// of the crest's colour with a light tone of it glowing behind the crest,
// the crest, name, level and league, the
// headquarters, the members, the clan's three record fish with their
// drawings and who caught them, and a call to join. The records are counted
// as in the hall of fame (lib/clan2/live/real.ts): the members' catches on
// sectors of the clan's city, the longest fish of each species (then the
// heaviest, then the first caught). Public data; a plain GET for Telegram's
// shareToStory. ?lang=ru|en|ka.

const W = 1080
const H = 1920
const PREFIX: Record<CityId, string> = { batumi: 'B', moscow: 'M', spb: 'P', sochi: 'S', tbilisi: 'T', kazan: 'K', nnov: 'N', varna: 'V', anapa: 'A', kyiv: 'Y', odesa: 'O', yerevan: 'E' }

const T: Record<Lang, { clan: string; city: Record<string, string>; level: (n: number) => string; league: (s: string) => string; hq: (id: string) => string; noHq: string; members: (n: number) => string; records: string; join: string; cm: string; kg: string }> = {
  ru: {
    clan: 'Клан',
    city: { batumi: 'Батуми', moscow: 'Москва и МО', spb: 'Санкт-Петербург', sochi: 'Сочи/Адлер', tbilisi: 'Тбилиси', kazan: 'Казань', nnov: 'Нижний Новгород', varna: 'Варна/Бургас', anapa: 'Анапа', kyiv: 'Киев', odesa: 'Одесса', yerevan: 'Ереван/Севан' },
    level: (n) => `Уровень ${n}`,
    league: (s) => `Лига: ${s}`,
    hq: (id) => `Штаб: ${id}`,
    noHq: 'Штаб не поставлен',
    members: (n) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'рыбак' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'рыбака' : 'рыбаков'}`,
    records: 'Рекорды клана',
    join: 'Вступай в наш клан!',
    cm: 'см',
    kg: 'кг',
  },
  en: {
    clan: 'Clan',
    city: { batumi: 'Batumi', moscow: 'Moscow & MO', spb: 'Saint Petersburg', sochi: 'Sochi/Adler', tbilisi: 'Tbilisi', kazan: 'Kazan', nnov: 'Nizhny Novgorod', varna: 'Varna/Burgas', anapa: 'Anapa', kyiv: 'Kyiv', odesa: 'Odesa', yerevan: 'Yerevan/Sevan' },
    level: (n) => `Level ${n}`,
    league: (s) => `League: ${s}`,
    hq: (id) => `HQ: ${id}`,
    noHq: 'No HQ yet',
    members: (n) => `${n} ${n === 1 ? 'angler' : 'anglers'}`,
    records: 'Clan records',
    join: 'Join our clan!',
    cm: 'cm',
    kg: 'kg',
  },
  ka: {
    clan: 'კლანი',
    city: { batumi: 'ბათუმი', moscow: 'მოსკოვი და მოსკოვის ოლქი', spb: 'სანქტ-პეტერბურგი', sochi: 'სოჭი/ადლერი', tbilisi: 'თბილისი', kazan: 'ყაზანი', nnov: 'ნიჟნი ნოვგოროდი', varna: 'ვარნა/ბურგასი', anapa: 'ანაპა', kyiv: 'კიევი', odesa: 'ოდესა', yerevan: 'ერევანი/სევანი' },
    level: (n) => `დონე ${n}`,
    league: (s) => `ლიგა: ${s}`,
    hq: (id) => `შტაბი: ${id}`,
    noHq: 'შტაბი ჯერ არ არის',
    members: (n) => `${n} მეთევზე`,
    records: 'კლანის რეკორდები',
    join: 'შემოგვიერთდი კლანში!',
    cm: 'სმ',
    kg: 'კგ',
  },
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

// The crest as a still SVG picture (the same markup as the map's crest labels).
function crestDataUrl(crest: unknown, size: number): string {
  const svg = crestSvgMarkup(crest, size).replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

type Rec = { species: string; cm: number | null; kg: number | null; userId: string }

export async function GET(request: Request, { params }: { params: Promise<{ clanId: string }> }) {
  const { clanId } = await params
  const id = Number(clanId)
  if (!Number.isInteger(id) || id <= 0) return new Response('bad clan id', { status: 400 })
  const url = new URL(request.url)
  const lang = (['ru', 'en', 'ka'].includes(url.searchParams.get('lang') ?? '') ? url.searchParams.get('lang') : 'ru') as Lang
  const t = T[lang]

  // The generated database types don't list the clan tables: read them untyped.
  const admin = createAdminClient() as unknown as SupabaseClient
  type ClanRow = { id: number; name: string; city: string; crest: unknown; background: string | null; xp: number | null; trophies: number | null; disbanded_at: string | null }
  const { data: clan } = (await admin.from('clans').select('id, name, city, crest, background, xp, trophies, disbanded_at').eq('id', id).maybeSingle()) as { data: ClanRow | null }
  if (!clan || clan.disbanded_at) return new Response('not found', { status: 404 })
  const city = clan.city as CityId
  const [{ data: members }, { data: hq }, { data: species }] = (await Promise.all([
    admin.from('clan_members').select('user_id').eq('clan_id', id),
    admin.from('clan_hq').select('territory_id').eq('clan_id', id).maybeSingle(),
    admin.from('species').select('key, name'),
  ])) as [{ data: { user_id: string }[] | null }, { data: { territory_id: string } | null }, { data: { key: string; name: string }[] | null }]
  const memberIds = (members ?? []).map((m) => m.user_id as string)
  type CatchRow = { species: string; length_cm: number | null; weight_kg: number | null; user_id: string }
  const { data: top } = (memberIds.length
    ? await admin
        .from('catches')
        .select('species, length_cm, weight_kg, user_id, caught_at')
        .in('user_id', memberIds)
        .like('territory_id', `${PREFIX[city] ?? 'B'}%`)
        .order('length_cm', { ascending: false, nullsFirst: false })
        .order('weight_kg', { ascending: false, nullsFirst: false })
        .order('caught_at', { ascending: true })
        .limit(3000)
    : { data: [] }) as { data: CatchRow[] | null }
  const best = new Map<string, Rec>()
  for (const c of top ?? []) {
    if (!best.has(c.species)) best.set(c.species, { species: c.species, cm: c.length_cm, kg: c.weight_kg != null ? Number(c.weight_kg) : null, userId: c.user_id })
  }
  // The card's three: the longest records, the weight breaking a tie (as the hall of fame orders them).
  const records = [...best.values()].sort((a, b) => (b.cm ?? -1) - (a.cm ?? -1) || (b.kg ?? -1) - (a.kg ?? -1)).slice(0, 3)
  const { data: catchers } = (records.length ? await admin.from('profiles').select('id, display_name').in('id', records.map((r) => r.userId)) : { data: [] }) as { data: { id: string; display_name: string | null }[] | null }
  const nameOf = (uid: string) => catchers?.find((p) => p.id === uid)?.display_name ?? ''
  const speciesName = (key: string) => {
    const row = species?.find((s) => s.key === key)
    return lang !== 'ru' && key in ru.species ? translate(lang, `species.${key}` as never) : row?.name ?? key
  }

  // Background and glow in the crest's own colour (owner's call, 20.11.2026).
  const { tone, water, glowRgb } = clanStoryColors(clan.crest)
  const ink = '255,255,255'
  const level = clanLevel(clan.xp ?? 0)
  const league = leagueFor(clan.trophies ?? 0)
  const leagueLabel = translate(lang, `league.${league.id}` as never)
  const size = (r: Rec) => (r.cm ? `${r.cm} ${t.cm}` : r.kg ? `${new Intl.NumberFormat(lang, { maximumFractionDigits: 2 }).format(r.kg)} ${t.kg}` : '')

  try {
    const art = (key: string) => {
      const u = speciesImageUrl(key)
      return dataUrl(u ? `${url.origin}${u.replace(/^\/fish\/(.+)\.webp$/, '/fish/story/$1.png')}` : null)
    }
    const [logoSrc, fishArt, display, body, georgian] = await Promise.all([
      logo(url.origin),
      Promise.all(records.map((r) => art(r.species))),
      googleFont('Oswald', 700),
      googleFont('Manrope', 800),
      lang === 'ka' ? googleFont('Noto Sans Georgian', 800) : Promise.resolve(null),
    ])
    const crest = crestDataUrl(clan.crest, 360)
    const fonts = [
      { name: 'Oswald', data: display, weight: 700 as const, style: 'normal' as const },
      { name: 'Manrope', data: body, weight: 800 as const, style: 'normal' as const },
      ...(georgian ? [{ name: 'Noto Sans Georgian', data: georgian, weight: 800 as const, style: 'normal' as const }] : []),
    ]
    const bodyFont = georgian ? 'Manrope, "Noto Sans Georgian"' : 'Manrope'
    const nameSize = clan.name.length > 14 ? 96 : clan.name.length > 9 ? 120 : 150
    const glow = `radial-gradient(70% 38% at 50% 26%, rgba(${glowRgb},0.5), rgba(${glowRgb},0) 70%)`

    return new ImageResponse(
      (
        <div
          style={{
            width: W,
            height: H,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '92px 72px 84px',
            fontFamily: bodyFont,
            color: `rgb(${ink})`,
            background: `${glow}, ${water}`,
          }}
        >
          {/* Logo and the clan's city. */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- rendered by the image generator */}
            <img src={logoSrc} width={226} height={65} alt="" />
            <span style={{ display: 'flex', padding: '12px 24px', borderRadius: 999, background: `rgba(${ink},0.12)`, fontSize: 28 }}>
              {t.clan} · {t.city[city] ?? city}
            </span>
          </div>

          {crest && (
            // eslint-disable-next-line @next/next/no-img-element -- rendered by the image generator
            <img src={crest} width={360} height={360} style={{ width: 360, height: 360, marginTop: 80 }} alt="" />
          )}
          <div style={{ display: 'flex', marginTop: 30, fontFamily: 'Oswald', fontSize: nameSize, lineHeight: 1, textTransform: 'uppercase', letterSpacing: 2 }}>{clan.name}</div>
          <div style={{ display: 'flex', marginTop: 26, fontSize: 36, color: `rgba(${ink},0.85)` }}>
            {t.level(level)} · {t.league(leagueLabel)}
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 22 }}>
            <span style={{ display: 'flex', padding: '10px 22px', borderRadius: 999, background: `rgba(${ink},0.12)`, fontSize: 28 }}>{hq?.territory_id ? t.hq(hq.territory_id) : t.noHq}</span>
            <span style={{ display: 'flex', padding: '10px 22px', borderRadius: 999, background: `rgba(${ink},0.12)`, fontSize: 28 }}>{t.members(memberIds.length)}</span>
          </div>

          {/* The three record fish. */}
          <div style={{ display: 'flex', flex: 1 }} />
          {records.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ display: 'flex', fontSize: 28, letterSpacing: 5, textTransform: 'uppercase', color: `rgba(${ink},0.66)` }}>{t.records}</div>
              <div style={{ display: 'flex', gap: 18, marginTop: 22 }}>
                {records.map((r, i) => (
                  <div key={r.species} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 300, height: 330, padding: '18px 16px 16px', borderRadius: 30, background: `rgba(${ink},0.09)`, border: `2px solid rgba(${ink},0.12)` }}>
                    {fishArt[i] ? (
                      // eslint-disable-next-line @next/next/no-img-element -- rendered by the image generator
                      <img src={fishArt[i]!} width={240} height={150} style={{ width: 240, height: 150, objectFit: 'contain' }} alt="" />
                    ) : (
                      <div style={{ display: 'flex', width: 240, height: 150 }} />
                    )}
                    <span style={{ display: 'block', marginTop: 8, fontSize: 28, maxWidth: 268, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{speciesName(r.species)}</span>
                    <span style={{ display: 'flex', marginTop: 4, fontFamily: 'Oswald', fontSize: 52, lineHeight: 1.1, color: '#FFB27A' }}>{size(r)}</span>
                    <span style={{ display: 'block', marginTop: 4, fontSize: 22, color: `rgba(${ink},0.62)`, maxWidth: 268, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{nameOf(r.userId)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flex: 1 }} />

          {/* The call to join: white, its words in a deep shade of the crest's colour — orange would vanish on an orange or red clan. */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '30px 0', borderRadius: 34, background: '#fff', color: shadeHex(tone, -0.55), fontSize: 44, boxShadow: '0 14px 30px rgba(0,0,0,0.3)' }}>{t.join}</div>
          <div style={{ display: 'flex', marginTop: 24, fontSize: 28, color: `rgba(${ink},0.55)` }}>catchrange.com · @catchrangebot</div>
        </div>
      ),
      {
        width: W,
        height: H,
        fonts,
        headers: { 'Cache-Control': 'public, max-age=300, s-maxage=600' },
      }
    )
  } catch (e) {
    console.error('clan story image failed', e)
    return new Response('failed to draw the story', { status: 500 })
  }
}
