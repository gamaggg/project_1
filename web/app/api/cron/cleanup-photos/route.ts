import { NextResponse } from 'next/server'
import { isCronRequest } from '@/lib/cronAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { withErrorReport } from '@/lib/serverErrors'
import { deletePhotos, deleteR2Photos, findOrphanPhotos, findR2OrphanPhotos } from '@/lib/server/orphanPhotos'
import { listObjects, r2FromEnv } from '@/lib/server/r2'

// Nightly (pg_cron cleanup-photos, supabase-drafts/db-load-13-11/04_cleanup_photos_job.sql): deletes the catch
// photos no catch and no diary entry points at, older than two days (lib/server/orphanPhotos.ts). ~40 a week; at
// most PER_RUN a night, so a surprise is never a mass deletion — the rest waits for the next night.
export const maxDuration = 60

const PER_RUN = 200

type LimitsTable = {
  from: (t: 'service_limits_manual') => {
    upsert: (row: { key: string; used: number; limit_value: number; unit: string; period_start: null; period_end: null; enforced: boolean; as_of: string }) => PromiseLike<{ error: { message: string } | null }>
  }
}

async function handleGET(req: Request) {
  if (!isCronRequest(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const db = createAdminClient()
  const { files, used, orphans } = await findOrphanPhotos(db)
  const batch = orphans.slice(0, PER_RUN)
  await deletePhotos(db, batch.map((f) => f.path))
  const supabase = { files, used, deleted: batch.length, bytes: batch.reduce((s, f) => s + f.size, 0), left: orphans.length - batch.length }
  // Cloudflare R2 (lib/photoUrl.ts), once its keys are there: the same, a photo with its thumbnails.
  const r2 = r2FromEnv()
  if (!r2) return NextResponse.json({ supabase })
  const found = await findR2OrphanPhotos(db, r2)
  const r2Batch = found.orphans.slice(0, PER_RUN)
  await deleteR2Photos(r2, r2Batch.flatMap((o) => o.keys))
  // The whole bucket after the cleanup → «Лимиты сервисов» (lib/data/serviceLimits.ts r2_storage): the database
  // cannot see R2, so the number is written here once a night.
  const all = await listObjects(r2, '')
  const mb = Math.round((all.reduce((s, o) => s + o.size, 0) / 1048576) * 10) / 10
  const { error } = await (db as unknown as LimitsTable)
    .from('service_limits_manual')
    .upsert({ key: 'r2_storage', used: mb, limit_value: 10240, unit: 'mb', period_start: null, period_end: null, enforced: true, as_of: new Date().toISOString() })
  if (error) throw new Error(`service_limits_manual: ${error.message}`)
  return NextResponse.json({ supabase, r2: { files: found.files, deleted: r2Batch.length, bytes: r2Batch.reduce((s, o) => s + o.size, 0), left: found.orphans.length - r2Batch.length, storageMb: mb, objects: all.length } })
}

export const GET = withErrorReport('cron/cleanup-photos', handleGET)
