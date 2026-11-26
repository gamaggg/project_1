import { PartnersView, partnersMetadata } from '../../PartnersView'

export const metadata = partnersMetadata('ru', 'batumi')

export default function PartnersBatumiRuPage() {
  return <PartnersView lang="ru" city="batumi" />
}
