// Photos on Cloudflare R2 (docs/50 Эксплуатация/Перенос фото в Cloudflare R2.md): one bucket, the old Supabase bucket
// names kept as the first folder, served from photos.catchrange.com. Shared by the app and the server; no secrets.
//
// R2 does not resize on the fly the way Supabase's /render/image does, so every photo is uploaded with two square
// thumbnails beside it (center crop, like Supabase's resize=cover): <name>.t160.jpg and <name>.t480.jpg.

export const R2_PHOTO_HOST = 'https://photos.catchrange.com'

// The switch: new uploads go to R2 only while this is set (to R2_PHOTO_HOST). Reading R2 photos works either way.
export const photosOnR2 = !!process.env.NEXT_PUBLIC_PHOTO_BASE_URL

export const THUMB_SIZES = [160, 480] as const
export const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable'

export type PhotoKind = 'catch' | 'diary' | 'avatar' | 'announcement'

export const isR2Photo = (url: string) => url.startsWith(R2_PHOTO_HOST + '/')
export const r2PhotoUrl = (key: string) => `${R2_PHOTO_HOST}/${key}`
export const r2KeyOf = (url: string) => (isR2Photo(url) ? decodeURIComponent(url.slice(R2_PHOTO_HOST.length + 1).split('?')[0]) : null)
export const thumbKey = (key: string, size: number) => key.replace(/\.jpe?g$/i, '') + `.t${size}.jpg`
export const isThumbKey = (key: string) => /\.t\d+\.jpg$/.test(key)

// The smallest stored copy that still covers a `size` × `size` box; past the biggest thumbnail, the original.
// Panoramas are stored without thumbnails.
export function r2Thumb(url: string, size: number): string {
  const key = r2KeyOf(url)
  if (!key || key.startsWith('geo-panoramas/')) return url
  const tier = THUMB_SIZES.find((t) => size <= t)
  return tier ? r2PhotoUrl(thumbKey(key, tier)) : url
}
