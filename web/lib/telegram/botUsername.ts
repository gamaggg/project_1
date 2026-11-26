// The bot's @username, asked of Telegram once per server instance (there is no env var holding it, and this keeps it
// from drifting out of sync with whatever bot the token belongs to). Server only.
let cached: string | null = null

export async function getBotUsername(): Promise<string | null> {
  if (cached) return cached
  const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`)
  if (!res.ok) return null
  const body = await res.json()
  cached = body?.result?.username ?? null
  return cached
}
