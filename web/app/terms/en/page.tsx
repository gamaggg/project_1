import { PrivacyView, privacyMetadata } from '@/app/privacy/PrivacyView'
import { TERMS_DOCS, TERMS_PATHS } from '@/lib/data/terms'

export const metadata = privacyMetadata('en', TERMS_DOCS, TERMS_PATHS)

export default function TermsPageEn() {
  return <PrivacyView lang="en" docs={TERMS_DOCS} paths={TERMS_PATHS} />
}
