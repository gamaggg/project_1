import { notFound } from 'next/navigation'
import { AlivePreview } from './AlivePreview'

// Every «Живые экраны» animation on one page, each with a replay button, to
// look at them without signing in: /alive-preview. Development only — not
// part of the product.
export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <AlivePreview />
}
