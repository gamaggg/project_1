'use client'

import type { Territory } from '@/lib/data/types'

export function CameraScreen({ territory, onBack, onShutter }: { territory: Territory | null; onBack: () => void; onShutter: () => void }) {
  return (
    <div className="camera-screen">
      <div className="camera-view">
        <div className="camera-top">
          <div className="cam-round-btn tap-scale" onClick={onBack}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </div>
          <div className="gps-chip">GPS · {territory ? `${territory.lat.toFixed(4)}, ${territory.lng.toFixed(4)}` : 'АДЖАРИЯ'}</div>
          <div className="cam-round-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
            </svg>
          </div>
        </div>
        <svg width="150" height="150" viewBox="0 0 64 64" fill="none" opacity={0.9}>
          <path d="M6 32c8-14 20-20 34-14-2 6-2 14 0 20-14 6-26 0-34-14z" stroke="#EAF6F8" strokeWidth="2" fill="rgba(234,246,248,0.14)" />
          <path d="M40 25c4-3 9-4 13-2-3 3-3 8 0 11-4 2-9 1-13-2" stroke="#EAF6F8" strokeWidth="2" fill="rgba(234,246,248,0.14)" />
          <circle cx="16" cy="29" r="1.6" fill="#EAF6F8" />
        </svg>
        <div className="camera-hint">
          <div className="h1">Сделай фото улова</div>
          <div className="h2">Рыба должна быть хорошо видна на фотографии</div>
        </div>
      </div>
      <div className="camera-controls">
        <div className="shutter tap-scale" onClick={onShutter} />
      </div>
    </div>
  )
}
