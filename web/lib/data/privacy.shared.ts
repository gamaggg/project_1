import type { Lang } from '@/lib/i18n/core'

// «Политика конфиденциальности» (/privacy, /privacy/en, /privacy/ka): the
// public page for what RANGE collects, why, who else gets it and how to have
// it removed. One policy for every city and country: a new city changes
// nothing here. The three texts are privacy.ru.ts / privacy.en.ts /
// privacy.ka.ts and say the same thing — change all three together, in the
// same commit as the data field, service or retention rule they describe
// (docs: «Политика конфиденциальности»). Every statement was checked against
// the code and the database on 26.10.2026.
//
// The two OPERATOR lines are the owner's to fill in: the pages show them as
// written, so replace the brackets before the policy goes live.

export const OPERATOR = {
  name: '[ФИО владельца или название организации, ИНН при наличии]',
  email: '[адрес электронной почты для обращений]',
  bot: '@catchrangebot',
  botUrl: 'https://t.me/catchrangebot',
}

export type PrivacyBlock = string | string[]
export type PrivacySection = { title: string; blocks: PrivacyBlock[] }

export type PrivacyDoc = {
  lang: Lang
  title: string
  metaDescription: string
  updated: string
  intro: string
  sections: PrivacySection[]
}
