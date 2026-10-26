import { PrivacyView, privacyMetadata } from './PrivacyView'

export const metadata = privacyMetadata('ru')

export default function PrivacyPage() {
  return <PrivacyView lang="ru" />
}
