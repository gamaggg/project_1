// Sends one chat widget (lib/telegram/widgets) with sample data to a Telegram
// chat, to see it on a phone before it goes to players:
//   node --no-warnings --import ./scripts/test-register.mjs scripts/send-test-widget.mjs <kind> <chat_id>
// kind: lost | attacked | race | forecast. The bot token is read from
// web/.env.local and never printed. The chat must have pressed /start in the bot.
import { readFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { sectorWidgetHtml, sectorChatData } from '@/lib/telegram/widgets/sector'
import { raceWidgetHtml, raceChatData } from '@/lib/telegram/widgets/race'
import { forecastWidgetHtml, forecastChatData } from '@/lib/telegram/widgets/forecast'
import { fetchRawForecast, nowInZone, scoreForecast } from '@/lib/forecast/bite'

const [kind = 'lost', chatId] = process.argv.slice(2)
if (!chatId) {
  console.error('usage: send-test-widget.mjs <lost|attacked|race|forecast> <chat_id>')
  process.exit(1)
}
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')])
)
const token = env.TELEGRAM_BOT_TOKEN
if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is not in web/.env.local')
  process.exit(1)
}

let html, chatData, caption
if (kind === 'minimal') {
  // The smallest request the docs show: chat_id and html only — to tell a bot-level refusal from one about our widget.
  const res = await fetch(`https://api.telegram.org/bot${token}/sendWidget`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, html: '<b>RANGE</b> test' }),
  })
  const body = await res.json().catch(() => ({}))
  console.log(res.ok ? `minimal sent, message_id ${body.result?.message_id}` : `minimal: Telegram ${res.status}: ${body.description ?? 'no description'}`)
  const me = await fetch(`https://api.telegram.org/bot${token}/getMe`).then((r) => r.json()).catch(() => ({}))
  const r = me.result ?? {}
  console.log('getMe flags:', JSON.stringify(Object.fromEntries(Object.entries(r).filter(([k]) => !['id', 'first_name', 'username'].includes(k)))))
  process.exit(0)
} else if (kind === 'lost' || kind === 'attacked') {
  html = sectorWidgetHtml('ru')
  chatData = sectorChatData({
    kind,
    sectorId: 'B1509',
    by: { name: 'Иван Рыбак', color: '#A855F7' },
    me: { name: 'gamag', color: '#FC5200' },
    defense: kind === 'attacked' ? 2 : 0,
    when: '07:42',
  })
  caption = kind === 'lost' ? '🧪 Тест виджета: «Сектор отбили»' : '🧪 Тест виджета: «Сектор атакуют»'
} else if (kind === 'race') {
  html = raceWidgetHtml('ru')
  const end = new Date()
  end.setUTCDate(end.getUTCDate() + ((7 - end.getUTCDay()) % 7 || 7))
  end.setUTCHours(20, 0, 0, 0)
  chatData = raceChatData({
    weekEnd: end.toISOString(),
    myClanId: 2,
    clans: [
      { id: 1, name: 'Щуки', primary: '#1F8A5B', secondary: '#FFFFFF', meters: 2020, finish: 2600, rank: 1, finished: false },
      { id: 2, name: 'Бычки', primary: '#FC5200', secondary: '#FFE7C2', meters: 1520, finish: 2000, rank: 2, finished: false },
      { id: 3, name: 'Ставрида', primary: '#1D6FC9', secondary: '#FFFFFF', meters: 1180, finish: 1600, rank: 3, finished: false },
    ],
  })
  caption = '🧪 Тест виджета: «Битва кланов»'
} else if (kind === 'forecast') {
  html = forecastWidgetHtml('ru')
  const raw = await fetchRawForecast({ lat: 41.6513, lng: 41.6325 }, 'Asia/Tbilisi', { lat: 41.66, lng: 41.58 })
  const days = scoreForecast(raw, null, nowInZone('Asia/Tbilisi', Date.now()))
  chatData = forecastChatData(days[1], 'ru', 'Батуми', `Завтра · ${new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short' }).format(new Date(`${days[1].date}T12:00:00`))}`)
  caption = `🧪 Тест виджета: «Прогноз клёва» — завтра ${days[1].score}/5`
} else {
  console.error(`unknown kind: ${kind}`)
  process.exit(1)
}

const bytes = Buffer.byteLength(html)
const packed = deflateSync(Buffer.from(html), { level: 9 }).length
const dataBytes = Buffer.byteLength(chatData)
console.log(`html ${bytes} B, zlib-9 ${packed} B (limit 4096), chat_data ${dataBytes} B (limit 1024)`)
if (packed > 4096 || dataBytes > 1024) {
  console.error('too large for Telegram, not sent')
  process.exit(1)
}

const res = await fetch(`https://api.telegram.org/bot${token}/sendWidget`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    chat_id: chatId,
    html,
    chat_data: chatData,
    caption,
    allow_queries: false,
    reply_markup: { inline_keyboard: [[{ text: 'Открыть RANGE', web_app: { url: 'https://catchrange.com' } }]] },
  }),
})
const body = await res.json().catch(() => ({}))
console.log(res.ok ? `sent, message_id ${body.result?.message_id}` : `Telegram ${res.status}: ${body.description ?? 'no description'}`)
