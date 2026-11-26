import { PartnersView, partnersMetadata } from '../../PartnersView'

export const metadata = partnersMetadata('en', 'batumi')

export default function PartnersBatumiEnPage() {
  return <PartnersView lang="en" city="batumi" />
}
