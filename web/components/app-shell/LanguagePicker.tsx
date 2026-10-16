'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { LANGS, useI18n, type Lang } from '@/lib/i18n'
import { translate } from '@/lib/i18n/core'

// «Язык · Language · ენა»: three chips, each in its own language. The choice
// is kept on the device (and drives the Telegram bot's messages too once the
// profile stores it). Picking one asks first — in the language picked, so the
// person reads it in the language they chose — and on «Switch» the white thumb
// slides to it and then the app reloads into it (setLang reloads the page, so
// the thumb would otherwise never be seen moving).
export function LanguagePicker() {
  const { lang, setLang, t } = useI18n()
  const [picked, setPicked] = useState<Lang>(lang)
  const [asking, setAsking] = useState<Lang | null>(null)
  const optsRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const box = optsRef.current
    const thumb = thumbRef.current
    if (!box || !thumb) return
    const place = () => {
      const on = box.querySelector<HTMLElement>('.language-picker-opt.on')
      if (!on) return
      thumb.style.width = `${on.offsetWidth}px`
      thumb.style.transform = `translateX(${on.offsetLeft}px)`
    }
    place()
    const id = requestAnimationFrame(() => thumb.classList.add('ready'))
    const ro = new ResizeObserver(() => {
      thumb.classList.remove('ready')
      place()
      requestAnimationFrame(() => thumb.classList.add('ready'))
    })
    ro.observe(box)
    return () => {
      cancelAnimationFrame(id)
      ro.disconnect()
    }
  }, [picked])

  function choose(next: Lang) {
    if (next === lang || asking) return
    setAsking(next)
  }
  function confirm(next: Lang) {
    setAsking(null)
    setPicked(next)
    window.setTimeout(() => setLang(next), 420)
  }

  return (
    <div className="language-picker" data-tour="language" role="radiogroup" aria-label={t('common.language')}>
      <span className="language-picker-label">{t('common.language')}</span>
      <div className="language-picker-opts" ref={optsRef}>
        <span className="language-picker-thumb" ref={thumbRef} aria-hidden />
        {LANGS.map((l) => (
          <button key={l.id} type="button" role="radio" aria-checked={picked === l.id} className={`language-picker-opt${picked === l.id ? ' on' : ''}`} onClick={() => choose(l.id)} lang={l.id}>
            {l.name}
          </button>
        ))}
      </div>
      {asking &&
        createPortal(
          <div className="modal-overlay" onClick={() => setAsking(null)}>
            <div className="modal-card" role="dialog" aria-modal="true" aria-label={translate(asking, 'langSwitch.title')} onClick={(e) => e.stopPropagation()} lang={asking}>
              <div className="modal-title">{translate(asking, 'langSwitch.title')}</div>
              <div className="modal-body" style={{ margin: '8px 0 18px' }}>
                {translate(asking, 'langSwitch.text')}
              </div>
              <button className="btn-primary" onClick={() => confirm(asking)}>
                {translate(asking, 'langSwitch.confirm')}
              </button>
              <button className="btn-secondary" style={{ marginTop: 8 }} onClick={() => setAsking(null)}>
                {translate(asking, 'langSwitch.cancel')}
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
