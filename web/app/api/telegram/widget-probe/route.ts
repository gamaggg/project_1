import { NextResponse } from 'next/server'
import { isCronRequest } from '@/lib/cronAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { withErrorReport } from '@/lib/serverErrors'

// «Are chat widgets back?» Telegram stopped letting general bots send HTML
// widgets on 13.11.2026 (tdlib/telegram-bot-api#947, sendWidget →
// 400 INPUT_MEDIA_WIDGET_NOT_ALLOWED), with no date for their return. pg_cron
// (`widget-probe`, once a day) calls this route: it tries a small widget to the
// super admins' chats with the bot. Refused — nothing happens. Accepted — they
// get the widget itself plus a message with what to switch on, and the job
// takes itself off the schedule (stop_widget_probe), so it says it once.
// See docs «Виджеты в чате бота — план».

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`

const PROBE_HTML =
  '<style>body{margin:0}.p{padding:16px 14px;font:15px/1.35 system-ui,sans-serif;color:#fff;text-align:center;' +
  'background:radial-gradient(120% 140% at 0% 0%,rgba(47,168,79,.45),rgba(0,0,0,0) 55%),linear-gradient(160deg,#1B1424,#0E1220)}' +
  '.p b{display:block;font-size:20px;font-weight:900;margin-top:6px}.p i{display:inline-block;width:46px;height:40px;' +
  'animation:j .8s cubic-bezier(.2,1.6,.4,1) both}@keyframes j{from{transform:scale(.3);opacity:0}}</style>' +
  '<div class="p"><i><svg viewBox="0 0 100 86.6" width="46" height="40"><polygon points="25,0 75,0 100,43.3 75,86.6 25,86.6 0,43.3" fill="#2FA84F"/>' +
  '<path d="M30 45l13 13 27-29" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/></svg></i>' +
  '<b>Виджеты снова работают</b></div>'

const NEXT_STEPS = (chatId: number) =>
  '✅ Telegram снова пускает виджеты от @catchrangebot — это сообщение пришло с проверки, которая шла раз в день.\n\n' +
  'Что сделать:\n' +
  `1. В Vercel → Settings → Environment Variables добавь TG_WIDGETS = all и TG_WIDGETS_CHATS = ${chatId} (только тебе), потом Redeploy.\n` +
  '2. Дождись своего уведомления (или напиши Claude «отправь пробные виджеты») и посмотри их на телефоне.\n' +
  '3. Всё хорошо — удали TG_WIDGETS_CHATS, и виджеты пойдут всем.\n\n' +
  'Проверка снята с расписания, больше этого сообщения не будет.'

async function tg(method: string, body: Record<string, unknown>) {
  const res = await fetch(`${TELEGRAM_API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15_000),
    body: JSON.stringify(body),
  })
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string }
  return { ok: res.ok && json.ok !== false, status: res.status, description: json.description ?? '' }
}

async function handleGET(req: Request) {
  if (!isCronRequest(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('telegram_id').eq('is_super_admin', true).not('telegram_id', 'is', null)
  const chats = ((data ?? []) as { telegram_id: number | null }[]).map((p) => p.telegram_id).filter((id): id is number => typeof id === 'number')
  if (!chats.length) return NextResponse.json({ checked: false, reason: 'no super admin with Telegram' })

  const first = await tg('sendWidget', { chat_id: chats[0], html: PROBE_HTML, caption: 'Проверка виджетов RANGE' })
  if (!first.ok) {
    // The expected answer while widgets are closed — nothing to report.
    return NextResponse.json({ allowed: false, status: first.status, description: first.description })
  }

  for (const [i, chatId] of chats.entries()) {
    if (i > 0) await tg('sendWidget', { chat_id: chatId, html: PROBE_HTML, caption: 'Проверка виджетов RANGE' })
    await tg('sendMessage', { chat_id: chatId, text: NEXT_STEPS(chatId) })
  }
  // Say it once: the daily job takes itself off the schedule.
  const loose = admin as unknown as { rpc: (f: string) => Promise<{ error: { message: string } | null }> }
  const { error } = await loose.rpc('stop_widget_probe')
  return NextResponse.json({ allowed: true, told: chats.length, unscheduled: !error, error: error?.message ?? null })
}

export const GET = withErrorReport('telegram/widget-probe', handleGET)
