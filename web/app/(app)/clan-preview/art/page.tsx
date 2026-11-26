import { notFound } from 'next/navigation'
import { ArtShowcase } from './ArtShowcase'

// Every picture and animation of the clan update on one page, to look at without playing: /clan-preview/art.
// Development only, like /clan-preview.
export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <ArtShowcase />
}
