import { PartnersView, partnersMetadata } from '../../PartnersView'

export const metadata = partnersMetadata('en', 'moscow')

export default function PartnersMoscowEnPage() {
  return <PartnersView lang="en" city="moscow" />
}
