import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { processFishingSessions } from '@/lib/telegram/fishing'

// «Я на рыбалке» — see lib/telegram/fishing.ts.
// GET: pg_cron every 5 minutes (Bearer CRON_SECRET) — pins new sessions,
// sends reminders, closes finished ones for everyone.
// POST: the app right after the player starts or stops, for just them, so
// the pinned message appears (or comes off) at once instead of within 5 min.

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    return NextResponse.json(await processFishingSessions())
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  try {
    return NextResponse.json(await processFishingSessions({ userId: user.id }))
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
