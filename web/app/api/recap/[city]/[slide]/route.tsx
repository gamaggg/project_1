import { ImageResponse } from 'next/og'
import { createAdminClient } from '@/lib/supabase/admin'
import { RecapSlide, SLIDE_H, SLIDE_W, slideImages } from '@/components/recap/RecapSlide'
import { mapRecap, recapSlides, sizedPhoto, type SlideId } from '@/lib/recap'
import { isLang, translate, type Lang, type TKey, type TVars } from '@/lib/i18n/core'
import type { CityId } from '@/lib/data/city'

// One slide of «Неделя в городе» as a 1080×1920 image — what «Поделиться»
// sends to a Telegram story or the phone's gallery. The same RecapSlide the
// app plays, drawn with numbers at their final values and the site's
// address at the bottom. ?u=<user id> fills in the personal slide (those
// numbers are on the public weekly rating anyway).

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

async function dataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return `data:${res.headers.get('content-type') ?? 'image/jpeg'};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`
  } catch {
    return null
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ city: string; slide: string }> }) {
  const { city: cityParam, slide } = await params
  const url = new URL(request.url)
  const city: CityId = cityParam === 'moscow' ? 'moscow' : 'batumi'
  const langParam = url.searchParams.get('lang')
  const lang: Lang = isLang(langParam) ? langParam : 'ru'
  const user = url.searchParams.get('u')
  const uid = user && /^[0-9a-f-]{36}$/i.test(user) ? user : undefined

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('get_city_week_recap', { p_city: city, p_week_offset: 1, ...(uid ? { p_user: uid } : {}) })
  if (error || !data) return new Response('recap unavailable', { status: 502 })
  const recap = mapRecap(data as Parameters<typeof mapRecap>[0])
  const slides = recapSlides(recap)
  if (!slides.includes(slide as SlideId)) return new Response('no such slide', { status: 404 })
  const id = slide as SlideId

  try {
    const wanted = slideImages(id, recap)
    const [display, body, georgian, logoSvg, ...images] = await Promise.all([
      googleFont('Oswald', 700),
      googleFont('Manrope', 800),
      lang === 'ka' ? googleFont('Noto Sans Georgian', 800) : Promise.resolve(null),
      fetch(`${url.origin}/brand/logo_2.svg`).then((r) => r.text()).catch(() => null),
      ...wanted.map((w) => dataUrl(sizedPhoto(w.url, w.w, w.h))),
    ])
    const byKey = new Map(wanted.map((w, i) => [`${w.url}|${w.w}x${w.h}`, images[i]]))
    // The wordmark in white on the coloured slides.
    const logo = logoSvg ? `data:image/svg+xml;base64,${Buffer.from(logoSvg.replace(/class="cls-1"/g, 'fill="#FFFFFF"')).toString('base64')}` : null
    const t = (key: TKey, vars?: TVars) => translate(lang, key, vars)

    return new ImageResponse(
      (
        <RecapSlide
          id={id}
          env={{
            data: recap,
            city,
            lang,
            t,
            anim: 1,
            img: (u, w, h) => byKey.get(`${u}|${w}x${h}`) ?? null,
            logo,
            fonts: { display: 'Oswald', body: georgian ? 'Manrope, "Noto Sans Georgian"' : 'Manrope' },
            branded: true,
          }}
        />
      ),
      {
        width: SLIDE_W,
        height: SLIDE_H,
        fonts: [
          { name: 'Oswald', data: display, weight: 700, style: 'normal' },
          { name: 'Manrope', data: body, weight: 800, style: 'normal' },
          ...(georgian ? [{ name: 'Noto Sans Georgian', data: georgian, weight: 800 as const, style: 'normal' as const }] : []),
        ],
        headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=21600' },
      }
    )
  } catch (e) {
    console.error('recap slide failed', e)
    return new Response('failed to draw the slide', { status: 500 })
  }
}
