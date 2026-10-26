import { NextResponse } from 'next/server'
import { withErrorReport } from '@/lib/serverErrors'
import { createAdminClient } from '@/lib/supabase/admin'

// Proxies to Fishial (fishial.ai) so FISHIAL_API_KEY/SECRET never reach the
// client — the browser only ever talks to this route, never to
// api-recognition.fishial.ai directly. Species suggestion is a best-effort
// extra (see ConfirmScreen/fishial.ts): any failure here — bad credentials,
// exhausted monthly credits, network error — degrades to no suggestion
// rather than an error, so it can never block recording a catch.

const FISHIAL_BASE = 'https://api-recognition.fishial.ai'

let cachedToken: { value: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value

  const res = await fetch(`${FISHIAL_BASE}/v2/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.FISHIAL_API_KEY,
      client_secret: process.env.FISHIAL_API_SECRET,
    }),
  })
  if (!res.ok) throw new Error(`fishial auth failed: ${res.status}`)
  const data = await res.json()
  const token = data.access_token as string
  // Refresh a little early (55s of the real 600s TTL) to avoid edge-of-expiry 401s.
  cachedToken = { value: token, expiresAt: Date.now() + 55_000 }
  return token
}

async function handlePOST(request: Request) {
  try {
    // Signed-in players only: every call spends one of the app's shared
    // Fishial credits, so an open route let anyone burn them (and our
    // bandwidth) with a loop. The app sends its session token, as the
    // Telegram link route does.
    const accessToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!accessToken) return NextResponse.json({ candidates: [] }, { status: 401 })
    const { data: auth } = await createAdminClient().auth.getUser(accessToken)
    if (!auth.user) return NextResponse.json({ candidates: [] }, { status: 401 })

    const contentType = request.headers.get('content-type') ?? 'image/jpeg'
    const imageBytes = await request.arrayBuffer()
    // A catch photo is ~350 KB (1600 px JPEG); 8 MB is generous.
    if (imageBytes.byteLength === 0 || imageBytes.byteLength > 8 * 1024 * 1024) {
      return NextResponse.json({ candidates: [] })
    }

    const token = await getAccessToken()
    const res = await fetch(`${FISHIAL_BASE}/v2/recognize`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType },
      body: imageBytes,
    })

    if (!res.ok) {
      // credits_insufficient and any other API-side error: no suggestion, no throw.
      return NextResponse.json({ candidates: [] })
    }

    // Real shape (verified against the live API — the docs' summary didn't
    // match): objects[0].species is a ranked [{id, certainty}] list, and the
    // actual name lives in definitions[id]. Only the first detected fish
    // object is used — a photo with multiple fish just suggests for one.
    const data: {
      objects?: { species?: { id: string; certainty: number }[] }[]
      definitions?: Record<string, { commonName?: string; scientificName?: string }>
    } = await res.json()
    const topSpecies = data.objects?.[0]?.species ?? []
    const definitions = data.definitions ?? {}
    const candidates = topSpecies.slice(0, 3).map(({ id, certainty }) => ({
      scientificName: definitions[id]?.scientificName ?? '',
      confidence: certainty,
    }))
    return NextResponse.json({ candidates })
  } catch {
    return NextResponse.json({ candidates: [] })
  }
}

export const POST = withErrorReport('recognize-fish', handlePOST)
