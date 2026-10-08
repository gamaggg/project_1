'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { RecapSlide, SLIDE_BG, SLIDE_H, SLIDE_W } from '@/components/recap/RecapSlide'
import { useAuth } from '@/components/providers/AuthProvider'
import { useCityWeekRecap } from '@/lib/supabase/queries'
import { recapSlides, sizedPhoto, type SlideId, type WeekRecap } from '@/lib/recap'
import { shareImageToStory } from '@/lib/story'
import { useUiState } from '@/lib/uiState'
import { track } from '@/lib/analytics'
import { useI18n } from '@/lib/i18n'
import type { TKey } from '@/lib/i18n/core'
import type { CityId } from '@/lib/data/city'

const SLIDE_MS = 6000
const HIDDEN_KEY = 'range:recap-hidden'

function readHidden(): string | null {
  try {
    return window.localStorage.getItem(HIDDEN_KEY)
  } catch {
    return null
  }
}

// «Неделя в городе» on the map: a slim banner over the sector cards. Tap —
// the story player; × asks first, then hides it until next Monday's recap.
export function RecapBanner({ city, onFindFree }: { city: CityId; onFindFree: () => void }) {
  const { t } = useI18n()
  const [ready, setReady] = useState(false)
  const [hidden, setHidden] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    // After the map's own first requests, not alongside them.
    const id = window.setTimeout(() => {
      setHidden(readHidden())
      setReady(true)
    }, 1200)
    return () => window.clearTimeout(id)
  }, [])
  // The hidden week is kept on the account too (lib/uiState.ts): a sticker
  // hidden on the phone stays hidden in Telegram on the desktop, and survives
  // iPhone Telegram dropping the Mini App's localStorage. Guests: this device.
  const ui = useUiState()
  const remoteHidden = (ui.state?.recap_hidden as string | undefined) ?? null
  const hiddenWeek = [hidden, remoteHidden].filter((w): w is string => !!w).sort().pop() ?? null
  const { data } = useCityWeekRecap(city, ready && ui.ready)
  if (!data || data.catches === 0) return null

  // «28.09–4.10»: fits a sticker, reads the same in every language.
  const dm = (iso: string) => {
    const d = new Date(`${iso}T12:00:00`)
    return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`
  }
  const shortRange = `${dm(data.weekStart)}–${dm(data.weekEnd)}`

  return (
    <>
      {hiddenWeek !== data.weekStart && (
        // A sticker slapped on the map: small, square, tilted, brand orange.
        <div className="recap-sticker-wrap">
          <button
            type="button"
            data-tour="recap" className="recap-sticker"
            onClick={() => {
              track('recap_open', { week: data.weekStart }, city)
              setOpen(true)
            }}
            aria-label={t('recap.bannerTitle', { cityIn: t(`recap.cityIn.${city}` as TKey) })}
          >
            <svg className="recap-sticker-spark" width="34" height="34" viewBox="0 0 24 24" fill="#FFE14D" aria-hidden>
              <path d="M12 2l2.2 6.6L21 11l-6.8 2.4L12 20l-2.2-6.6L3 11l6.8-2.4z" />
            </svg>
            <span className="recap-sticker-week">{t('recap.stickerWeek')}</span>
            <span className="recap-sticker-city">{t(`recap.cityIn.${city}` as TKey)}</span>
            <span className="recap-sticker-dates">{shortRange}</span>
          </button>
          <button type="button" className="recap-sticker-close" aria-label={t('recap.hide')} onClick={() => setConfirming(true)}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      )}
      {confirming &&
        createPortal(
          <div className="modal-overlay" onClick={() => setConfirming(false)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-title">{t('recap.hideTitle')}</div>
              <div className="modal-body" style={{ margin: '6px 0 16px' }}>
                {t('recap.hideText')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  className="btn-primary"
                  onClick={() => {
                    try {
                      window.localStorage.setItem(HIDDEN_KEY, data.weekStart)
                    } catch {}
                    setHidden(data.weekStart)
                    ui.set('recap_hidden', data.weekStart)
                    setConfirming(false)
                  }}
                >
                  {t('recap.hide')}
                </button>
                <button className="btn-secondary" onClick={() => setConfirming(false)}>
                  {t('recap.cancel')}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      {open && (
        <RecapPlayer
          city={city}
          data={data}
          onClose={() => setOpen(false)}
          onFindFree={() => {
            setOpen(false)
            onFindFree()
          }}
        />
      )}
    </>
  )
}

// The story player: progress bars on top, a slide every six seconds, tap
// the left third to go back and anywhere else to go on, hold to pause.
function RecapPlayer({ city, data, onClose, onFindFree }: { city: CityId; data: WeekRecap; onClose: () => void; onFindFree: () => void }) {
  const { t, lang } = useI18n()
  const { user } = useAuth()
  const slides = recapSlides(data)
  const [index, setIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [anim, setAnim] = useState(0)
  const [scale, setScale] = useState(0.3)
  const [sharing, setSharing] = useState(false)
  const paused = useRef(false)
  const elapsed = useRef(0)
  const pressAt = useRef(0)
  const stageRef = useRef<HTMLDivElement>(null)
  const id: SlideId = slides[index]
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  // Steps go through refs, not the rendered index: two quick taps (or arrow
  // presses) before React re-renders must count as two steps, not one.
  const indexRef = useRef(0)
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])
  const step = useCallback(
    (delta: number) => {
      const next = Math.max(0, indexRef.current + delta)
      if (next >= slides.length) {
        closeRef.current()
        return
      }
      indexRef.current = next
      elapsed.current = 0
      setIndex(next)
      setProgress(0)
      setAnim(0)
    },
    [slides.length]
  )

  // One clock for the whole player: the bar fills, numbers count up, and
  // at the end of a slide the next one starts (the last one just stays).
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = now - last
      last = now
      if (!paused.current && !sharing) {
        elapsed.current += dt
        const p = Math.min(1, elapsed.current / SLIDE_MS)
        setProgress(p)
        setAnim(reduced ? 1 : Math.min(1, elapsed.current / 1100))
        if (p >= 1 && indexRef.current < slides.length - 1) {
          step(1)
          return
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [index, slides.length, step, sharing, reduced])

  // The 1080×1920 slide scaled to fit the safe part of the screen — below the
  // status bar and Telegram's header buttons, above the home indicator — so
  // the progress bars can sit at the card's own top edge. (They used to add
  // the status-bar inset on top of a card already below it and landed on the
  // slide's «Итоги недели» line.) The insets are read off a probe element,
  // the only way to resolve env(safe-area-inset-*) in script.
  const [view, setView] = useState({ w: 0, h: 0, top: 0, bottom: 0 })
  useLayoutEffect(() => {
    const fit = () => {
      const probe = document.createElement('div')
      probe.style.cssText =
        'position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;padding-top:calc(env(safe-area-inset-top) + var(--tg-safe-area-top, 0px));padding-bottom:calc(env(safe-area-inset-bottom) + var(--tg-safe-area-bottom, 0px))'
      document.body.appendChild(probe)
      const cs = getComputedStyle(probe)
      const top = parseFloat(cs.paddingTop) || 0
      const bottom = parseFloat(cs.paddingBottom) || 0
      probe.remove()
      setView({ w: window.innerWidth, h: window.innerHeight, top, bottom })
      setScale(Math.min(window.innerWidth / SLIDE_W, (window.innerHeight - top - bottom) / SLIDE_H))
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current()
      if (e.key === 'ArrowRight') step(1)
      if (e.key === 'ArrowLeft') step(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step])

  async function share() {
    setSharing(true)
    track('recap_share', { slide: id }, city)
    const origin = window.location.origin
    const imageUrl = `${origin}/api/recap/${city}/${id}?lang=${lang}${user ? `&u=${user.id}` : ''}`
    await shareImageToStory(imageUrl, `${t('recap.bannerTitle', { cityIn: t(`recap.cityIn.${city}` as TKey) })} · RANGE`, `${origin}${window.location.pathname}`, `range-week-${id}.png`)
    setSharing(false)
  }

  const width = SLIDE_W * scale
  const height = SLIDE_H * scale
  // On a phone (a screen not much wider than the slide) the story runs edge
  // to edge: the slide's colour, glows and photo fill the whole screen, under
  // the status bar and Telegram's buttons too, while its text, the progress
  // bars and the buttons stay on the 9:16 slide in the safe area (see
  // SlideEnv.canvas). A wide screen keeps the card on black.
  const bleed = view.w > 0 && view.w / scale <= SLIDE_W * 1.3
  const cardLeft = bleed ? (view.w - width) / 2 : 0
  const cardTop = bleed ? view.top + (view.h - view.top - view.bottom - height) / 2 : 0
  const canvas = bleed
    ? { w: Math.ceil(view.w / scale), h: Math.ceil(view.h / scale), x: cardLeft / scale, y: cardTop / scale }
    : undefined
  const onCard = bleed ? { left: cardLeft, width } : undefined

  // Safari paints the strip under its collapsed toolbar — outside the player —
  // in the page's own (white) background, so for as long as the story is open
  // the page takes the colour of the slide's lower edge.
  useEffect(() => {
    const root = document.documentElement
    const before = root.style.backgroundColor
    root.style.backgroundColor = bleed ? (SLIDE_BG[id].match(/#[0-9a-f]{6}(?![\s\S]*#[0-9a-f]{6})/i)?.[0] ?? '#000') : '#000'
    return () => {
      root.style.backgroundColor = before
    }
  }, [id, bleed])

  return createPortal(
    <div
      className="recap-player"
      role="dialog"
      aria-label={t('recap.kicker')}
      style={{ background: '#000', paddingTop: bleed ? 0 : view.top, paddingBottom: bleed ? 0 : view.bottom }}
    >
      <div
        ref={stageRef}
        className="recap-stage"
        style={bleed ? { width: view.w, height: view.h, borderRadius: 0 } : { width, height }}
        onPointerDown={() => {
          paused.current = true
          pressAt.current = performance.now()
        }}
        onPointerUp={(e) => {
          paused.current = false
          if (performance.now() - pressAt.current > 250) return
          const rect = stageRef.current!.getBoundingClientRect()
          step(e.clientX - rect.left < rect.width / 3 ? -1 : 1)
        }}
        onPointerCancel={() => (paused.current = false)}
        onPointerLeave={() => (paused.current = false)}
      >
        <div
          key={id}
          className="recap-slide-in"
          style={{ width: canvas?.w ?? SLIDE_W, height: canvas?.h ?? SLIDE_H, transform: `scale(${scale})`, transformOrigin: '0 0', background: SLIDE_BG[id] }}
        >
          <RecapSlide
            id={id}
            env={{
              data,
              city,
              lang,
              t,
              anim,
              img: (u, w, h) => sizedPhoto(u, w, h),
              logo: '/brand/logo_2.svg',
              fonts: { display: 'var(--font-display), Oswald, sans-serif', body: 'var(--font-manrope), Manrope, sans-serif' },
              decor: <RecapDecor />,
              canvas,
            }}
          />
        </div>

        <div
          className="recap-top"
          style={onCard && { ...onCard, right: 'auto', top: cardTop }}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          <div className="recap-bars">
            {slides.map((s, i) => (
              <span key={s}>
                <i style={{ transform: `scaleX(${i < index ? 1 : i === index ? progress : 0})` }} />
              </span>
            ))}
          </div>
          <button type="button" className="recap-close" aria-label={t('recap.close')} onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div
          className="recap-bottom"
          style={onCard && { ...onCard, right: 'auto', bottom: view.h - cardTop - height + 22 }}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          {id === 'you' && !(data.me && data.me.catches > 0) && (
            <button type="button" className="recap-cta" onClick={onFindFree}>
              {t('recap.youCta')}
            </button>
          )}
          {id === 'final' && (
            <button type="button" className="recap-cta" onClick={onClose}>
              {t('recap.toMap')}
            </button>
          )}
          <button type="button" className="recap-share" disabled={sharing} onClick={() => void share()}>
            {sharing ? t('story.preparing') : t('recap.share')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// Barely-there motion behind a slide: a few soft pools of light, each its
// own colour, size and pace, drifting and breathing slowly. In slide units
// (1080×1920, scaled with the slide). Off for reduced motion (see the CSS).
function RecapDecor() {
  return (
    <div className="recap-decor" aria-hidden>
      <span className="recap-glow g1" />
      <span className="recap-glow g2" />
      <span className="recap-glow g3" />
      <span className="recap-glow g4" />
    </div>
  )
}
