import { currentLanguage, tn, tnd } from '@/lib/i18n/runtime'
import { ru } from '@/lib/i18n/ru'
import { localSpeciesNameLoose } from '@/lib/data/species'

// Texts the database stores in Russian — buff and challenge names, award
// titles, the labels of coin transactions. Other languages show a translation
// found by the row's id (or, for the sentences with a sector or a player
// inside, by matching the stored sentence), and fall back to the Russian
// text when nothing matches — so a new row in the database never shows blank.
// Russian itself is always returned untouched.

const isRu = () => currentLanguage() === 'ru'
const has = (key: string) => key in flatRu
const flatRu: Record<string, true> = {}
for (const [ns, group] of Object.entries(ru)) {
  if (group && typeof group === 'object') for (const k of Object.keys(group)) flatRu[`${ns}.${k}`] = true
}
const T = (key: string, vars?: Record<string, string | number>) => tnd(key, vars)

export function localBuff(id: string, name: string, description: string): { name: string; description: string } {
  if (isRu() || !has(`dbText.buff_${id}_n`)) return { name, description }
  return { name: T(`dbText.buff_${id}_n`), description: T(`dbText.buff_${id}_d`) }
}

export function localChallenge(id: string, name: string, description: string): { name: string; description: string } {
  if (isRu() || !has(`dbText.ch_${id}_n`)) return { name, description }
  return { name: T(`dbText.ch_${id}_n`), description: T(`dbText.ch_${id}_d`) }
}

// Notifications carry only a challenge's name — find it by the Russian name.
const CHALLENGE_BY_NAME = new Map<string, string>()
for (const k of Object.keys(ru.dbText)) if (k.startsWith('ch_') && k.endsWith('_n')) CHALLENGE_BY_NAME.set((ru.dbText as unknown as Record<string, string>)[k], k.slice(3, -2))
export function localChallengeName(name: string): string {
  const id = isRu() ? undefined : CHALLENGE_BY_NAME.get(name)
  return id ? T(`dbText.ch_${id}_n`) : name
}

// ----- awards -----

const RU_MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
const monthName = (ruName: string): string => {
  const i = RU_MONTHS.findIndex((m) => m.toLowerCase() === ruName.toLowerCase())
  return i < 0 ? ruName : tn('fmt.months').split('|')[i]
}
// «улов/улова/уловов», «сектор/сектора/секторов» → the plural phrase in the reader's language.
const countPhrase = (n: number, noun: 'catch' | 'sector') => `${n} ${tn(`plural.${noun}`, { count: n })}`

const TITLE_KIND: Record<string, string> = {
  'Улов месяца': 'catch_of_month',
  'Победитель битвы кланов': 'clan_race_winner',
  'Победитель регаты': 'regatta',
  'Дуэлянт': 'duelist',
  'Хранитель сектора': 'guardian',
  'Хозяин горячего сектора': 'hot_sector',
  'Молния': 'lightning',
  'Ночной страж': 'night_watch',
  'Легенда сезона': 'season_legend',
}

export function localAwardTitle(title: string): string {
  if (isRu()) return title
  const place = /^(\d+) место$/.exec(title)
  if (place) return T('dbText.awPlace', { n: place[1] })
  const kind = TITLE_KIND[title]
  if (kind) return T(`dbText.awTitle_${kind}`)
  const ach = ACH_TITLE.get(title)
  return ach ? T(ach) : title
}

function sub(text: string, re: RegExp, fn: (m: RegExpExecArray) => string): string | null {
  const m = re.exec(text)
  return m ? fn(m) : null
}

// subtitle: the line under the title; description: the sentence on the award's card.
export function localAwardSubtitle(title: string, subtitle: string): string {
  if (isRu() || !subtitle) return subtitle
  const kind = /^\d+ место$/.test(title) ? 'weekly_rank' : TITLE_KIND[title]
  const out =
    kind === 'weekly_rank'
      ? sub(subtitle, /^(.+), (\d+) неделя$/, (m) => T('dbText.awWeekOfMonth', { month: monthName(m[1]), week: m[2] }))
      : kind === 'catch_of_month'
        ? sub(subtitle, /^(\S+) (\d{4})$/, (m) => T('dbText.awMonthYear', { month: monthName(m[1]), year: m[2] }))
        : kind === 'clan_race_winner'
          ? sub(subtitle, /^Клан «(.+)»$/, (m) => T('dbText.awClan', { name: m[1] }))
          : kind === 'duelist'
            ? sub(subtitle, /^Победа над (.+)$/, (m) => T('dbText.awBeat', { name: m[1] }))
            : kind === 'guardian'
              ? sub(subtitle, /^(\S+) · 4 недели$/, (m) => T('dbText.awGuardSub', { id: m[1] }))
              : kind === 'hot_sector' || kind === 'lightning'
                ? sub(subtitle, /^Сектор (\S+)$/, (m) => T('dbText.awSector', { id: m[1] }))
                : kind === 'night_watch'
                  ? sub(subtitle, /^1 неделя$/, () => T('dbText.awWeek1'))
                  : kind === 'season_legend'
                    ? sub(subtitle, /^(\d+) (?:неделя|недели|недель) подряд$/, (m) => tn('dbText.awWeeksRow', { count: Number(m[1]) }))
                    : null
  return out ?? subtitle
}

export function localAwardDescription(title: string, description: string): string {
  if (isRu() || !description) return description
  const kind = /^\d+ место$/.test(title) ? 'weekly_rank' : TITLE_KIND[title]
  const out =
    kind === 'weekly_rank'
      ? sub(description, /^Ты занял (\d+) место в рейтинге недели — (\d+) \S+ и (\d+) \S+\.$/, (m) =>
          T('dbText.awDescRank', { n: m[1], sectors: countPhrase(Number(m[2]), 'sector'), catches: countPhrase(Number(m[3]), 'catch') })
        )
      : kind === 'catch_of_month'
        ? (sub(description, /^Самый крупный зафиксированный улов на всём побережье за (.+)\.$/, (m) => T('dbText.awDescMonthOld', { month: monthName(m[1]) })) ??
          sub(description, /^Ты поймал самую крупную рыбу города за месяц — (.+), (\d+) см\.$/, (m) => T('dbText.awDescMonth', { species: localSpeciesNameLoose(m[1]), cm: m[2] })))
        : kind === 'clan_race_winner'
          ? sub(description, /^Клан «(.+)» победил в битве кланов недели (\S+)\.$/, (m) => T('dbText.awDescClan', { name: m[1], range: m[2] }))
          : kind === 'duelist'
            ? sub(description, /^Забрал сектор (\S+) у (.+), топ-3 прошлой недели\.$/, (m) => T('dbText.awDescDuel', { id: m[1], name: m[2] }))
            : kind === 'guardian'
              ? sub(description, /^Ты удержал сектор (\S+) четыре недели подряд/, (m) => T('dbText.awDescGuard', { id: m[1] }))
              : kind === 'hot_sector'
                ? sub(description, /^Удержал горячий сектор (\S+) до конца недели\.$/, (m) => T('dbText.awDescHot', { id: m[1] }))
                : kind === 'lightning'
                  ? T('dbText.awDescLightning')
                  : kind === 'night_watch'
                    ? sub(description, /— (\d+) \S+ с полуночи до пяти утра\.$/, (m) => T('dbText.awDescNight', { catches: countPhrase(Number(m[1]), 'catch') }))
                    : kind === 'season_legend'
                      ? description.startsWith('Ты был первым') ? T('dbText.awDescLegendNew') : T('dbText.awDescLegendOld')
                      : null
  return out ?? description
}

// ----- coin transactions -----

const SHOP_NAME = new Map<string, string>()
for (const ns of ['heroBg', 'skin', 'shopFrame', 'nameStyle'] as const) {
  for (const [k, v] of Object.entries(ru[ns] as Record<string, string>)) SHOP_NAME.set(v, `${ns}.${k}`)
}
const ACH_TITLE = new Map<string, string>()
for (const [k, v] of Object.entries(ru.ach as Record<string, string>)) if (k.endsWith('Title')) ACH_TITLE.set(v, `ach.${k}`)
const BUFF_NAME = new Map<string, string>()
for (const k of Object.keys(ru.dbText)) if (k.startsWith('buff_') && k.endsWith('_n')) BUFF_NAME.set((ru.dbText as unknown as Record<string, string>)[k], `dbText.${k}`)

// A shop item's name by its id (the ids are the dictionary keys of heroBg /
// skin / shopFrame / nameStyle); an id with no entry keeps the stored name.
export function localShopName(id: string, name: string): string {
  if (isRu()) return name
  const key = id.replace(/-/g, '_')
  for (const ns of ['heroBg', 'skin', 'shopFrame', 'nameStyle']) if (has(`${ns}.${key}`)) return T(`${ns}.${key}`)
  return name
}

export function localTxLabel(reason: string, label: string): string {
  if (isRu()) return label
  const exact: Record<string, string> = {
    admin_gift: 'txGift',
    admin_grant: 'txGrant',
    clan_create: 'txClanCreate',
    first_steps: 'txFirstSteps',
    referral_reward: 'txRefReward',
    treasury: 'txTreasury',
    welcome_bonus: 'txWelcome',
  }
  if (exact[reason]) return T(`dbText.${exact[reason]}`)
  const byMatch = (re: RegExp, fn: (m: RegExpExecArray) => string): string | null => sub(label, re, fn)
  let out: string | null = null
  switch (reason) {
    case 'buy_shield':
      out = byMatch(/^Щит на сектор · (\S+)$/, (m) => T('dbText.txShield', { id: m[1] }))
      break
    case 'catch_removed':
      out = byMatch(/^Улов удалён модератором: (.+)$/, (m) => T('dbText.txRemoved', { species: localSpeciesNameLoose(m[1]) }))
      break
    case 'clan_chest':
      out = byMatch(/^Сундук клана «(.+)»$/, (m) => T('dbText.txChest', { name: m[1] }))
      break
    case 'clan_race':
      out = byMatch(/^Битва кланов: (\d+)-е место$/, (m) => T('dbText.txRace', { place: tn('race.place', { rank: Number(m[1]) }) }))
      break
    case 'daily_reward':
      out = byMatch(/^Ежедневная награда · день (\d+)$/, (m) => T('dbText.txDaily', { day: m[1] }))
      break
    case 'geo_bonus':
      out = byMatch(/^Где это\? · улов в секторе (\S+)$/, (m) => T('dbText.txGeoBonus', { id: m[1] }))
      break
    case 'geo_guess':
      out = byMatch(/^Где это\? · угадан сектор (\S+)$/, (m) => T('dbText.txGeoGuess', { id: m[1] }))
      break
    case 'hot_sector_win':
      out = byMatch(/^Удержал горячий сектор (\S+)$/, (m) => T('dbText.txHotWin', { id: m[1] }))
      break
    case 'referral_welcome':
      out = byMatch(/^Бонус за приглашение от (.+)$/, (m) => T('dbText.txRefWelcome', { name: m[1] }))
      break
    case 'sector_capture':
      out = byMatch(/^Захват сектора (\S+)$/, (m) => T('dbText.txCapture', { id: m[1] }))
      break
    case 'slots_prize':
      out = byMatch(/^Слоты: (.+)$/, (m) => {
        const prize = m[1] === 'два одинаковых' ? T('dbText.txSlotsPair') : m[1] === 'три в ряд' ? T('dbText.txSlotsTriple') : /^(\d+) монет$/.test(m[1]) ? T('dbText.txSlotsCoins', { n: m[1].split(' ')[0] }) : m[1]
        return T('dbText.txSlots', { prize })
      })
      break
    case 'catch_reward':
      out = byMatch(/^«(.+)»$/, (m) => `«${localSpeciesNameLoose(m[1])}»`)
      break
    case 'achievement_reward': {
      const k = ACH_TITLE.get(label)
      out = k ? T(k) : null
      break
    }
    case 'challenge_reward':
      out = localChallengeName(label)
      break
    case 'buy_item':
    case 'admin_refund': {
      const k = SHOP_NAME.get(label)
      out = k ? T(k) : null
      break
    }
    case 'buy_buff':
    case 'buy_extra_challenge':
    case 'swap_challenge': {
      const k = BUFF_NAME.get(label)
      out = k ? T(k) : null
      break
    }
  }
  return out ?? label
}
