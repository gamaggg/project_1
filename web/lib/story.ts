'use client'

import { insideTelegram } from '@/lib/openExternal'
import type { Lang } from '@/lib/i18n/core'

// «В историю»: inside Telegram, its own story editor with one of our 9:16
// cards and a caption; the tappable link sticker only for Premium, the only
// accounts Telegram allows it for. In a browser there are no stories — the
// card goes to the phone's share sheet, or downloads.
export type StoryResult = 'telegram' | 'shared' | 'downloaded' | 'failed'

export async function shareImageToStory(imageUrl: string, caption: string, link: string | null, filename: string): Promise<StoryResult> {
  const webApp = window.Telegram?.WebApp
  if (insideTelegram() && webApp?.shareToStory && (webApp.isVersionAtLeast?.('7.8') ?? true)) {
    const premium = !!webApp.initDataUnsafe?.user?.is_premium
    webApp.shareToStory(imageUrl, { text: caption.slice(0, premium ? 2048 : 200), ...(premium && link ? { widget_link: { url: link, name: 'RANGE' } } : {}) })
    return 'telegram'
  }
  try {
    const res = await fetch(imageUrl)
    if (!res.ok) return 'failed'
    const blob = await res.blob()
    const file = new File([blob], filename, { type: 'image/png' })
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: caption })
        return 'shared'
      } catch (e) {
        // The person closed the share sheet — not a failure, nothing to do.
        if (e instanceof DOMException && e.name === 'AbortError') return 'shared'
      }
    }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
    return 'downloaded'
  } catch {
    return 'failed'
  }
}

// «Скачать»: inside Telegram its own save prompt (Bot API 8.0+ — a Mini App
// can't save a file any other way); in a browser a plain download.
export async function downloadImage(imageUrl: string, filename: string): Promise<'telegram' | 'downloaded' | 'failed'> {
  const webApp = window.Telegram?.WebApp
  if (insideTelegram() && webApp?.downloadFile && (webApp.isVersionAtLeast?.('8.0') ?? false)) {
    webApp.downloadFile({ url: imageUrl, file_name: filename })
    return 'telegram'
  }
  try {
    const res = await fetch(imageUrl)
    if (!res.ok) return 'failed'
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
    return 'downloaded'
  } catch {
    return 'failed'
  }
}

export function shareCatchStory(catchId: number, lang: Lang, caption: string): Promise<StoryResult> {
  const origin = window.location.origin
  return shareImageToStory(`${origin}/api/story/${catchId}?lang=${lang}`, caption, `${origin}${window.location.pathname}?catch=${catchId}`, `range-${catchId}.png`)
}
