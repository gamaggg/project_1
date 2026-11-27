import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { withErrorReport } from '@/lib/serverErrors'
import { VIDEO_BUCKET, tokenMatches } from '@/lib/videoJobs'

// The Mac that edits the owner's videos asks here for a one-time address to upload the finished video to the storage
// (the file is bigger than a serverless request may be, so it goes to the storage directly). The job's own token is the key.
async function handleGET(req: Request) {
  const url = new URL(req.url)
  const id = Number(url.searchParams.get('job'))
  const admin = createAdminClient()
  const { data: job } = Number.isFinite(id) ? await admin.from('video_jobs').select('id, token, status').eq('id', id).maybeSingle() : { data: null }
  if (!job || !tokenMatches(job.token, url.searchParams.get('t')) || job.status === 'done') return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const path = `out/${job.id}-${randomUUID()}.mp4`
  const { data, error } = await admin.storage.from(VIDEO_BUCKET).createSignedUploadUrl(path)
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'no slot' }, { status: 500 })
  return NextResponse.json({ path, url: data.signedUrl })
}

export const GET = withErrorReport('social-bot/video-slot', handleGET)
