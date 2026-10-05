// When and where a gallery photo was taken, read straight from its JPEG
// EXIF block — the diary's «улов из галереи» dates and places itself from
// this. Only the two things we need (DateTimeOriginal, GPS); anything odd —
// not a JPEG, no EXIF, a HEIC the browser didn't convert — just gives nulls,
// and the form asks instead.

export type PhotoMeta = { takenAt: Date | null; lat: number | null; lng: number | null }

const EMPTY: PhotoMeta = { takenAt: null, lat: null, lng: null }

export async function readPhotoMeta(file: Blob): Promise<PhotoMeta> {
  try {
    // EXIF sits in the first APP1 segment, well inside the first 128 KB.
    const buf = await file.slice(0, 128 * 1024).arrayBuffer()
    return parseJpeg(new DataView(buf))
  } catch {
    return EMPTY
  }
}

function parseJpeg(v: DataView): PhotoMeta {
  if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return EMPTY
  let off = 2
  while (off + 4 <= v.byteLength) {
    const marker = v.getUint16(off)
    const size = v.getUint16(off + 2)
    if (marker === 0xffe1 && off + 10 <= v.byteLength && v.getUint32(off + 4) === 0x45786966) {
      return parseTiff(v, off + 10)
    }
    if ((marker & 0xff00) !== 0xff00 || size < 2) return EMPTY
    off += 2 + size
  }
  return EMPTY
}

function parseTiff(v: DataView, tiff: number): PhotoMeta {
  const little = v.getUint16(tiff) === 0x4949
  const u16 = (o: number) => v.getUint16(o, little)
  const u32 = (o: number) => v.getUint32(o, little)
  const entries = (ifd: number) => {
    const out = new Map<number, { type: number; count: number; valueOff: number }>()
    if (ifd + 2 > v.byteLength) return out
    const n = u16(ifd)
    for (let i = 0; i < n; i++) {
      const e = ifd + 2 + i * 12
      if (e + 12 > v.byteLength) break
      out.set(u16(e), { type: u16(e + 2), count: u32(e + 4), valueOff: e + 8 })
    }
    return out
  }
  // Values longer than 4 bytes live elsewhere, at an offset from the TIFF start.
  const at = (en: { type: number; count: number; valueOff: number }, bytes: number) =>
    en.count * bytes > 4 ? tiff + u32(en.valueOff) : en.valueOff
  const ascii = (en: { type: number; count: number; valueOff: number }) => {
    const start = at(en, 1)
    let s = ''
    for (let i = 0; i < en.count - 1 && start + i < v.byteLength; i++) s += String.fromCharCode(v.getUint8(start + i))
    return s
  }
  const rationals = (en: { type: number; count: number; valueOff: number }) => {
    const start = at(en, 8)
    const out: number[] = []
    for (let i = 0; i < en.count; i++) {
      const o = start + i * 8
      if (o + 8 > v.byteLength) break
      const den = u32(o + 4)
      out.push(den ? u32(o) / den : 0)
    }
    return out
  }

  const ifd0 = entries(tiff + u32(tiff + 4))
  let takenAt: Date | null = null
  const exifPtr = ifd0.get(0x8769)
  if (exifPtr) {
    const exif = entries(tiff + u32(exifPtr.valueOff))
    const dto = exif.get(0x9003) ?? exif.get(0x9004)
    if (dto) {
      // "2026:10:04 23:44:25" — local camera time, no zone.
      const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(ascii(dto))
      if (m) takenAt = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])
    }
  }
  if (!takenAt) {
    const dt = ifd0.get(0x0132)
    const m = dt ? /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(ascii(dt)) : null
    if (m) takenAt = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])
  }

  let lat: number | null = null
  let lng: number | null = null
  const gpsPtr = ifd0.get(0x8825)
  if (gpsPtr) {
    const gps = entries(tiff + u32(gpsPtr.valueOff))
    const latRef = gps.get(1)
    const latV = gps.get(2)
    const lngRef = gps.get(3)
    const lngV = gps.get(4)
    if (latV && lngV) {
      const toDeg = (r: number[]) => (r[0] ?? 0) + (r[1] ?? 0) / 60 + (r[2] ?? 0) / 3600
      lat = toDeg(rationals(latV)) * (latRef && ascii(latRef).startsWith('S') ? -1 : 1)
      lng = toDeg(rationals(lngV)) * (lngRef && ascii(lngRef).startsWith('W') ? -1 : 1)
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
        lat = null
        lng = null
      }
    }
  }
  if (takenAt && Number.isNaN(takenAt.getTime())) takenAt = null
  return { takenAt, lat, lng }
}

// A gallery photo shrunk to at most `maxSide` px, re-encoded as JPEG — the
// size catch photos are stored at. Read readPhotoMeta first: this drops EXIF.
export function downscaleToJpeg(file: Blob, maxSide = 1600): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.naturalWidth * scale)
      canvas.height = Math.round(img.naturalHeight * scale)
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.85)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image load failed'))
    }
    img.src = url
  })
}
