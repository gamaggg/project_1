'use client'

import { LANGS, useI18n } from '@/lib/i18n'

// «Язык · Language · ენა»: three chips, each in its own language. The choice
// is kept on the device (and drives the Telegram bot's messages too once the
// profile stores it).
export function LanguagePicker() {
  const { lang, setLang, t } = useI18n()
  return (
    <div className="language-picker" role="radiogroup" aria-label={t('common.language')}>
      <span className="language-picker-label">{t('common.language')}</span>
      <div className="language-picker-opts">
        {LANGS.map((l) => (
          <button key={l.id} type="button" role="radio" aria-checked={lang === l.id} className={`language-picker-opt${lang === l.id ? ' on' : ''}`} onClick={() => setLang(l.id)} lang={l.id}>
            {l.name}
          </button>
        ))}
      </div>
    </div>
  )
}
