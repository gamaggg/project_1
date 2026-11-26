import { notFound } from 'next/navigation'
import { MomentPreview } from './MomentPreview'

// The after-catch moment on the real map, to look at it without a catch:
// /moment-preview. Development only — not part of the product.
export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <MomentPreview />
}
