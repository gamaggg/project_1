// «Лимиты сервисов» (экран админа): перевод цифр из get_service_limits на человеческий язык.
// Русский, как и остальные админские экраны. Сами лимиты тарифов сверены 12.10.2026, см. docs/50 Эксплуатация/Лимиты сервисов.md.

export type LimitUnit = 'mb' | 'count' | 'seconds' | 'minutes' | 'gbh'

export type LimitRow = {
  key: string
  source: 'live' | 'estimate' | 'manual'
  unit: LimitUnit
  used: number
  limit: number | null
  rate_per_day?: number
  detail?: unknown
  period_start?: string | null
  period_end?: string | null
  enforced?: boolean
  as_of?: string
}

export type ServiceLimits = { now: string; items: LimitRow[] }

export type ServiceId = 'supabase' | 'vercel' | 'mapbox' | 'fishial' | 'openmeteo' | 'telegram'

export const SERVICES: { id: ServiceId; name: string; about: string }[] = [
  { id: 'supabase', name: 'Supabase', about: 'Наш склад: здесь хранятся игроки, уловы, сектора, монеты и все фотографии.' },
  { id: 'vercel', name: 'Vercel', about: 'Наш хостинг: на нём живёт сайт catchrange.com и серверный код приложения. Считает за последние 30 дней.' },
  { id: 'mapbox', name: 'Mapbox', about: 'Карта: подложка с водой и берегами и маленькие картинки секторов.' },
  { id: 'fishial', name: 'Fishial', about: 'Узнаёт породу рыбы по фотографии улова.' },
  { id: 'openmeteo', name: 'Open-Meteo', about: 'Погода: ветер, давление и температура для карточки улова и прогнозов.' },
  { id: 'telegram', name: 'Telegram-бот', about: 'Бот @catchrangebot присылает игрокам уведомления.' },
]

// kind: 'fills' копится и не сбрасывается (место, вместе с ростом считаем дату, когда кончится);
//       'month' копится за расчётный месяц и в день сброса обнуляется (считаем, сколько будет к концу месяца);
//       'level' показывает текущую загрузку, прогноза по дате нет (максимум в моменте, окно в 30 дней или оценка).
type Kind = 'fills' | 'month' | 'level'

type Entry = {
  service: ServiceId
  title: string
  what: string
  ifFull: string
  kind: Kind
}

const CATALOG: Record<string, Entry> = {
  storage_files: {
    service: 'supabase', kind: 'fills',
    title: 'Место для фотографий',
    what: 'Все фото уловов, аватарки, панорамы «Где это?» и картинки постов лежат здесь. Это самое «тесное» место: оно только растёт.',
    ifFull: 'Новые фото перестанут загружаться, а значит игрок не сможет сохранить улов. Это самое неприятное, что может случиться.',
  },
  database: {
    service: 'supabase', kind: 'level',
    title: 'Место для данных игры',
    what: 'Игроки, уловы, сектора, монеты, переписка в кланах, история действий. Сами записи занимают мало, но копится техническая история.',
    ifFull: 'База перестанет принимать новые записи: не сохранятся уловы и покупки.',
  },
  connections: {
    service: 'supabase', kind: 'level',
    title: 'Одновременные обращения к базе',
    what: 'Сколько «разговоров» с базой идёт прямо сейчас. Каждый открытый запрос занимает одну линию, всего линий немного.',
    ifFull: 'Часть игроков будет видеть ошибки загрузки, пока линии не освободятся.',
  },
  supabase_egress: {
    service: 'supabase', kind: 'month',
    title: 'Скачано игроками за месяц',
    what: 'Сколько данных телефоны игроков скачали у нас: фото, карточки, списки. Считается за расчётный месяц (с 3-го по 3-е) и в день сброса обнуляется.',
    ifFull: 'Supabase может ограничить проект, и приложение начнёт тормозить или не откроет фото. Лечится сжатием фото или платным тарифом.',
  },
  supabase_cached_egress: {
    service: 'supabase', kind: 'month',
    title: 'Скачано из быстрой памяти',
    what: 'То же самое, но те фото, которые уже скачивали раньше и они лежат в быстрой памяти (кэше) ближе к игроку. Это дешёвый трафик, лимит у него отдельный.',
    ifFull: 'Как и у обычного трафика: возможны ограничения проекта.',
  },
  supabase_logs: {
    service: 'supabase', kind: 'month',
    title: 'Технические журналы',
    what: 'Supabase записывает, что происходит на сервере, чтобы можно было найти причину сбоя. Это не данные игры.',
    ifFull: 'Сейчас лимит превышен, но Supabase его пока не применяет. Обещают включить с 2027 года: тогда журналы придётся ужимать или платить.',
  },
  supabase_mau: {
    service: 'supabase', kind: 'month',
    title: 'Активные игроки за месяц',
    what: 'Сколько разных людей заходило в приложение с аккаунтом за расчётный месяц. Лимит на бесплатном тарифе очень большой.',
    ifFull: 'Новые игроки не смогли бы входить. До этого далеко.',
  },
  supabase_realtime_peak: {
    service: 'supabase', kind: 'level',
    title: 'Игроки онлайн в живых обновлениях',
    what: 'Живые обновления (например, чат клана) держат открытое соединение. Здесь максимум таких соединений одновременно за месяц.',
    ifFull: 'Новые игроки не получали бы чат и обновления в реальном времени, пока кто-то не выйдет.',
  },
  supabase_realtime_msgs: {
    service: 'supabase', kind: 'month',
    title: 'Сообщения живых обновлений',
    what: 'Сколько раз за месяц сервер «проталкивал» игрокам новость без перезагрузки: сообщение в чате, новый улов и так далее.',
    ifFull: 'Живые обновления остановились бы до начала следующего месяца.',
  },
  vercel_data_transfer: {
    service: 'vercel', kind: 'level',
    title: 'Сколько данных отдал сайт',
    what: 'Объём страниц, скриптов и картинок самого сайта, которые получили игроки за 30 дней. Фото уловов сюда не входят, они хранятся в Supabase.',
    ifFull: 'Сайт мог бы приостановиться до освобождения лимита.',
  },
  vercel_origin_transfer: {
    service: 'vercel', kind: 'level',
    title: 'Обмен сайта с нашим сервером',
    what: 'Сколько данных ушло между быстрой раздачей сайта и нашим кодом. Чем лучше работает кэш, тем меньше это число.',
    ifFull: 'Как и выше: Vercel мог бы приостановить сайт.',
  },
  vercel_requests: {
    service: 'vercel', kind: 'level',
    title: 'Сколько раз открывали наш сайт',
    what: 'Каждое обращение к сайту: открыли страницу, загрузился файл, картинка или иконка. Один заход игрока даёт десяток таких обращений.',
    ifFull: 'Vercel приостановил бы сайт до конца окна в 30 дней.',
  },
  vercel_functions: {
    service: 'vercel', kind: 'level',
    title: 'Запуски серверного кода',
    what: 'Каждый раз, когда приложение просит сервер что-то сделать: распознать рыбу, узнать погоду, отправить уведомление, подтвердить вход.',
    ifFull: 'Эти функции перестали бы работать: не было бы распознавания, погоды и уведомлений.',
  },
  vercel_cpu: {
    service: 'vercel', kind: 'level',
    title: 'Время работы серверного кода',
    what: 'Сколько реального времени за 30 дней процессор считал наши задачи. Время ожидания ответов не считается.',
    ifFull: 'Серверные функции остановились бы, как и при нехватке запусков.',
  },
  vercel_memory: {
    service: 'vercel', kind: 'level',
    title: 'Память серверного кода',
    what: 'Сколько оперативной памяти и как долго занимал наш серверный код. Единица «ГБ·ч»: один гигабайт, занятый один час.',
    ifFull: 'Серверные функции остановились бы.',
  },
  vercel_builds: {
    service: 'vercel', kind: 'level',
    title: 'Время на выкладку обновлений',
    what: 'Каждый раз, когда мы выкладываем новую версию, Vercel собирает сайт заново. Здесь суммарное время всех сборок за 30 дней.',
    ifFull: 'Мы не смогли бы выложить новые версии, пока не освободится лимит. Игроки продолжали бы пользоваться текущей.',
  },
  vercel_analytics: {
    service: 'vercel', kind: 'level',
    title: 'Статистика посещений Vercel',
    what: 'События встроенной аналитики Vercel (просмотры страниц сайта). Наша собственная «Статистика» в профиле считается отдельно.',
    ifFull: 'Аналитика Vercel перестала бы собирать данные. На игру это не влияет.',
  },
  mapbox_loads: {
    service: 'mapbox', kind: 'level',
    title: 'Показы карты',
    what: 'Сколько раз за месяц загружается сама карта: считаем по числу открытий приложения. Это оценка, у Mapbox мы не смотрим.',
    ifFull: 'Карта перестала бы показываться, пока не начнётся новый месяц или мы не перейдём на платный тариф.',
  },
  mapbox_tiles: {
    service: 'mapbox', kind: 'level',
    title: 'Картинки секторов',
    what: 'Маленькие картинки карты для окна сектора и подсказок «Где это?». Считаем по числу открытий сектора, браузер часть картинок запоминает, поэтому реально меньше.',
    ifFull: 'В окне сектора перестала бы показываться миниатюра карты.',
  },
  fishial: {
    service: 'fishial', kind: 'level',
    title: 'Распознавание рыбы по фото',
    what: 'Сколько раз за месяц игроки открывали форму улова, где приложение просит Fishial угадать породу. Счётчик лимита у Fishial мы не видим.',
    ifFull: 'Подсказки породы пропали бы: игроки выбирали бы рыбу вручную. Ошибки при этом не показываются, поэтому следим по цифре.',
  },
  open_meteo: {
    service: 'openmeteo', kind: 'level',
    title: 'Запросы погоды за сутки',
    what: 'Сколько раз в сутки мы спрашиваем погоду: для каждого улова и для регулярных прогнозов. Лимит считается по дням.',
    ifFull: 'Погода в уловах временно не загружалась бы до следующих суток.',
  },
  telegram: {
    service: 'telegram', kind: 'level',
    title: 'Уведомления в Telegram',
    what: 'Сообщения, которые бот отправил игрокам за сутки. Лимит Telegram (около 30 сообщений в секунду) нам не грозит, важнее, чтобы сообщения не застревали в очереди.',
    ifFull: 'Уведомления приходили бы с задержкой.',
  },
}

export function limitTitle(key: string) {
  return CATALOG[key]?.title ?? key
}

export function limitService(key: string): ServiceId | null {
  return CATALOG[key]?.service ?? null
}

export function limitText(key: string) {
  const e = CATALOG[key]
  return e ? { what: e.what, ifFull: e.ifFull } : { what: '', ifFull: '' }
}

export const BUCKET_NAMES: Record<string, string> = {
  'catch-photos': 'Фото уловов',
  'geo-panoramas': 'Панорамы «Где это?»',
  'announcement-photos': 'Картинки постов',
  avatars: 'Аватарки',
  support: 'Поддержка',
}

// ---- числа человеческим языком -----------------------------------------------------------

function dec(n: number, digits = 1) {
  return n.toLocaleString('ru-RU', { maximumFractionDigits: digits, minimumFractionDigits: 0 })
}

export function formatAmount(unit: LimitUnit, v: number): string {
  if (unit === 'mb') return v >= 1024 ? `${dec(v / 1024, 2)} ГБ` : `${dec(v, 0)} МБ`
  if (unit === 'seconds' || unit === 'minutes') {
    const totalMin = unit === 'seconds' ? Math.round(v / 60) : Math.round(v)
    const h = Math.floor(totalMin / 60)
    const m = totalMin % 60
    return h > 0 ? `${h} ч ${m} мин` : `${m} мин`
  }
  if (unit === 'gbh') return `${dec(v, 1)} ГБ·ч`
  if (v >= 1_000_000) return `${dec(v / 1_000_000, 1)} млн`
  if (v >= 10_000) return `${dec(v / 1000, 0)} тыс.`
  return dec(v, 0)
}

export function formatDay(d: Date) {
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

function daysBetween(from: string, to: string) {
  return (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000
}

// ---- вердикт: зелёный, жёлтый, красный и фраза для человека -------------------------------

export type Level = 'ok' | 'warn' | 'bad' | 'info'

export type Verdict = {
  level: Level
  pct: number | null
  headline: string
  note?: string
}

function byPct(pct: number): Level {
  return pct >= 80 ? 'bad' : pct >= 50 ? 'warn' : 'ok'
}

export function evaluate(row: LimitRow, now: string): Verdict {
  const entry = CATALOG[row.key]
  const kind: Kind = entry?.kind ?? 'level'
  const nowMs = new Date(now).getTime()

  // Telegram: смотрим только на застрявшие сообщения.
  if (row.key === 'telegram') {
    const stuck = Number((row.detail as { stuck?: number } | undefined)?.stuck ?? 0)
    return stuck > 0
      ? { level: 'bad', pct: null, headline: `Застряло сообщений: ${stuck}`, note: 'Очередь не разбирается больше 15 минут.' }
      : { level: 'ok', pct: null, headline: `Всё доходит вовремя: за сутки ${formatAmount('count', row.used)} сообщ.` }
  }

  if (row.limit == null) {
    return { level: 'info', pct: null, headline: `Примерно ${formatAmount(row.unit, row.used)} в месяц`, note: 'Предела нет в нашем видимом счётчике: смотрим только на динамику.' }
  }

  const pct = (row.used / row.limit) * 100

  if (kind === 'fills') {
    const rate = row.rate_per_day ?? 0
    if (rate > 0 && row.used < row.limit) {
      const days = (row.limit - row.used) / rate
      const date = new Date(nowMs + days * 86_400_000)
      const level: Level = days < 21 ? 'bad' : days < 60 ? 'warn' : 'ok'
      const headline = days > 365 ? 'Хватит больше чем на год' : `Место закончится примерно ${formatDay(date)}`
      return { level, pct, headline, note: `Через ${Math.round(days)} дн. при нынешнем росте: +${formatAmount(row.unit, rate)} в сутки.` }
    }
    return { level: byPct(pct), pct, headline: pct >= 100 ? 'Место кончилось' : 'Почти не растёт, места хватает' }
  }

  if (kind === 'month' && row.period_start && row.period_end && row.as_of) {
    const elapsed = Math.max(1, daysBetween(row.period_start, row.as_of))
    const total = daysBetween(row.period_start, row.period_end)
    const perDay = row.used / elapsed
    const forecast = perDay * total
    const forecastPct = (forecast / row.limit) * 100
    const endDay = formatDay(new Date(row.period_end))
    if (row.enforced === false) {
      return {
        level: 'warn', pct,
        headline: `Уже ${dec(pct, 0)}% от лимита, но он пока не действует`,
        note: 'Supabase обещает включить ограничение с 2027 года. До тех пор ничего не ломается.',
      }
    }
    if (forecastPct >= 100 && row.used < row.limit) {
      const hit = new Date(new Date(row.period_start).getTime() + (row.limit / perDay) * 86_400_000)
      return { level: 'bad', pct, headline: `Лимит кончится примерно ${formatDay(hit)}, до сброса ${endDay}`, note: `К ${endDay} набралось бы около ${dec(forecastPct, 0)}%.` }
    }
    if (row.used >= row.limit) return { level: 'bad', pct, headline: `Лимит исчерпан, сбросится ${endDay}` }
    const level = byPct(forecastPct)
    return {
      level, pct,
      headline:
        forecastPct < 1
          ? 'Запас огромный: использовано меньше 1%'
          : level === 'ok'
            ? `Запас большой: к ${endDay} будет около ${dec(forecastPct, 0)}%`
            : `К ${endDay} выйдет около ${dec(forecastPct, 0)}% лимита`,
      note: `Сейчас ${dec(pct, 0)}%. Это прогноз по тому, как шёл месяц.`,
    }
  }

  const level = byPct(pct)
  const headline = level === 'ok' ? `Запас большой: занято ${dec(pct, 0)}%` : level === 'warn' ? `Занято уже ${dec(pct, 0)}%, стоит следить` : `Занято ${dec(pct, 0)}%, почти предел`
  return { level, pct, headline }
}

export function summarize(rows: LimitRow[], now: string) {
  const verdicts = rows.map((r) => ({ row: r, v: evaluate(r, now) }))
  return {
    verdicts,
    bad: verdicts.filter((x) => x.v.level === 'bad'),
    warn: verdicts.filter((x) => x.v.level === 'warn'),
  }
}

export function sourceLabel(row: LimitRow, now: string): { text: string; stale: boolean } {
  if (row.source === 'live') return { text: 'Считаем прямо сейчас по нашей базе.', stale: false }
  if (row.source === 'estimate') return { text: 'Оценка по активности игроков за неделю. Самого счётчика у сервиса мы не видим.', stale: false }
  const days = row.as_of ? daysBetween(row.as_of, now) : 0
  const when = row.as_of ? formatDay(new Date(row.as_of)) : '—'
  return {
    text: `Цифра из панели сервиса на ${when}. Обновляется командой «проверь лимиты».`,
    stale: days > 7,
  }
}
