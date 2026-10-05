'use client'

import { useEffect, useRef, useState } from 'react'
import { useTelegramBackButton } from '@/lib/telegram/useTelegramBackButton'

// Long side of the saved photo. Was 1280 on the width alone — and with no
// resolution asked of the camera, phones streamed 640×480 anyway: catch
// photos averaged 126 KB (05.10), soft and grainy.
const MAX_PHOTO_SIDE = 1920
const JPEG_QUALITY = 0.88
const CAMERA_GRANTED_KEY = 'fishzone:cameraGranted'

type CameraState = 'intro' | 'requesting' | 'live' | 'denied'

// Torch (flashlight) and focus capabilities aren't in TS's DOM lib —
// non-standard but real (Chrome/Android).
type TorchCapabilities = { torch?: boolean; focusMode?: string[] }

// ImageCapture (Chrome/Android) takes a real still from the sensor — full
// resolution, the phone's own processing — instead of a frame of the
// preview video. Not in TS's DOM lib; iOS has no such API.
type ImageCaptureLike = { takePhoto: () => Promise<Blob> }
declare const ImageCapture: { new (track: MediaStreamTrack): ImageCaptureLike } | undefined

// Draws any image source down to MAX_PHOTO_SIDE on its long side and encodes
// one JPEG — the same pass for a live frame, a sensor still and an admin's
// gallery pick, so they all look and weigh alike in confirm/upload.
function encodePhoto(source: CanvasImageSource, width: number, height: number, done: (blob: Blob) => void) {
  const scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  canvas.toBlob((blob) => {
    if (blob) done(blob)
  }, 'image/jpeg', JPEG_QUALITY)
}

// No "continue without photo" path anywhere here — a catch cannot be logged
// without a real photo (see DECISIONS.md). Denied/error only ever offers a
// retry of getUserMedia, never a way to skip past the camera.
export function CameraScreen({
  active,
  onBack,
  onCapture,
  allowGallery,
}: {
  active: boolean
  onBack: () => void
  onCapture: (blob: Blob) => void
  // Admin-only escape hatch (see FishZoneApp's startAdminCatch and the
  // can_add_catch_from_gallery permission) — a regular player's catch must
  // come from the live camera right there on the water, see the no-skip-past
  // camera note above, so this stays off unless the caller explicitly
  // enables it for an admin-initiated catch.
  allowGallery?: boolean
}) {
  const [state, setState] = useState<CameraState>('intro')
  const [torchSupported, setTorchSupported] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  // A sensor still takes a moment (Android) — the shutter waits for it.
  const [shooting, setShooting] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  useEffect(() => () => stopStream(), [])

  // Same `active` gating as the permission effect below, for the same reason
  // (this screen never unmounts on its own) — routes Telegram's native
  // chrome back button to the same stopStream()+onBack() as the in-page X.
  useTelegramBackButton(active ? handleBack : undefined)

  // Skips the manual "Разрешить доступ к камере" gate when this browser has
  // granted camera access before. The Permissions API (checked first, where
  // supported) can confirm that without even touching getUserMedia — but
  // Safari doesn't support querying 'camera' and rejects/throws there, so a
  // localStorage flag (set once a request actually succeeds) is the fallback
  // that also works on iOS: getUserMedia itself resolves silently there when
  // the origin already has access, no repeat native prompt (see DECISIONS.md).
  //
  // Gated on `active`: this screen never unmounts on its own (screens stay
  // mounted app-wide, only their CSS 'active' class toggles — see
  // FishZoneApp), so it's already sitting in the tree, hidden, the moment the
  // app first loads. Without this check that first mount alone would fire
  // getUserMedia — and the native permission prompt with it — while the user
  // is still looking at the map, with no camera screen in sight.
  useEffect(() => {
    if (!active) return
    let cancelled = false
    if (localStorage.getItem(CAMERA_GRANTED_KEY) === '1') {
      void requestCamera()
      return
    }
    navigator.permissions
      ?.query({ name: 'camera' as PermissionName })
      .then((status) => {
        if (!cancelled && status.state === 'granted') void requestCamera()
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  // The <video> only mounts once state becomes 'live', so the stream can't be
  // attached at getUserMedia-resolve time (the ref is still null then) — attach
  // it here once the element exists instead.
  useEffect(() => {
    if (state === 'live' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
    }
  }, [state])

  async function requestCamera() {
    setState('requesting')
    try {
      // Without a size the browser picks its default — 640×480 on many
      // phones. 4:3 like the phone's own camera; the closest mode wins.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1440 } },
        audio: false,
      })
      streamRef.current = stream
      localStorage.setItem(CAMERA_GRANTED_KEY, '1')
      const track = stream.getVideoTracks()[0]
      const caps = track?.getCapabilities?.() as unknown as TorchCapabilities | undefined
      if (caps?.focusMode?.includes('continuous')) {
        track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] } as unknown as MediaTrackConstraints).catch(() => {})
      }
      setTorchSupported(!!caps?.torch)
      setTorchOn(false)
      setState('live')
    } catch {
      setState('denied')
    }
  }

  // Real flashlight control, not just a lit-up icon — hidden entirely (see
  // JSX below) unless the active track's capabilities actually report torch
  // support. iOS Safari never does (no torch API at all, a WebKit
  // limitation), so this button simply won't appear there; it does work on
  // Chrome/Android.
  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    const next = !torchOn
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] } as unknown as MediaTrackConstraints)
      setTorchOn(next)
    } catch {
      // Reported support but failed to apply — leave torchOn as-is.
    }
  }

  function handleBack() {
    stopStream()
    onBack()
  }

  function grabFrame() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    encodePhoto(video, video.videoWidth, video.videoHeight, (blob) => {
      stopStream()
      onCapture(blob)
    })
  }

  // A real still where the browser can take one (Android), else a frame of
  // the preview (iPhone). With the torch on, the frame: takePhoto may switch
  // the torch off for its own exposure.
  async function shoot() {
    const video = videoRef.current
    if (!video || !video.videoWidth || shooting) return
    const track = streamRef.current?.getVideoTracks()[0]
    if (track && !torchOn && typeof ImageCapture !== 'undefined') {
      setShooting(true)
      try {
        const still = await new ImageCapture(track).takePhoto()
        const bitmap = await createImageBitmap(still)
        encodePhoto(bitmap, bitmap.width, bitmap.height, (blob) => {
          bitmap.close()
          stopStream()
          onCapture(blob)
        })
        return
      } catch {
        // Some devices refuse a still mid-preview — the frame still works.
      } finally {
        setShooting(false)
      }
    }
    grabFrame()
  }

  // Same resize/encode pass as shoot() above — a gallery pick should look
  // and weigh the same as a live shot once it's in confirm/upload, not carry
  // through whatever resolution the source photo happened to be.
  function handleGalleryPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      encodePhoto(img, img.naturalWidth, img.naturalHeight, (blob) => {
        stopStream()
        onCapture(blob)
      })
    }
    img.src = url
  }

  const isLive = state === 'live'

  return (
    <div className={`camera-screen${isLive ? '' : ' camera-screen-intro'}`}>
      <div className={`camera-view${isLive ? '' : ' camera-view-intro'}`}>
        <div className="camera-top">
          <div className="cam-round-btn tap-scale" onClick={handleBack}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isLive ? '#fff' : '#17181B'} strokeWidth="2.4" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </div>
          {isLive && torchSupported && (
            <div className={`cam-round-btn tap-scale${torchOn ? ' active' : ''}`} onClick={toggleTorch}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill={torchOn ? '#fff' : 'none'} stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
              </svg>
            </div>
          )}
        </div>

        {isLive ? (
          <video ref={videoRef} className="camera-live-video" autoPlay playsInline muted />
        ) : (
          <div className="camera-intro-content">
            <div className="camera-icon">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 7h3.2L9 4.5h6L16.8 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" />
                <circle cx="12" cy="13" r="3.4" />
              </svg>
            </div>
            <div className="camera-hint">
              {state === 'denied' ? (
                <>
                  <div className="h1">Нет доступа к камере</div>
                  <div className="h2">Разреши доступ в настройках браузера — без фото улова сектор нельзя закрепить за собой.</div>
                </>
              ) : (
                <>
                  <div className="h1">Доступ к камере</div>
                  <div className="h2">Нужен, чтобы сфотографировать улов на месте — фото подтверждает поимку и закрепляет сектор за тобой.</div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="camera-controls">
        {isLive ? (
          <>
            <div className={`shutter tap-scale${shooting ? ' busy' : ''}`} onClick={shoot} />
            {allowGallery && (
              <div className="cam-round-btn camera-gallery-btn tap-scale" onClick={() => galleryInputRef.current?.click()} aria-label="Выбрать из галереи">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <circle cx="9" cy="10" r="1.6" fill="#fff" stroke="none" />
                  <path d="M3 16l5.5-5 4 4 3-3L21 17" />
                </svg>
              </div>
            )}
          </>
        ) : (
          <div className="camera-controls-btn">
            <button className="btn-primary" disabled={state === 'requesting'} onClick={requestCamera}>
              {state === 'requesting' ? 'Запрашиваем доступ…' : state === 'denied' ? 'Запросить доступ снова' : 'Разрешить доступ к камере'}
            </button>
            {allowGallery && (
              <button className="btn-secondary" style={{ marginTop: 10 }} onClick={() => galleryInputRef.current?.click()}>
                Выбрать фото из галереи
              </button>
            )}
          </div>
        )}
      </div>
      {allowGallery && <input ref={galleryInputRef} type="file" accept="image/*" onChange={handleGalleryPick} style={{ display: 'none' }} />}
    </div>
  )
}
