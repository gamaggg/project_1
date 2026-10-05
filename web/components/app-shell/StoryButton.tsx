'use client'

import { useState } from 'react'
import { shareCatchStory } from '@/lib/story'
import { useI18n } from '@/lib/i18n'

// «В историю» — the catch as a 9:16 Telegram story (see lib/story.ts).
export function StoryButton({ catchId, caption, onToast, big = false }: { catchId: number; caption: string; onToast: (msg: string) => void; big?: boolean }) {
  const { t, lang } = useI18n()
  const [busy, setBusy] = useState(false)

  async function share() {
    setBusy(true)
    const result = await shareCatchStory(catchId, lang, t('story.caption', { catch: caption }))
    setBusy(false)
    if (result === 'downloaded') onToast(t('story.downloaded'))
    if (result === 'failed') onToast(t('story.failed'))
  }

  return (
    <button className={`story-btn tap-scale${big ? ' big' : ''}`} disabled={busy} onClick={() => void share()}>
      <svg width={big ? 18 : 15} height={big ? 18 : 15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
        <circle cx="12" cy="12" r="9" strokeDasharray="4 2.6" />
        <path d="M12 8v8M8 12h8" />
      </svg>
      {busy ? t('story.preparing') : t('story.button')}
    </button>
  )
}
