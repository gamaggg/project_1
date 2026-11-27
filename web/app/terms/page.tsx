import { PrivacyView, privacyMetadata } from '@/app/privacy/PrivacyView'
import { TERMS_DOCS, TERMS_PATHS } from '@/lib/data/terms'

export const metadata = privacyMetadata('ru', TERMS_DOCS, TERMS_PATHS)

export default function TermsPage() {
  return <PrivacyView lang="ru" docs={TERMS_DOCS} paths={TERMS_PATHS} />
}
