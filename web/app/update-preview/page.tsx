import { notFound } from 'next/navigation'
import { UpdatePreview } from './UpdatePreview'

// Everything from the 24.11.2026 update on one page, to click through without signing in: /update-preview.
// Development only — not part of the product.
export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <UpdatePreview />
}
