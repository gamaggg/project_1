'use client'

import { useEffect } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useI18n } from '@/lib/i18n'
import { createClient } from '@/lib/supabase/client'

const STORAGE_KEY = 'range:lang'
const SYNCED_KEY = 'range:lang-synced'

// Tells the server which language the player chose, so the bot writes its
// Telegram messages in it (profiles.language, set_my_language). Only a
// language they picked is sent — a device that never chose one stays
// «empty = Russian» on the server — and once per account and language. A
// database without the function yet just refuses; nothing breaks, the bot
// keeps speaking Russian, and the next visit tries again.
export function LanguageSync() {
  const { user } = useAuth()
  const { lang } = useI18n()
  const userId = user?.id ?? null

  useEffect(() => {
    if (!userId) return
    try {
      if (!localStorage.getItem(STORAGE_KEY)) return
      const mark = `${userId}:${lang}`
      if (localStorage.getItem(SYNCED_KEY) === mark) return
      const supabase = createClient() as unknown as { rpc: (fn: string, args: object) => PromiseLike<{ error: unknown }> }
      void Promise.resolve(supabase.rpc('set_my_language', { p_lang: lang })).then(({ error }) => {
        if (error) return
        try {
          localStorage.setItem(SYNCED_KEY, mark)
        } catch {}
      })
    } catch {}
  }, [userId, lang])

  return null
}
