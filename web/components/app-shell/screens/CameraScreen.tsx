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
          {isLive && (
            <div className="cam-round-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
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
