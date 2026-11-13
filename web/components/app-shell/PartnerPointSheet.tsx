'use client'

import '@/app/partner-points.css'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { RouteModal } from '@/components/app-shell/RouteModal'
import { PhotoViewer } from '@/components/app-shell/PhotoViewer'
import { CITIES } from '@/lib/data/city'
import { sponsorsThisWeek, telHref, type PartnerPoint } from '@/lib/data/partnerPoints'
import { openExternal } from '@/lib/openExternal'
import { hapticTap } from '@/lib/telegram/haptics'
import { currentLocale, tn } from '@/lib/i18n/runtime'

// A partner's card (lib/data/partnerPoints.ts): a sheet that rises from the bottom when the pin on the map is tapped,
// in the look of the /partners demo — photos, the three actions (route, call, website), the address to copy, the
// opening hours, the promo code to copy and, in the «Партнёр» plan's weeks, the weekly prize.
// `preview` is the admin's «как увидит игрок»: the same card over the editor.

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Telegram's WebView on some phones refuses the clipboard API; the old way still works there.
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}

// The last day the point is on the map: ends_at is 00:00 of the day after it, in the city's time.
function lastDay(p: PartnerPoint): string {
  return new Intl.DateTimeFormat(currentLocale(), { day: 'numeric', month: 'long', timeZone: CITIES[p.city].timezone }).format(new Date(Date.parse(p.endsAt) - 60_000))
}

const Icon = {
  route: (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 11 21 3l-8 18-2-8z" />
    </svg>
  ),
  call: (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
    </svg>
  ),
  site: (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" />
    </svg>
  ),
  close: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  store: (
    <svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 9.5 5.5 4.5h13L20 9.5" />
      <path d="M4 9.5a2.67 2.67 0 0 0 5.33 0 2.67 2.67 0 0 0 5.34 0 2.67 2.67 0 0 0 5.33 0" />
      <path d="M5.5 12v7.5h13V12" />
      <path d="M10 19.5v-4.5h4v4.5" />
    </svg>
  ),
}

export function PartnerPointSheet({ point, onClose, preview = false }: { point: PartnerPoint; onClose: () => void; preview?: boolean }) {
  const [slide, setSlide] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const [route, setRoute] = useState(false)
  const [photo, setPhoto] = useState<string | null>(null)
  const [codeShown, setCodeShown] = useState(false)
  const [dragY, setDragY] = useState(0)
  const startY = useRef<number | null>(null)
  const galleryRef = useRef<HTMLDivElement>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !route && !photo && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
  }, [onClose, route, photo])

  const say = (text: string) => {
    setToast(text)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 1800)
  }
  const copy = async (text: string, done: string) => {
    hapticTap()
    say((await copyText(text)) ? done : tn('common.copyFailed'))
  }

  const photos = point.photos
  const prize = sponsorsThisWeek(point)
  const hasPromo = !!point.promoCode

  return createPortal(
    <div className="move-sheet-overlay pp-overlay" onClick={onClose}>
      <div
        className="move-sheet pp-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={point.name}
        onClick={(e) => e.stopPropagation()}
        style={dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
      >
        <div
          className="pp-grab"
          onPointerDown={(e) => {
            startY.current = e.clientY
            e.currentTarget.setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => {
            if (startY.current !== null) setDragY(Math.max(0, e.clientY - startY.current))
          }}
          onPointerUp={() => {
            if (dragY > 90) onClose()
            setDragY(0)
            startY.current = null
          }}
          onPointerCancel={() => {
            setDragY(0)
            startY.current = null
          }}
        >
          <span />
        </div>

        <div className="pp-scroll">
          <div className="pp-gwrap">
            {photos.length > 0 ? (
              <div
                className="pp-gallery"
                ref={galleryRef}
                onScroll={() => {
                  const el = galleryRef.current
                  if (el) setSlide(Math.round(el.scrollLeft / el.clientWidth))
                }}
              >
                {photos.map((src, n) => (
                  <button key={src + n} className="pp-slide" onClick={() => setPhoto(src)} aria-label={tn('partner.photoOf', { n: n + 1, total: photos.length })}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" loading={n === 0 ? 'eager' : 'lazy'} decoding="async" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="pp-slide pp-slide-empty" aria-hidden>
                {Icon.store}
              </div>
            )}
            {photos.length > 1 && (
              <div className="pp-dots" aria-hidden>
                {photos.map((_, n) => (
                  <i key={n} className={n === slide ? 'on' : ''} />
                ))}
              </div>
            )}
          </div>

          <div className="pp-body">
            <span className="pp-kicker">{tn('partner.kicker')}</span>
            <h3 className="pp-title">{point.name}</h3>
            {point.kind && <p className="pp-kind">{point.kind}</p>}
            {point.description && <p className="pp-desc">{point.description}</p>}
            {point.hours && (
              <p className="pp-hours">
                {Icon.clock} {point.hours}
              </p>
            )}

            <div className={`pp-actions pp-actions-${1 + (point.phone ? 1 : 0) + (point.website ? 1 : 0)}`}>
              <button
                className="pp-act pp-act-main"
                onClick={() => {
                  hapticTap()
                  setRoute(true)
                }}
              >
                {Icon.route}
                {tn('partner.route')}
              </button>
              {point.phone && (
                <a className="pp-act" href={telHref(point.phone)} onClick={() => hapticTap()}>
                  {Icon.call}
                  {tn('partner.call')}
                </a>
              )}
              {point.website && (
                <button
                  className="pp-act"
                  onClick={() => {
                    hapticTap()
                    openExternal(point.website!)
                  }}
                >
                  {Icon.site}
                  {tn('partner.site')}
                </button>
              )}
            </div>

            {point.address && (
              <div className="pp-row">
                <div>
                  <span className="pp-label">{tn('partner.address')}</span>
                  <b>{point.address}</b>
                </div>
                <button className="pp-copy" onClick={() => copy(point.address!, tn('partner.addressCopied'))}>
                  {tn('partner.copy')}
                </button>
              </div>
            )}

            {hasPromo && (
              <div className="pp-block pp-promo">
                <h4>{tn('partner.promoTitle')}</h4>
                {point.promoTerms ? <p>{point.promoTerms}</p> : <p>{tn('partner.promoHint')}</p>}
                <button className={codeShown ? 'pp-ticket pp-ticket-on' : 'pp-ticket'} onClick={() => setCodeShown(true)}>
                  <b>{point.promoCode}</b>
                  {point.promoDiscount && <span>{point.promoDiscount}</span>}
                </button>
                <button
                  className="pp-act pp-act-main pp-full"
                  onClick={() => {
                    setCodeShown(true)
                    copy(point.promoCode!, tn('partner.codeCopied'))
                  }}
                >
                  {tn('partner.copyCode')}
                </button>
                <p className="pp-promo-until">{tn('partner.promoUntil', { date: lastDay(point) })}</p>
              </div>
            )}

            {prize && (
              <div className="pp-block pp-prize">
                <span className="pp-chip">{tn('partner.prizeKicker')}</span>
                <h4>{point.prizeTitle}</h4>
                <p className="pp-prize-from">{tn('partner.prizeFrom', { name: point.prizeFrom ?? point.name })}</p>
                <p>{tn('partner.prizeRule')}</p>
              </div>
            )}


            {preview && <p className="pp-until">Так карточку увидит игрок</p>}
          </div>
        </div>
        {toast && (
          <div className="pp-toast" role="status">
            {toast}
          </div>
        )}
      </div>
      {route && (
        <div onClick={(e) => e.stopPropagation()}>
          <RouteModal lat={point.lat} lng={point.lng} title={tn('partner.routeTitle')} overlayClass="pp-over" onClose={() => setRoute(false)} />
        </div>
      )}
      {photo && (
        <div onClick={(e) => e.stopPropagation()}>
          <PhotoViewer src={photo} alt={point.name} onClose={() => setPhoto(null)} />
        </div>
      )}
    </div>,
    document.body
  )
}
