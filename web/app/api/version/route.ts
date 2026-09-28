// The version this deployment was built from — a page loaded from an older
// deploy compares it with its own and reloads (see lib/appUpdate.ts).
export function GET() {
  return Response.json({ version: process.env.APP_VERSION ?? 'dev' }, { headers: { 'Cache-Control': 'no-store' } })
}
