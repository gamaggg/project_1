'use client'

import { useEffect, useRef, useState } from 'react'

const MAX_PHOTO_WIDTH = 1280

type CameraState = 'intro' | 'requesting' | 'live' | 'denied'

// No "continue without photo" path anywhere here — a catch cannot be logged
// without a real photo (see DECISIONS.md). Denied/error only ever offers a
// retry of getUserMedia, never a way to skip past the camera.
export function CameraScreen({ onBack, onCapture }: { onBack: () => void; onCapture: (blob: Blob) => void }) {
  const [state, setState] = useState<CameraState>('intro')
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  useEffect(() => () => stopStream(), [])

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
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      streamRef.current = stream
      setState('live')
    } catch {
      setState('denied')
    }
  }

  function handleBack() {
    stopStream()
    onBack()
  }

  function shoot() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const scale = Math.min(1, MAX_PHOTO_WIDTH / video.videoWidth)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    stopStream()
    canvas.toBlob((blob) => { if (blob) onCapture(blob) }, 'image/jpeg', 0.85)
  }

  return (
    <div className="camera-screen">
      <div className="camera-view">
        <div className="camera-top">
          <div className="cam-round-btn tap-scale" onClick={handleBack}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </div>
          {state === 'live' && (
            <div className="cam-round-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
              </svg>
            </div>
          )}
        </div>

        {state === 'live' ? (
          <video ref={videoRef} className="camera-live-video" autoPlay playsInline muted />
        ) : (
          <>
            <svg width="150" height="150" viewBox="0 0 64 64" fill="none" opacity={0.9}>
              <path d="M6 32c8-14 20-20 34-14-2 6-2 14 0 20-14 6-26 0-34-14z" stroke="#EAF6F8" strokeWidth="2" fill="rgba(234,246,248,0.14)" />
              <path d="M40 25c4-3 9-4 13-2-3 3-3 8 0 11-4 2-9 1-13-2" stroke="#EAF6F8" strokeWidth="2" fill="rgba(234,246,248,0.14)" />
              <circle cx="16" cy="29" r="1.6" fill="#EAF6F8" />
            </svg>
            <div className="camera-hint">
              {state === 'denied' ? (
                <>
                  <div className="h1">Нужен доступ к камере</div>
                  <div className="h2">Без доступа к камере нельзя сфотографировать улов и занять территорию. Проверь разрешения сайта в настройках браузера.</div>
                </>
              ) : (
                <>
                  <div className="h1">Быстрое добавление</div>
                  <div className="h2">Сфотографируй улов, чтобы закрепить территорию за собой</div>
                </>
              )}
            </div>
          </>
        )}
      </div>
      <div className="camera-controls">
        {state === 'live' ? (
          <div className="shutter tap-scale" onClick={shoot} />
        ) : (
          <div className="camera-controls-btn">
            <button className="btn-primary" disabled={state === 'requesting'} onClick={requestCamera}>
              {state === 'requesting' ? 'Запрашиваем доступ…' : state === 'denied' ? 'Запросить доступ снова' : 'Разрешить доступ к камере'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
