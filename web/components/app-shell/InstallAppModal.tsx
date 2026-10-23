'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { tn } from '@/lib/i18n/runtime'
import { useInstallApp } from '@/lib/installApp'
import { useTelegramHomeScreen } from '@/lib/telegram/useTelegramHomeScreen'

// How to put RANGE on the home screen — a page of steps per place it is opened
// from. Inside Telegram it is Telegram's own flow (a button that calls it); in
// a browser it is Share → Add to Home Screen on iPhone, the browser menu (or
// Chrome's one-tap offer) on Android. Portalled to <body> like the other modals.
type Tab = 'ios' | 'android'

export function InstallAppModal({ onClose }: { onClose: () => void }) {
  const { platform, canPromptNative, promptNative } = useInstallApp()
  const { status, promptAdd } = useTelegramHomeScreen()
  const [picked, setPicked] = useState<Tab | null>(null)
  const tab: Tab = picked ?? (platform === 'android' ? 'android' : 'ios')

  const steps =
    platform === 'telegram'
      ? [tn('install.tgS1'), tn('install.tgS2')]
      : tab === 'ios'
        ? [tn('install.iosS1'), tn('install.iosS2'), tn('install.iosS3'), tn('install.iosS4')]
        : [tn('install.androidS1'), tn('install.androidS2'), tn('install.androidS3')]

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-card-wide install-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{tn('install.title')}</div>
        <div className="install-sub">{tn('install.sub')}</div>

        {platform !== 'telegram' && (
          <div className="install-tabs" role="tablist">
            {(['ios', 'android'] as const).map((id) => (
              <button key={id} role="tab" aria-selected={tab === id} className={`install-tab${tab === id ? ' on' : ''}`} onClick={() => setPicked(id)}>
                {id === 'ios' ? tn('install.tabIos') : tn('install.tabAndroid')}
              </button>
            ))}
          </div>
        )}

        <ol className="install-steps">
          {steps.map((text, i) => (
            <li key={i}>
              <span className="install-step-n">{i + 1}</span>
              <span>{text}</span>
            </li>
          ))}
        </ol>

        {platform === 'telegram' &&
          (status === 'unknown' || status === 'missed' ? (
            <>
              <button className="btn-primary" onClick={promptAdd}>
                {tn('install.tgButton')}
              </button>
              <div className="install-note">{tn('install.tgFallback')}</div>
            </>
          ) : (
            <div className="install-note">{tn('install.tgFallback')}</div>
          ))}

        {platform !== 'telegram' && tab === 'android' && (
          <>
            {canPromptNative && (
              <button className="btn-primary" onClick={() => void promptNative()}>
                {tn('install.androidInstall')}
              </button>
            )}
            <div className="install-note">{tn('install.androidNote')}</div>
          </>
        )}

        <button className="btn-secondary" style={{ marginTop: 12 }} onClick={onClose}>
          {tn('common.close')}
        </button>
      </div>
    </div>,
    document.body
  )
}
