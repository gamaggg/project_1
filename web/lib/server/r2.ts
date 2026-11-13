import { createHash, createHmac } from 'node:crypto'

// Cloudflare R2 through its S3 API, signed by hand (AWS Signature Version 4) — no SDK in the bundle. Server-only:
// the keys are R2_* env vars (docs/50 Эксплуатация/Перенос фото в Cloudflare R2.md); nothing here may be imported
// from a 'use client' file. Players never get a key: they get a presigned URL for one PUT of one file
// (app/api/photos/upload), valid for a few minutes, with its type, size and cache header fixed by the signature.

type Creds = { accessKeyId: string; secretAccessKey: string; region: string; service: string }
type Signable = { method: string; host: string; path: string; query?: Record<string, string>; headers?: Record<string, string> }

const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
const encPath = (p: string) => p.split('/').map(enc).join('/')
const sha256 = (s: string | Buffer) => createHash('sha256').update(s).digest('hex')
const hmac = (key: Buffer | string, s: string) => createHmac('sha256', key).update(s).digest()
export const amzDate = (d: Date) => d.toISOString().replace(/[:-]|\.\d{3}/g, '')

function signingKey(c: Creds, day: string) {
  return hmac(hmac(hmac(hmac('AWS4' + c.secretAccessKey, day), c.region), c.service), 'aws4_request')
}

// The signature over a request: what both the presigned URL and the Authorization header carry.
function signature(c: Creds, r: Signable, date: string, payloadHash: string) {
  const day = date.slice(0, 8)
  const scope = `${day}/${c.region}/${c.service}/aws4_request`
  const headers = Object.fromEntries(Object.entries({ host: r.host, ...(r.headers ?? {}) }).map(([k, v]) => [k.toLowerCase(), String(v).trim()]))
  const names = Object.keys(headers).sort()
  const query = Object.entries(r.query ?? {})
    .map(([k, v]) => [enc(k), enc(v)])
    .sort(([a, x], [b, y]) => (a < b ? -1 : a > b ? 1 : x < y ? -1 : x > y ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('&')
  const canonical = [r.method, encPath(r.path), query, names.map((n) => `${n}:${headers[n]}\n`).join(''), names.join(';'), payloadHash].join('\n')
  const toSign = ['AWS4-HMAC-SHA256', date, scope, sha256(canonical)].join('\n')
  return { scope, signedHeaders: names.join(';'), signature: createHmac('sha256', signingKey(c, day)).update(toSign).digest('hex') }
}

// A presigned URL (query-string auth). Headers given here are signed: the caller must send exactly them.
export function presignUrl(c: Creds, r: Signable, expiresSeconds: number, now = new Date()): string {
  const date = amzDate(now)
  const day = date.slice(0, 8)
  const signedHeaders = ['host', ...Object.keys(r.headers ?? {}).map((k) => k.toLowerCase())].sort().join(';')
  const query: Record<string, string> = {
    ...(r.query ?? {}),
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${c.accessKeyId}/${day}/${c.region}/${c.service}/aws4_request`,
    'X-Amz-Date': date,
    'X-Amz-Expires': String(expiresSeconds),
    'X-Amz-SignedHeaders': signedHeaders,
  }
  const s = signature(c, { ...r, query }, date, 'UNSIGNED-PAYLOAD')
  const qs = Object.entries({ ...query, 'X-Amz-Signature': s.signature })
    .map(([k, v]) => `${enc(k)}=${enc(v)}`)
    .join('&')
  return `https://${r.host}${encPath(r.path)}?${qs}`
}

// Headers for a request signed in the Authorization header (server → R2: list, delete, copy, put).
export function signHeaders(c: Creds, r: Signable, payloadHash = 'UNSIGNED-PAYLOAD', now = new Date()): Record<string, string> {
  const date = amzDate(now)
  const headers = { ...(r.headers ?? {}), 'x-amz-content-sha256': payloadHash, 'x-amz-date': date }
  const s = signature(c, { ...r, headers }, date, payloadHash)
  return { ...headers, Authorization: `AWS4-HMAC-SHA256 Credential=${c.accessKeyId}/${s.scope}, SignedHeaders=${s.signedHeaders}, Signature=${s.signature}` }
}

// ---- R2 ----

export type R2 = { creds: Creds; host: string; bucket: string }

export function r2FromEnv(): R2 | null {
  const account = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  const bucket = process.env.R2_BUCKET
  if (!account || !accessKeyId || !secretAccessKey || !bucket) return null
  return { creds: { accessKeyId, secretAccessKey, region: 'auto', service: 's3' }, host: `${account}.r2.cloudflarestorage.com`, bucket }
}

const objectPath = (r2: R2, key: string) => `/${r2.bucket}/${key}`

export function presignPut(r2: R2, key: string, headers: Record<string, string>, expiresSeconds = 900) {
  return presignUrl(r2.creds, { method: 'PUT', host: r2.host, path: objectPath(r2, key), headers }, expiresSeconds)
}

async function call(r2: R2, method: string, path: string, opts: { query?: Record<string, string>; headers?: Record<string, string>; body?: BodyInit | Buffer } = {}) {
  const headers = signHeaders(r2.creds, { method, host: r2.host, path, query: opts.query, headers: opts.headers })
  const qs = opts.query ? '?' + Object.entries(opts.query).map(([k, v]) => `${enc(k)}=${enc(v)}`).join('&') : ''
  return fetch(`https://${r2.host}${encPath(path)}${qs}`, { method, headers, body: opts.body as BodyInit | undefined })
}

export async function putObject(r2: R2, key: string, body: Buffer, headers: Record<string, string>) {
  const res = await call(r2, 'PUT', objectPath(r2, key), { headers: { ...headers, 'content-length': String(body.length) }, body })
  if (!res.ok) throw new Error(`R2 put ${key}: ${res.status} ${await res.text()}`)
}

export async function headObject(r2: R2, key: string): Promise<{ size: number } | null> {
  const res = await call(r2, 'HEAD', objectPath(r2, key))
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`R2 head ${key}: ${res.status}`)
  return { size: Number(res.headers.get('content-length') ?? 0) }
}

export async function copyObject(r2: R2, from: string, to: string) {
  const res = await call(r2, 'PUT', objectPath(r2, to), { headers: { 'x-amz-copy-source': `/${r2.bucket}/${from}` } })
  const text = await res.text()
  if (!res.ok || /<Error>/.test(text)) throw new Error(`R2 copy ${from} → ${to}: ${res.status} ${text.slice(0, 200)}`)
}

export async function deleteObject(r2: R2, key: string) {
  const res = await call(r2, 'DELETE', objectPath(r2, key))
  if (!res.ok && res.status !== 404) throw new Error(`R2 delete ${key}: ${res.status}`)
}

export type R2Object = { key: string; size: number; lastModified: string }

// Every object under a prefix (ListObjectsV2, 1000 a page).
export async function listObjects(r2: R2, prefix: string): Promise<R2Object[]> {
  const out: R2Object[] = []
  let token: string | null = null
  do {
    const query: Record<string, string> = { 'list-type': '2', prefix, 'max-keys': '1000' }
    if (token) query['continuation-token'] = token
    const res = await call(r2, 'GET', `/${r2.bucket}`, { query })
    const xml = await res.text()
    if (!res.ok) throw new Error(`R2 list ${prefix}: ${res.status} ${xml.slice(0, 200)}`)
    for (const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const tag = (t: string) => m[1].match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`))?.[1] ?? ''
      out.push({ key: unescapeXml(tag('Key')), size: Number(tag('Size')), lastModified: tag('LastModified') })
    }
    token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? unescapeXml(xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/)?.[1] ?? '') || null : null
  } while (token)
  return out
}

const unescapeXml = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
