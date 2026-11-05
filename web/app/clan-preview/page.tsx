import { notFound } from 'next/navigation'
import { ClanPreview } from './ClanPreview'

// The clan update on fictional data, clickable end to end: /clan-preview.
// Development only — not part of the product (the real screens come with the
// migration; see docs/50 Эксплуатация/Клановое обновление — задание и ход работ).
export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <ClanPreview />
}
