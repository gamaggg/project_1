import { NextResponse } from 'next/server'
import { runFishingReminders } from '@/lib/telegram/fishing'
import { withErrorReport } from '@/lib/serverErrors'

// «Ещё на рыбалке?» — see lib/telegram/fishing.ts. pg_cron every 5 minutes
// (Bearer CRON_SECRET): opens today's fishing day on the first catch and
// sends the reminders that are due. ?dry=1 — nothing written or sent, just
// who would be reminded right now.
async function handleGET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    return NextResponse.json(await runFishingReminders({ dryRun: new URL(req.url).searchParams.get('dry') === '1' }))
  } catch (err) {
    // A database error is a plain object, not an Error — String() of it was
    // «[object Object]» in the alert.
    const message = err instanceof Error ? err.message : ((err as { message?: string } | null)?.message ?? String(err))
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const GET = withErrorReport('telegram/fishing', handleGET)
