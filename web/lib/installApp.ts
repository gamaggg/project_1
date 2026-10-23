'use client'

import { useSyncExternalStore } from 'react'
import { insideTelegram } from '@/lib/openExternal'

export type InstallPlatform = 'telegram' | 'ios' | 'android' | 'other'

// Chrome's own install offer, on Android: fired once, early, so it is kept
// from a listener set at app start (ServiceWorkerRegister) for the profile
// button to use whenever it is pressed.
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
let deferredPrompt: InstallPromptEvent | null = null
const listeners = new Set<() => void>()

export function captureInstallPrompt(): () => void {
  const onPrompt = (e: Event) => {
    e.preventDefault()
    deferredPrompt = e as InstallPromptEvent
    listeners.forEach((l) => l())
  }
  const onInstalled = () => {
    deferredPrompt = null
    listeners.forEach((l) => l())
  }
  window.addEventListener('beforeinstallprompt', onPrompt)
  window.addEventListener('appinstalled', onInstalled)
  return () => {
    window.removeEventListener('beforeinstallprompt', onPrompt)
    window.removeEventListener('appinstalled', onInstalled)
  }
}

function detectPlatform(): InstallPlatform {
  if (insideTelegram()) return 'telegram'
  const ua = navigator.userAgent
  // iPadOS 13+ reports itself as a Mac; a touch screen tells them apart.
  if (/iP(hone|ad|od)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'other'
}

function isStandalone(): boolean {
  return (navigator as Navigator & { standalone?: boolean }).standalone === true || !!window.matchMedia?.('(display-mode: standalone)').matches
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

// What the profile button and the instruction need to know. The server render
// has no phone to look at, so its snapshots are the neutral ones ('other', not
// installed); the browser's are read after hydration.
export function useInstallApp() {
  const platform = useSyncExternalStore<InstallPlatform>(subscribe, detectPlatform, () => 'other')
  const installed = useSyncExternalStore(subscribe, isStandalone, () => false)
  const canPromptNative = useSyncExternalStore(subscribe, () => deferredPrompt !== null, () => false)

  async function promptNative() {
    const e = deferredPrompt
    if (!e) return
    deferredPrompt = null
    await e.prompt().catch(() => {})
    listeners.forEach((l) => l())
  }

  return { platform, installed, canPromptNative, promptNative }
}
