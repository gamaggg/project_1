import { createClient } from '@/lib/supabase/client'

// Called immediately after a catch photo is captured (see CameraScreen/FishZoneApp) —
// not at form-submit time — so the upload runs in the background while the user
// fills in species/length/etc. Throws on failure; caller drives the retry UI.
export async function uploadCatchPhoto(userId: string, blob: Blob): Promise<string> {
  const supabase = createClient()
  const path = `${userId}/${Date.now()}.jpg`
  const { error } = await supabase.storage.from('catch-photos').upload(path, blob, {
    contentType: 'image/jpeg',
  })
  if (error) throw error
  const { data } = supabase.storage.from('catch-photos').getPublicUrl(path)
  return data.publicUrl
}
