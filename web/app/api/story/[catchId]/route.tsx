import { ImageResponse } from 'next/og'
import { createAdminClient } from '@/lib/supabase/admin'

// «Улов в истории Telegram»: a 1080×1920 card the server draws for one
// catch — the photo as its own framed card with nothing laid over it (the
// fish used to disappear under the species name and the sector badge), and
// under it species and size, the sector as a hex badge, who caught it, and a
// dare. Telegram's shareToStory needs
// a public https image, so this is a plain GET; catches are public anyway.
// ?lang=ru|en|ka picks the dare's language (and a Georgian-capable font).

const W = 1080
const H = 1920
// The photo card: full width less the margins, a little taller than square —
// a phone's portrait shot loses only a sliver top and bottom.
const PHOTO_X = 56
const PHOTO_Y = 196
const PHOTO_W = W - PHOTO_X * 2
const PHOTO_H = 1170

const DARE: Record<string, string> = {
  ru: 'Сможешь поймать больше?',
  en: 'Can you beat it?',
  ka: 'შეძლებ მეტის დაჭერას?',
}
const CITY: Record<string, Record<string, string>> = {
  ru: { B: 'Батуми', M: 'Москва' },
  en: { B: 'Batumi', M: 'Moscow' },
  ka: { B: 'ბათუმი', M: 'მოსკოვი' },
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
      // The renderer is safer with a plain fill than with the file's CSS class.
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
    const type = res.headers.get('content-type') ?? 'image/jpeg'
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`
  } catch {
    return null
  }
}

// A Supabase public object, resized and cropped to the photo card.
function storyPhotoUrl(url: string): string {
  const marker = '/storage/v1/object/public/'
  const i = url.indexOf(marker)
  if (i === -1) return url
  return `${url.slice(0, i)}/storage/v1/render/image/public/${url.slice(i + marker.length).split('?')[0]}?width=${PHOTO_W}&height=${PHOTO_H}&resize=cover&quality=82`
}

// 0,25 кг stays 0,25 — one digit made it 0,3.
const fmtNum = (n: number, lang: string) => new Intl.NumberFormat(lang, { maximumFractionDigits: n < 1 ? 2 : 1 }).format(n)

export async function GET(request: Request, { params }: { params: Promise<{ catchId: string }> }) {
  const { catchId } = await params
  const id = Number(catchId)
  if (!Number.isInteger(id) || id <= 0) return new Response('bad catch id', { status: 400 })
  const url = new URL(request.url)
  const lang = ['ru', 'en', 'ka'].includes(url.searchParams.get('lang') ?? '') ? url.searchParams.get('lang')! : 'ru'

  const admin = createAdminClient()
  const { data: c } = await admin.from('catches').select('id, species, length_cm, weight_kg, photo_url, territory_id, user_id, caught_at').eq('id', id).maybeSingle()
  if (!c) return new Response('not found', { status: 404 })
  const [{ data: sp }, { data: p }] = await Promise.all([
    admin.from('species').select('name').eq('key', c.species).maybeSingle(),
    admin.from('profiles').select('display_name, avatar_url').eq('id', c.user_id).maybeSingle(),
  ])

  try {
    const [photo, avatar, logoSrc, display, body, georgian] = await Promise.all([
      dataUrl(storyPhotoUrl(c.photo_url)),
      dataUrl(p?.avatar_url ?? null),
      logo(url.origin),
      googleFont('Oswald', 700),
      googleFont('Manrope', 800),
      lang === 'ka' ? googleFont('Noto Sans Georgian', 800) : Promise.resolve(null),
    ])
    const size = [c.length_cm ? `${c.length_cm} ${lang === 'en' ? 'cm' : lang === 'ka' ? 'სმ' : 'см'}` : null, c.weight_kg ? `${fmtNum(Number(c.weight_kg), lang)} ${lang === 'en' ? 'kg' : lang === 'ka' ? 'კგ' : 'кг'}` : null]
      .filter(Boolean)
      .join(' · ')
    const name = p?.display_name ?? 'RANGE'
    // A long name («Каменный окунь») steps the type down so it stays on one
    // line beside the size.
    const speciesName = sp?.name ?? c.species
    const speciesSize = speciesName.length > 12 ? 84 : speciesName.length > 8 ? 100 : 116
    const prefix = c.territory_id.slice(0, 1)
    const caughtOn = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', timeZone: prefix === 'M' ? 'Europe/Moscow' : 'Asia/Tbilisi' }).format(new Date(c.caught_at))
    const fonts = [
      { name: 'Oswald', data: display, weight: 700 as const, style: 'normal' as const },
      { name: 'Manrope', data: body, weight: 800 as const, style: 'normal' as const },
      ...(georgian ? [{ name: 'Noto Sans Georgian', data: georgian, weight: 800 as const, style: 'normal' as const }] : []),
    ]
    const bodyFont = georgian ? 'Manrope, "Noto Sans Georgian"' : 'Manrope'

    return new ImageResponse(
      (
        <div style={{ width: W, height: H, display: 'flex', position: 'relative', background: 'linear-gradient(180deg, #10242C 0%, #0A161B 55%, #071014 100%)', fontFamily: bodyFont }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- rendered by the image generator */}
          <img src={logoSrc} width={226} height={65} style={{ position: 'absolute', top: 92, left: 64 }} alt="" />

          <div
            style={{
              position: 'absolute',
              left: PHOTO_X,
              top: PHOTO_Y,
              width: PHOTO_W,
              height: PHOTO_H,
              display: 'flex',
              borderRadius: 44,
              overflow: 'hidden',
              background: '#1A2C33',
              boxShadow: '0 30px 80px rgba(0,0,0,.45)',
            }}
          >
            {photo && (
              // eslint-disable-next-line @next/next/no-img-element -- rendered by the image generator, not a page
              <img src={photo} width={PHOTO_W} height={PHOTO_H} style={{ width: PHOTO_W, height: PHOTO_H, objectFit: 'cover' }} alt="" />
            )}
          </div>

          <div style={{ position: 'absolute', left: 72, right: 72, top: PHOTO_Y + PHOTO_H + 44, display: 'flex', flexDirection: 'column' }}>
            {/* Species and size share a line; a name too long for both puts
                the size on the next one. */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', columnGap: 24, rowGap: 14 }}>
              <div style={{ display: 'flex', color: '#fff', fontFamily: 'Oswald', fontSize: speciesSize, lineHeight: 1, textTransform: 'uppercase', letterSpacing: 1 }}>
                {speciesName}
              </div>
              {size && <div style={{ display: 'flex', flex: '0 0 auto', color: '#FFB27A', fontFamily: 'Oswald', fontSize: 58, lineHeight: 1, paddingBottom: 4 }}>{size}</div>}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', marginTop: 40, gap: 20 }}>
              {/* Flat top and bottom, corners left and right — the map's own sector hexes. */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', width: 112, height: 97, flex: '0 0 auto' }}>
                <svg width={112} height={97} viewBox="0 0 176 152" style={{ position: 'absolute', top: 0, left: 0 }}>
                  <polygon points="46,4 130,4 172,76 130,148 46,148 4,76" fill="#FC5200" stroke="#FFB27A" strokeWidth={5} strokeLinejoin="round" />
                </svg>
                <span style={{ color: '#fff', fontFamily: 'Oswald', fontSize: 24 }}>{c.territory_id}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', color: '#fff', fontSize: 32, flex: '0 0 auto' }}>
                <span>{CITY[lang][prefix] ?? ''}</span>
                <span style={{ color: 'rgba(255,255,255,.55)', fontSize: 26 }}>{caughtOn}</span>
              </div>
              <div style={{ display: 'flex', flex: '1 1 auto' }} />
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element -- rendered by the image generator
                <img src={avatar} width={72} height={72} style={{ width: 72, height: 72, borderRadius: 36, objectFit: 'cover', border: '3px solid #FC5200', flex: '0 0 auto' }} alt="" />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 72, height: 72, borderRadius: 36, background: '#FC5200', color: '#fff', fontSize: 28, flex: '0 0 auto' }}>
                  {name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <span style={{ display: 'block', color: '#fff', fontSize: 34, maxWidth: 300, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{name}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 46 }}>
              <span style={{ color: '#fff', fontSize: 40 }}>{DARE[lang]}</span>
              <span style={{ color: 'rgba(255,255,255,.45)', fontSize: 26 }}>catchrange.com</span>
            </div>
          </div>
        </div>
      ),
      {
        width: W,
        height: H,
        fonts,
        headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' },
      }
    )
  } catch (e) {
    console.error('story image failed', e)
    return new Response('failed to draw the story', { status: 500 })
  }
}
