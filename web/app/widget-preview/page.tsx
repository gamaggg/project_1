import { notFound } from 'next/navigation'
import { deflateSync } from 'node:zlib'
import { sectorChatData, sectorWidgetHtml } from '@/lib/telegram/widgets/sector'
import { raceChatData, raceWidgetHtml, type RaceLane } from '@/lib/telegram/widgets/race'
import { forecastChatData, forecastWidgetHtml } from '@/lib/telegram/widgets/forecast'
import { fetchRawForecast, nowInZone, scoreForecast } from '@/lib/forecast/bite'
import { ratingChatData, ratingWidgetHtml } from '@/lib/telegram/widgets/rating'
import { dailyChatData, dailyWidgetHtml } from '@/lib/telegram/widgets/daily'
import { hotChatData, hotWidgetHtml } from '@/lib/telegram/widgets/hot'
import { catchesChatData, catchesWidgetHtml, type SeriesCatch } from '@/lib/telegram/widgets/catches'
import { WidgetPreview, type PreviewItem } from './WidgetPreview'

// The Telegram chat widgets (lib/telegram/widgets) as they will look in a
// message, with made-up players: /widget-preview. Development only — not part
// of the product. Each widget runs in its own frame with a stand-in for
// Telegram's TelegramWidget object (chatData, request answered after 0.6 s).
export const dynamic = 'force-dynamic'

const zipped = (html: string) => deflateSync(Buffer.from(html), { level: 9 }).length

// Tomorrow's real forecast for Batumi (null when Open-Meteo doesn't answer).
async function sampleForecast(): Promise<string | null> {
  try {
    const raw = await fetchRawForecast({ lat: 41.6513, lng: 41.6325 }, 'Asia/Tbilisi', { lat: 41.66, lng: 41.58 })
    const days = scoreForecast(raw, null, nowInZone('Asia/Tbilisi', Date.now()))
    const dm = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short' }).format(new Date(`${days[1].date}T12:00:00`))
    return forecastChatData(days[1], 'ru', 'Батуми', `Завтра · ${dm}`)
  } catch {
    return null
  }
}

// The coming Sunday 20:00 UTC — Monday 00:00 in Batumi, when the battle ends.
function nextWeekEnd(): Date {
  const end = new Date()
  end.setUTCDate(end.getUTCDate() + ((7 - end.getUTCDay()) % 7 || 7))
  end.setUTCHours(20, 0, 0, 0)
  return end
}

export default async function Page() {
  if (process.env.NODE_ENV === 'production') notFound()

  const sector = sectorWidgetHtml('ru')
  const race = raceWidgetHtml('ru')
  const forecast = forecastWidgetHtml('ru')
  const end = nextWeekEnd()
  const lanes: RaceLane[] = [
    { id: 1, name: 'Щуки', primary: '#1F8A5B', secondary: '#FFFFFF', meters: 2020, finish: 2600, rank: 1, finished: false },
    { id: 2, name: 'Бычки', primary: '#FC5200', secondary: '#FFE7C2', meters: 1520, finish: 2000, rank: 2, finished: false },
    { id: 3, name: 'Ставрида', primary: '#1D6FC9', secondary: '#FFFFFF', meters: 1180, finish: 1600, rank: 3, finished: false },
  ]
  // What the bot answers when the race widget appears: «Бычки» caught up since the message.
  const raceLater = raceChatData({ weekEnd: end.toISOString(), myClanId: 2, clans: [{ ...lanes[0], rank: 2 }, { ...lanes[1], meters: 1900, rank: 1 }, lanes[2]] })

  const forecastData = await sampleForecast()

  const items: PreviewItem[] = [
    {
      id: 'lost',
      title: 'Сектор отбили',
      html: sector,
      zipped: zipped(sector),
      chatData: sectorChatData({ kind: 'lost', sectorId: 'B1509', by: { name: 'Иван Рыбак', color: '#A855F7' }, me: { name: 'gamag', color: '#FC5200' }, defense: 0, when: '07:42' }),
      answer: JSON.stringify({ n: 'Иван Рыбак', d: 1, m: 0 }),
      caption: '⚔️ Иван Рыбак отбил твой сектор B1509. Лови там рыбу: каждый улов снимает защиту.',
      button: 'Открыть сектор',
    },
    {
      id: 'attacked',
      title: 'Сектор атакуют',
      html: sector,
      zipped: zipped(sector),
      chatData: sectorChatData({ kind: 'attacked', sectorId: 'B1509', by: { name: 'Иван Рыбак', color: '#A855F7' }, me: { name: 'gamag', color: '#FC5200' }, defense: 2, when: '07:42' }),
      answer: JSON.stringify({ m: 1 }),
      caption: '⚔️ Иван Рыбак атакует твой сектор B1509 — защита 2 из 3. Поймай там рыбу, чтобы укрепить защиту.',
      button: 'Открыть сектор',
    },
    {
      id: 'race',
      title: 'Битва кланов',
      html: race,
      zipped: zipped(race),
      chatData: raceChatData({ weekEnd: end.toISOString(), myClanId: 2, clans: lanes }),
      answer: raceLater,
      caption: '«Бычки» обогнали в битве кланов — теперь 2-е место, впереди «Щуки»',
      button: 'Открыть битву кланов',
    },
    ...(forecastData
      ? [
          {
            id: 'forecast',
            title: 'Прогноз клёва (настоящий, Батуми на завтра)',
            html: forecast,
            zipped: zipped(forecast),
            chatData: forecastData,
            answer: 'null',
            caption: '🎣 Завтра в Батуми хороший клёв.',
            button: 'Открыть прогноз',
          },
        ]
      : []),
  ]
  const rating = ratingWidgetHtml('ru')
  const daily = dailyWidgetHtml('ru')
  const hot = hotWidgetHtml('ru')
  const catches = catchesWidgetHtml('ru')
  const top = [
    { rank: 1, name: 'Тимур А.', sectors: 14, catches: 31, me: false },
    { rank: 2, name: 'Нино Г.', sectors: 11, catches: 22, me: false },
    { rank: 3, name: 'Дима К.', sectors: 9, catches: 25, me: false },
  ]
  const run: SeriesCatch[] = [
    { species: 'Скорпена', meta: '31 см', time: '09:12', category: 'marine' },
    { species: 'Ставрида', meta: '', time: '08:47', category: 'marine' },
    { species: 'Ставрида', meta: '24 см · 180 г', time: '08:30', category: 'marine' },
  ]
  items.push(
    {
      id: 'rating',
      title: 'Тебя обогнали в рейтинге',
      html: rating,
      zipped: zipped(rating),
      chatData: ratingChatData({ lastWeek: false, weekLabel: 'Ноябрь, 3 неделя', top, rows: [
        { rank: 10, name: 'Ольга С.', sectors: 4, catches: 9, me: false },
        { rank: 11, name: 'gamag', sectors: 4, catches: 7, me: true },
        { rank: 12, name: 'Гоша П.', sectors: 3, catches: 12, me: false },
      ] }),
      answer: 'null',
      caption: 'Тебя обогнали в рейтинге недели — теперь ты на 11-м месте, впереди Ольга С. Верни своё место!',
      button: 'Открыть рейтинг',
    },
    {
      id: 'weekly',
      title: 'Итоги недели',
      html: rating,
      zipped: zipped(rating),
      chatData: ratingChatData({ lastWeek: true, weekLabel: 'Ноябрь, 2 неделя', top, rows: [
        { rank: 4, name: 'Ольга С.', sectors: 7, catches: 14, me: false },
        { rank: 6, name: 'gamag', sectors: 5, catches: 11, me: true },
      ] }),
      answer: 'null',
      caption: 'Итоги недели: 6 место — 5 секторов, 11 уловов',
      button: 'Смотреть итоги',
    },
    {
      id: 'daily',
      title: 'Ежедневная награда',
      html: daily,
      zipped: zipped(daily),
      chatData: dailyChatData(4, [10, 15, 20, 25, 30, 35, 40, 50, 60, 100], false),
      answer: 'null',
      caption: '🎁 Ежедневная награда ждёт: день 4 из 10 — 25 монет. Забери до полуночи, чтобы не прервать серию.',
      button: 'Забрать награду',
    },
    {
      id: 'hot',
      title: 'Горячие сектора недели',
      html: hot,
      zipped: zipped(hot),
      chatData: hotChatData([
        { id: 'B1432', holder: 'other', name: 'Ольга С.', color: '#C2410C' },
        { id: 'B1433', holder: 'free', name: null, color: null },
      ], 'вс, 23:59'),
      answer: 'null',
      caption: '🔥 Горячие сектора недели в Батуми: B1432 и B1433.',
      button: 'Открыть сектор',
    },
    {
      id: 'follow',
      title: 'Улов друга (через 0,6 с «бот» добавляет новый улов)',
      html: catches,
      zipped: zipped(catches),
      chatData: catchesChatData({ who: 'Ольга С.', sectorId: 'B1432', kind: 'Море', claimed: false, when: 'Сегодня · 08:30–09:12', items: run, catchId: 7 }),
      answer: catchesChatData({ who: 'Ольга С.', sectorId: 'B1432', kind: 'Море', claimed: true, when: 'Сегодня · 08:30–09:40', items: [{ species: 'Барабуля', meta: '18 см', time: '09:40', category: 'marine' }, ...run], catchId: 7 }),
      caption: 'Ольга С. поймала рыбу на секторе B1432',
      button: 'Посмотреть улов',
    },
    {
      id: 'fishing',
      title: 'Ещё на рыбалке?',
      html: catches,
      zipped: zipped(catches),
      chatData: catchesChatData({ who: 'gamag', sectorId: 'B1509', kind: 'Море', claimed: true, when: 'Сегодня · 06:40–08:12', items: [
        { species: 'Ставрида', meta: '22 см', time: '08:12', category: 'marine' },
        { species: 'Скорпена', meta: '', time: '07:30', category: 'marine' },
        { species: 'Ставрида', meta: '', time: '06:40', category: 'marine' },
      ] }),
      answer: 'null',
      caption: '🎣 Ещё на рыбалке? Последний улов — в 08:12, сегодня уже 3 улова. Поймаешь ещё — сразу сфоткай в RANGE, и сектор будет твоим.',
      button: '📷 Сфоткать улов',
    }
  )
  return <WidgetPreview items={items} />
}
