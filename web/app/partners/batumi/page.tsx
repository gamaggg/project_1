import { PartnersView, partnersMetadata } from '../PartnersView'

export const metadata = partnersMetadata('ru', 'batumi')

export default function PartnersBatumiPage() {
  return <PartnersView lang="ru" city="batumi" />
}
