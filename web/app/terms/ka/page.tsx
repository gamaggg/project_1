import { PrivacyView, privacyMetadata } from '@/app/privacy/PrivacyView'
import { TERMS_DOCS, TERMS_PATHS } from '@/lib/data/terms'

export const metadata = privacyMetadata('ka', TERMS_DOCS, TERMS_PATHS)

export default function TermsPageKa() {
  return <PrivacyView lang="ka" docs={TERMS_DOCS} paths={TERMS_PATHS} />
}
