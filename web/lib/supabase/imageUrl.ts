const PUBLIC_OBJECT = '/storage/v1/object/public/'

// Asks Supabase Storage for an already-resized copy instead of the original.
//
// Matters far more than the transfer size suggests: a catch photo is a
// 1280px JPEG (see CameraScreen's MAX_PHOTO_WIDTH), and a browser decodes it
// to roughly width × height × 4 bytes of RAM — about 5 MB — no matter how
// small the box it's drawn in. Screens here never unmount, so the activity
// feed alone kept ~70 of those decoded at once; on an iPhone that is enough
// for the system to kill the page ("повторно возникла проблема" in Safari, a
// black screen in Telegram). A 160px thumbnail decodes to ~100 KB instead.
//
// Anything that isn't a Supabase public object (a Telegram CDN avatar, a
// local blob: preview) is handed back untouched.
export function thumbUrl(url: string, size: number): string {
  const i = url.indexOf(PUBLIC_OBJECT)
  if (i === -1) return url
  const origin = url.slice(0, i)
  const path = url.slice(i + PUBLIC_OBJECT.length).split('?')[0]
  return `${origin}/storage/v1/render/image/public/${path}?width=${size}&height=${size}&resize=cover&quality=70`
}
