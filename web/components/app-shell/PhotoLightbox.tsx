'use client'

// Full-size view of a catch/avatar photo — tap the backdrop or × to close.
export function PhotoLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="lightbox-close tap-scale" onClick={onClose}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </div>
      <img src={src} alt={alt} className="lightbox-img" onClick={(e) => e.stopPropagation()} />
    </div>
  )
}
