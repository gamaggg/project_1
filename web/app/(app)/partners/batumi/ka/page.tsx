import { permanentRedirect } from 'next/navigation'

// Georgian is the Batumi page's default since 23.11.2026; old /ka links land on /partners/batumi.
export default function PartnersBatumiKaPage() {
  permanentRedirect('/partners/batumi')
}
