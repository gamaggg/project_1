import { createHmac, timingSafeEqual } from 'crypto'

export type TelegramUser = {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
}

const MAX_AGE_SECONDS = 24 * 60 * 60

// Verifies Telegram's WebApp initData per their documented algorithm
// (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app).
// Never trust `initData` without this — it's the only thing standing
// between "anyone can claim to be any Telegram user" and real auth.
export function verifyTelegramInitData(initData: string, botToken: string): TelegramUser | null {
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return null
  params.delete('hash')

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const computedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  const a = Buffer.from(computedHash, 'hex')
  const b = Buffer.from(hash, 'hex')
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  const authDate = Number(params.get('auth_date'))
  if (!authDate || Date.now() / 1000 - authDate > MAX_AGE_SECONDS) return null

  const userJson = params.get('user')
  if (!userJson) return null
  try {
    return JSON.parse(userJson) as TelegramUser
  } catch {
    return null
  }
}
