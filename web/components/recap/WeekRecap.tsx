'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { RecapSlide, SLIDE_BG, SLIDE_H, SLIDE_W } from '@/components/recap/RecapSlide'
import { useAuth } from '@/components/providers/AuthProvider'
import { useCityWeekRecap } from '@/lib/supabase/queries'
import { recapSlides, sizedPhoto, type SlideId, type WeekRecap } from '@/lib/recap'
import { shareImageToStory } from '@/lib/story'
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
  const { data } = useCityWeekRecap(city, ready)
  if (!data || data.catches === 0) return null

  // «28.09–4.10»: fits a sticker, reads the same in every language.
  const dm = (iso: string) => {
    const d = new Date(`${iso}T12:00:00`)
    return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`
  }
  const shortRange = `${dm(data.weekStart)}–${dm(data.weekEnd)}`

  return (
    <>
      {hidden !== data.weekStart && (
        // A sticker slapped on the map: small, square, tilted, brand orange.
        <div className="recap-sticker-wrap">
          <button
            type="button"
            className="recap-sticker"
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

  // The 1080×1920 slide scaled to fit the screen.
  useLayoutEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / SLIDE_W, window.innerHeight / SLIDE_H))
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

  return createPortal(
    <div className="recap-player" role="dialog" aria-label={t('recap.kicker')} style={{ background: '#000' }}>
      <div
        ref={stageRef}
        className="recap-stage"
        style={{ width, height }}
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
        <div key={id} className="recap-slide-in" style={{ width: SLIDE_W, height: SLIDE_H, transform: `scale(${scale})`, transformOrigin: '0 0', background: SLIDE_BG[id] }}>
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
            }}
          />
        </div>

        <div className="recap-top" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
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

        <div className="recap-bottom" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
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
