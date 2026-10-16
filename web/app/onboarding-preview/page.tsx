import { notFound } from 'next/navigation'
import { OnboardingPreview } from '@/components/app-shell/onboarding/OnboardingPreview'

// A page for looking at the onboarding screens without making an account:
// /onboarding-preview. Development only — it is not part of the product.
export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <OnboardingPreview />
}
