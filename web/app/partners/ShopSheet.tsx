'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { PARTNER_PHOTOS, type PartnerCity, type PartnersDoc } from '@/lib/data/partners.shared'
import { GallerySlide, ProductIcon } from './ShopArt'

type Props = {
  doc: PartnersDoc
  city: PartnerCity
  open: boolean
  promo: boolean
  week: boolean
  coords: [number, number]
  onClose: () => void
  // On a computer the card stands on the page next to the map instead of rising as a sheet;
  // `pulse` changes when the pin is clicked, and the card flashes to show where it is.
  inline?: boolean
  pulse?: number
}

// The shop's card in the app's own bottom-sheet look: a sheet that rises from the bottom with
// photos, ways to reach the shop, the promo code and the weekly catch, and what the shop sells.
export function ShopSheet({ doc, city, open, promo, week, coords, onClose, inline = false, pulse = 0 }: Props) {
  const d = doc.demo
  const sh = doc.sheet
  const photos = PARTNER_PHOTOS[city]
  const slides = photos.length || 3
  const [slide, setSlide] = useState(0)
  const [shown, setShown] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [dragY, setDragY] = useState(0)
  const startY = useRef<number | null>(null)
  const galleryRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const say = useCallback((text: string) => {
    setToast(text)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 1800)
  }, [])

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      /* the toast still says it, the text is short enough to read */
    }
    say(sh.copied)
  }

  const [flash, setFlash] = useState(false)
  const [seenPulse, setSeenPulse] = useState(pulse)
  if (pulse !== seenPulse) {
    setSeenPulse(pulse)
    setFlash(true)
  }

  useEffect(() => {
    if (!open || inline) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    closeRef.current?.focus({ preventScroll: true })
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, inline])

  useEffect(() => {
    if (!open) {
      setShown(false)
      setDragY(0)
    }
  }, [open])

  const onGallery = () => {
    const el = galleryRef.current
    if (el) setSlide(Math.round(el.scrollLeft / el.clientWidth))
  }

  const route = `https://www.google.com/maps/dir/?api=1&destination=${coords[0]},${coords[1]}`
  const tab = open || inline ? 0 : -1

  const card = (
    <>
      <div className="pt-scroll">
        <div className="pt-gwrap">
          <div className="pt-gallery" ref={galleryRef} onScroll={onGallery} aria-label={sh.photos}>
            {Array.from({ length: slides }, (_, n) => (
              <div className="pt-slide" key={n}>
                {photos.length ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photos[n]} alt="" loading="lazy" />
                ) : (
                  <GallerySlide n={n} />
                )}
              </div>
            ))}
          </div>
          {!photos.length && <span className="pt-photo-note">{sh.photoNote}</span>}
          <div className="pt-dots" aria-hidden="true">
            {Array.from({ length: slides }, (_, n) => (
              <i key={n} className={n === slide ? 'on' : ''} />
            ))}
          </div>
          {!inline && (
            <button ref={closeRef} className="pt-close" onClick={onClose} aria-label={sh.close} tabIndex={tab}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          )}
        </div>

        <div className="pt-body">
          <h3 className="pt-title">{d.shop.name}</h3>
          <p className="pt-kind">{d.shop.kind}</p>
          <p className="pt-open">
            <span className="pt-dot" /> {d.shop.hours} · {d.shop.dist}
          </p>

          <div className="pt-actions">
            <a className="pt-act pt-act-main" href={route} target="_blank" rel="noopener" tabIndex={tab}>
              <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 11 21 3l-8 18-2-8z" />
              </svg>
              {sh.route}
            </a>
            <button className="pt-act" onClick={() => say(sh.callDemo)} tabIndex={tab}>
              <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
              </svg>
              {sh.call}
            </button>
          </div>

          <div className="pt-row">
            <div>
              <span className="pt-label">{sh.addressLabel}</span>
              <b>{sh.address}</b>
            </div>
            <button className="pt-copy" onClick={() => copy(sh.address)} tabIndex={tab}>
              {sh.copy}
            </button>
          </div>

          {promo && (
            <div className="pt-block pt-promo pt-in">
              <h4>{d.promo.title}</h4>
              <p>{d.promo.text}</p>
              <div className={shown ? 'pt-ticket pt-ticket-on' : 'pt-ticket'}>
                <b>{d.promo.code}</b>
                <span>{d.promo.discount}</span>
                <button onClick={() => copy(d.promo.code)} tabIndex={tab}>
                  {sh.copy}
                </button>
              </div>
              <button className="pt-act pt-act-main pt-full" onClick={() => setShown((v) => !v)} tabIndex={tab}>
                {shown ? `✓ ${d.promo.shown}` : d.promo.show}
              </button>
              <p className="pt-small">{d.promo.valid}</p>
            </div>
          )}

          {week && (
            <div className="pt-block pt-week pt-in">
              <span className="pt-chip-sponsor">{sh.sponsor}</span>
              <h4>{d.week.title}</h4>
              <p>
                {d.week.prizeLabel}: <b>{d.week.prize}</b>
              </p>
              <p className="pt-small">{d.week.rule}</p>
              <ol className="pt-board">
                {d.week.board.map((r, i) => (
                  <li key={r.name}>
                    <span>{i + 1}</span>
                    <b>{r.name}</b>
                    <em>{r.result}</em>
                  </li>
                ))}
              </ol>
              <p className="pt-small">{sh.weekEnds}</p>
            </div>
          )}

          <h4 className="pt-section">{sh.productsTitle}</h4>
          <ul className="pt-products">
            {sh.products.map((p, i) => (
              <li key={p}>
                <span className="pt-pic">
                  <ProductIcon i={i} />
                </span>
                <span className="pt-pname">{p}</span>
              </li>
            ))}
          </ul>

          <p className="pt-demo-note">{sh.demoNote}</p>
        </div>
      </div>
      {toast && (
        <div className="pt-toast" role="status">
          {toast}
        </div>
      )}
    </>
  )

  // On a computer: the same card, standing on the page beside the map.
  if (inline) {
    return (
      <section className={`pt-panel pt-inline${flash ? ' pt-inline-flash' : ''}`} aria-label={d.shop.name} onAnimationEnd={() => setFlash(false)}>
        {card}
      </section>
    )
  }

  return (
    <div className={open ? 'pt-modal pt-modal-open' : 'pt-modal'} aria-hidden={!open}>
      <div className="pt-backdrop" onClick={onClose} />
      <div
        className="pt-panel"
        role="dialog"
        aria-modal="true"
        aria-label={d.shop.name}
        style={dragY ? { transform: `translate(-50%, ${dragY}px)`, transition: 'none' } : undefined}
      >
        <div
          className="pt-grab"
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
        {card}
      </div>
    </div>
  )
}
