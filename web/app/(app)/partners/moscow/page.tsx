import { PartnersView, partnersMetadata } from '../PartnersView'

export const metadata = partnersMetadata('ru', 'moscow')

export default function PartnersMoscowPage() {
  return <PartnersView lang="ru" city="moscow" />
}
