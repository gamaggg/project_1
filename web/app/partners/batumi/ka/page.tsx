import { PartnersView, partnersMetadata } from '../../PartnersView'

export const metadata = partnersMetadata('ka', 'batumi')

export default function PartnersBatumiKaPage() {
  return <PartnersView lang="ka" city="batumi" />
}
