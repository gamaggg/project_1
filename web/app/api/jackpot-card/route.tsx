import { ImageResponse } from 'next/og'
import { createAdminClient } from '@/lib/supabase/admin'
import { isLang, translate, type Lang, type TKey, type TVars } from '@/lib/i18n/core'

// The slots jackpot as a 1080×1920 card — what «В историю» and «Скачать» on
// the jackpot screen send out: the night sea with gold rays and coins,
// «ДЖЕКПОТ!», the three jackpot fish, the prize, and who won it.
// ?city=batumi|moscow &prize=frame|coins &coins=N &u=<user id> &lang=ru|en|ka

const W = 1080
const H = 1920

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
    return `data:${res.headers.get('content-type') ?? 'image/png'};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`
  } catch {
    return null
  }
}

// Gold rays fanning out from behind the title, fading towards the edges.
function raysSvg() {
  const cx = W / 2
  const cy = 760
  const r = 1500
  const wedges = Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2
    const b = a + (Math.PI * 2) / 24 / 2.4
    return `<path d="M${cx} ${cy} L${cx + Math.cos(a) * r} ${cy + Math.sin(a) * r} L${cx + Math.cos(b) * r} ${cy + Math.sin(b) * r} Z" fill="url(#g)"/>`
  }).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs><radialGradient id="g" cx="${cx}" cy="${cy}" r="900" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFD86B" stop-opacity=".42"/><stop offset=".6" stop-color="#FFD86B" stop-opacity=".1"/><stop offset="1" stop-color="#FFD86B" stop-opacity="0"/></radialGradient></defs>${wedges}</svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

// Coins scattered round the card: x, y, size, rotation.
const COINS: [number, number, number, number][] = [
  [90, 330, 110, -18],
  [880, 280, 140, 22],
  [960, 640, 90, -30],
  [40, 900, 130, 34],
  [930, 1180, 120, -12],
  [70, 1420, 96, 16],
  [860, 1560, 130, 40],
  [180, 1700, 84, -26],
]

export async function GET(request: Request) {
  const url = new URL(request.url)
  const city = url.searchParams.get('city') === 'moscow' ? 'moscow' : 'batumi'
  const prize = url.searchParams.get('prize') === 'coins' ? 'coins' : 'frame'
  const coins = Math.max(0, Math.min(100000, Number(url.searchParams.get('coins')) || 0))
  const langParam = url.searchParams.get('lang')
  const lang: Lang = isLang(langParam) ? langParam : 'ru'
  const t = (key: TKey, vars?: TVars) => translate(lang, key, vars)
  const uid = url.searchParams.get('u')

  let name: string | null = null
  let avatarUrl: string | null = null
  if (uid && /^[0-9a-f-]{36}$/i.test(uid)) {
    const { data } = await createAdminClient().from('profiles').select('display_name, avatar_url').eq('id', uid).maybeSingle()
    name = data?.display_name ?? null
    avatarUrl = data?.avatar_url ?? null
  }

  try {
    const [display, body, georgian, logoSvg, coin, fish, avatar] = await Promise.all([
      googleFont('Oswald', 700),
      googleFont('Manrope', 800),
      lang === 'ka' ? googleFont('Noto Sans Georgian', 800) : Promise.resolve(null),
      fetch(`${url.origin}/brand/logo_2.svg`).then((r) => r.text()).catch(() => null),
      dataUrl(`${url.origin}/brand/coin.svg`),
      dataUrl(`${url.origin}/slots/png/${city === 'moscow' ? 'som' : 'katran'}.png`),
      avatarUrl ? dataUrl(avatarUrl) : Promise.resolve(null),
    ])
    const logo = logoSvg ? `data:image/svg+xml;base64,${Buffer.from(logoSvg.replace(/class="cls-1"/g, 'fill="#FFFFFF"')).toString('base64')}` : null
    const prizeText = prize === 'frame' ? t(city === 'moscow' ? 'slots.moscow.rewards.jackpot' : 'slots.rewards.jackpot') : `+${t('common.coins', { count: coins })}`

    return new ImageResponse(
      (
        <div
          style={{
            width: W,
            height: H,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative',
            background: 'radial-gradient(circle at 50% 40%, #6B4206 0%, #2A1A08 30%, #0E2A44 62%, #07182A 100%)',
            fontFamily: 'Manrope',
            color: '#fff',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img> */}
          <img src={raysSvg()} width={W} height={H} style={{ position: 'absolute', left: 0, top: 0 }} alt="" />
          {coin &&
            COINS.map(([x, y, size, rot], i) => (
              // eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img>
              <img key={i} src={coin} width={size} height={size} style={{ position: 'absolute', left: x, top: y, transform: `rotate(${rot}deg)` }} alt="" />
            ))}

          {logo && (
            // eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img>
            <img src={logo} height={70} style={{ marginTop: 150 }} alt="RANGE" />
          )}

          <div
            style={{
              display: 'flex',
              marginTop: logo ? 190 : 330,
              fontFamily: 'Oswald',
              fontSize: 210,
              lineHeight: 1,
              letterSpacing: 6,
              color: '#FFE08A',
              textShadow: '0 12px 0 #B3700A, 0 0 70px rgba(255,190,60,.85)',
            }}
          >
            {t('slots.jackpot.title').toUpperCase()}
          </div>

          <div style={{ display: 'flex', gap: 28, marginTop: 90 }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: 230,
                  height: 230,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 52,
                  background: 'linear-gradient(180deg, #FFFDF5, #F1EADB)',
                  border: '8px solid #F5C451',
                  boxShadow: '0 24px 50px rgba(0,0,0,.45), 0 0 60px rgba(255,200,80,.5)',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img> */}
                {fish && <img src={fish} width={190} height={80} style={{ objectFit: 'contain' }} alt="" />}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', marginTop: 90, fontSize: 70, lineHeight: 1.15, textAlign: 'center' }}>{prizeText}</div>
          <div style={{ display: 'flex', marginTop: 18, fontSize: 40, color: 'rgba(255,227,161,.85)' }}>{t('slots.jackpot.cardSub')}</div>

          {name && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 26, marginTop: 120 }}>
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img>
                <img src={avatar} width={120} height={120} style={{ borderRadius: 60, border: '6px solid #F5C451', objectFit: 'cover' }} alt="" />
              ) : (
                <div style={{ width: 120, height: 120, borderRadius: 60, border: '6px solid #F5C451', background: '#123A5C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>
                  {name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div style={{ display: 'flex', fontSize: 56 }}>{name.slice(0, 22)}</div>
            </div>
          )}

          <div style={{ display: 'flex', position: 'absolute', bottom: 120, fontSize: 40, color: '#FFD86B', letterSpacing: 2 }}>catchrange.com</div>
        </div>
      ),
      {
        width: W,
        height: H,
        fonts: [
          { name: 'Oswald', data: display, weight: 700, style: 'normal' },
          { name: 'Manrope', data: body, weight: 800, style: 'normal' },
          ...(georgian ? [{ name: 'Manrope', data: georgian, weight: 800 as const, style: 'normal' as const }] : []),
        ],
        headers: { 'Cache-Control': 'public, max-age=3600' },
      }
    )
  } catch {
    return new Response('card unavailable', { status: 500 })
  }
}
