'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { tn } from '@/lib/i18n/runtime'
import { IosInstallGuide, TelegramInstallGuide } from '@/components/app-shell/InstallGuides'
import { useInstallApp } from '@/lib/installApp'

// How to put RANGE on the home screen — a page of steps per place it is opened
// from. Inside Telegram it is two steps in the Mini App's own menu (⋮ at the
// top; the WebApp.addToHomeScreen() button was dropped — it only sent people to
// another Telegram page of instructions). In a browser it is Share → Add to Home
// Screen on iPhone, the browser menu (or Chrome's one-tap offer) on Android.
// Portalled to <body> like the other modals.
type Tab = 'ios' | 'android'

export function InstallAppModal({ onClose }: { onClose: () => void }) {
  const { platform, canPromptNative, promptNative } = useInstallApp()
  const [picked, setPicked] = useState<Tab | null>(null)
  const tab: Tab = picked ?? (platform === 'android' ? 'android' : 'ios')

  const pictured = platform === 'telegram' || tab === 'ios'
  const steps = [tn('install.androidS1'), tn('install.androidS2'), tn('install.androidS3')]

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-card-wide install-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="install-modal-body">
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

        {platform === 'telegram' ? (
          <TelegramInstallGuide />
        ) : pictured ? (
          <IosInstallGuide />
        ) : (
          <ol className="install-steps">
            {steps.map((text, i) => (
              <li key={i}>
                <span className="install-step-n">{i + 1}</span>
                <span>{text}</span>
              </li>
            ))}
          </ol>
        )}

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

        </div>
        {/* Outside the scrolling part: a long guide never pushes it off screen. The fade above it
            is only for the long, pictured guide — on a short page it would cover the text. */}
        <div className={`install-modal-foot${pictured ? ' fade' : ''}`}>
          <button className="btn-secondary" onClick={onClose}>
            {tn('common.close')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
