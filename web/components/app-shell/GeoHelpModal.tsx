'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { subscribeGeoHelp, type HelpKind } from '@/lib/geoHelp'
import { tn } from '@/lib/i18n/runtime'

// The steps are one string per phone, split on «|» into numbered lines.
// Shown when the phone refuses the position («User denied Geolocation») or the camera
// (NotAllowedError); the texts live in geoHelp.* and cameraHelp.*. The player has to
// change a setting outside the app, and where it is depends on the phone and on whether the
// app runs inside Telegram or a browser, so only the steps for this phone are shown.
function stepKey(prefix: string) {
  const tg = !!window.Telegram?.WebApp?.initData
  const platform = window.Telegram?.WebApp?.platform ?? ''
  const ua = navigator.userAgent
  const ios = platform === 'ios' || /iPhone|iPad|iPod/.test(ua)
  const android = platform === 'android' || /Android/.test(ua)
  // Telegram on a computer: the Mac app says «macos», Telegram Desktop says «tdesktop» on
  // both Mac and Windows, so the system is read from the user agent as well.
  if (tg && !ios && !android) {
    if (platform === 'macos' || /Mac/.test(ua)) return `${prefix}.stepMacTg`
    if (platform === 'tdesktop' || /Windows/.test(ua)) return `${prefix}.stepWinTg`
  }
  if (ios) return tg ? `${prefix}.stepIosTg` : `${prefix}.stepIosWeb`
  if (android) return tg ? `${prefix}.stepAndroidTg` : `${prefix}.stepAndroidWeb`
  return `${prefix}.stepOther`
}

export function GeoHelpModal() {
  const [retry, setRetry] = useState<(() => void) | null>(null)
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<HelpKind>('geo')

  useEffect(
    () =>
      subscribeGeoHelp((k, r) => {
        setKind(k)
        setRetry(() => r)
        setOpen(true)
      }),
    []
  )

  if (!open) return null
  const close = () => setOpen(false)
  const prefix = kind === 'camera' ? 'cameraHelp' : 'geoHelp'
  const t = (key: string) => tn(`${prefix}.${key}` as Parameters<typeof tn>[0])
  return createPortal(
    <div className="modal-overlay" onClick={close}>
      <div className="modal-card modal-card-wide geo-help-card" role="dialog" aria-label={t('title')} onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{t('title')}</div>
        <div className="modal-body" style={{ marginBottom: 12 }}>
          {t('lead')}
        </div>
        <ol className="geo-help-steps">
          {tn(stepKey(prefix) as Parameters<typeof tn>[0])
            .split('|')
            .map((step, i) => (
              <li key={i}>
                <span>{i + 1}</span>
                {step}
              </li>
            ))}
        </ol>
        <button
          className="btn-primary"
          style={{ marginTop: 16 }}
          onClick={() => {
            close()
            retry?.()
          }}
        >
          {t('retry')}
        </button>
        <button
          className="tap-scale"
          style={{ marginTop: 8, width: '100%', minHeight: 44, border: 'none', background: 'transparent', color: 'var(--ink-soft)', fontSize: 14.5, fontWeight: 700, cursor: 'pointer' }}
          onClick={close}
        >
          {tn('common.gotIt')}
        </button>
      </div>
    </div>,
    document.body
  )
}
