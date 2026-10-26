import { timingSafeEqual } from 'crypto'

// The cron jobs in the database (pg_cron → net.http_get) call the /api/telegram/*
// routes with `Authorization: Bearer <CRON_SECRET>`. Two things the plain
// string comparison it replaces got wrong: with CRON_SECRET unset the expected
// value became «Bearer undefined», which anyone could send, and the comparison
// returned as soon as a character differed. An unset secret now refuses
// everything, and the comparison takes the same time whatever the guess.
export function isCronRequest(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const got = Buffer.from(req.headers.get('authorization') ?? '')
  const want = Buffer.from(`Bearer ${secret}`)
  return got.length === want.length && timingSafeEqual(got, want)
}
