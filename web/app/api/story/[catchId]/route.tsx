import { ImageResponse } from 'next/og'
import { createAdminClient } from '@/lib/supabase/admin'

// «Улов в истории Telegram»: a 1080×1920 card the server draws for one
// catch — the photo full-bleed, species and size big, the sector as a hex
// badge, who caught it, the logo, and a dare. Telegram's shareToStory needs
// a public https image, so this is a plain GET; catches are public anyway.
// ?lang=ru|en|ka picks the dare's language (and a Georgian-capable font).

const W = 1080
const H = 1920

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

// A Supabase public object, resized and cropped to the story's 9:16.
function storyPhotoUrl(url: string): string {
  const marker = '/storage/v1/object/public/'
  const i = url.indexOf(marker)
  if (i === -1) return url
  return `${url.slice(0, i)}/storage/v1/render/image/public/${url.slice(i + marker.length).split('?')[0]}?width=${W}&height=${H}&resize=cover&quality=80`
}

const fmtNum = (n: number, lang: string) => new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(n)

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
        <div style={{ width: W, height: H, display: 'flex', position: 'relative', background: '#0B1A20', fontFamily: bodyFont }}>
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element -- rendered by the image generator, not a page
            <img src={photo} width={W} height={H} style={{ position: 'absolute', inset: 0, width: W, height: H, objectFit: 'cover' }} alt="" />
          )}
          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 360, display: 'flex', background: 'linear-gradient(rgba(5,12,16,.72), rgba(5,12,16,0))' }} />
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 1100, display: 'flex', background: 'linear-gradient(rgba(5,12,16,0), rgba(5,12,16,.55) 35%, rgba(5,12,16,.94))' }} />

          {/* eslint-disable-next-line @next/next/no-img-element -- rendered by the image generator */}
          <img src={logoSrc} width={300} height={86} style={{ position: 'absolute', top: 96, left: 80 }} alt="" />

          <div style={{ position: 'absolute', left: 80, right: 80, bottom: 150, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
              {/* Flat top and bottom, corners left and right — the map's own sector hexes. */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', width: 176, height: 152 }}>
                <svg width={176} height={152} viewBox="0 0 176 152" style={{ position: 'absolute', top: 0, left: 0 }}>
                  <polygon points="46,4 130,4 172,76 130,148 46,148 4,76" fill="#FC5200" stroke="#FFB27A" strokeWidth={4} strokeLinejoin="round" />
                </svg>
                <span style={{ color: '#fff', fontFamily: 'Oswald', fontSize: 34 }}>{c.territory_id}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', color: '#fff', fontSize: 38 }}>
                <span>{CITY[lang][prefix] ?? ''}</span>
                <span style={{ color: 'rgba(255,255,255,.6)', fontSize: 30 }}>{caughtOn}</span>
              </div>
            </div>

            <div style={{ display: 'flex', marginTop: 40, color: '#fff', fontFamily: 'Oswald', fontSize: 150, lineHeight: 1, textTransform: 'uppercase', letterSpacing: 1 }}>
              {sp?.name ?? c.species}
            </div>
            {size && <div style={{ display: 'flex', marginTop: 18, color: '#FFB27A', fontFamily: 'Oswald', fontSize: 84 }}>{size}</div>}

            <div style={{ display: 'flex', alignItems: 'center', gap: 22, marginTop: 56 }}>
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element -- rendered by the image generator
                <img src={avatar} width={96} height={96} style={{ width: 96, height: 96, borderRadius: 48, objectFit: 'cover', border: '4px solid #FC5200' }} alt="" />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 96, height: 96, borderRadius: 48, background: '#FC5200', color: '#fff', fontSize: 38 }}>
                  {name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <span style={{ color: '#fff', fontSize: 44 }}>{name}</span>
            </div>

            <div style={{ display: 'flex', marginTop: 60, color: '#fff', fontSize: 52 }}>{DARE[lang]}</div>
            <div style={{ display: 'flex', marginTop: 14, color: 'rgba(255,255,255,.5)', fontSize: 32 }}>catchrange.com</div>
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
