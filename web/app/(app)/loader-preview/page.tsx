import { notFound } from 'next/navigation'
import { HexLoader } from '@/components/app-shell/HexLoader'

// The launch screen's loader on its own, to look at it: /loader-preview.
// Development only — not part of the product.
export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound()
  return (
    <div className="app-shell loading-shell" style={{ position: 'fixed' }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
      <img src="/brand/logo_2.svg" alt="RANGE" className="loading-shell-logo" />
      <HexLoader size={1.08} />
    </div>
  )
}
