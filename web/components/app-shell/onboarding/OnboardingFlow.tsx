'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useProfile } from '@/lib/supabase/queries'
import { WelcomeStep } from '@/components/app-shell/onboarding/WelcomeStep'
import { SignInStep } from '@/components/app-shell/onboarding/SignInStep'
import { AccountStep } from '@/components/app-shell/onboarding/AccountStep'
import { TerritoryIntroStep } from '@/components/app-shell/onboarding/TerritoryIntroStep'
import { CatchIntroStep } from '@/components/app-shell/onboarding/CatchIntroStep'
import { NameStep } from '@/components/app-shell/onboarding/NameStep'
import { DetailsStep } from '@/components/app-shell/onboarding/DetailsStep'
import { ColorStep } from '@/components/app-shell/onboarding/ColorStep'

type Step = 'welcome' | 'signin' | 'account' | 'territory-intro' | 'catch-intro' | 'name' | 'details' | 'color'

// Rendered by FishZoneApp whenever `!user || !myProfile.onboardingCompleted`
// (see DECISIONS.md) — self-contained like AchievementDetailScreen, fetches
// its own auth/profile state rather than taking it via props.
export function OnboardingFlow() {
  const { user } = useAuth()
  const { data: myProfile, isLoading: myProfileLoading } = useProfile(user?.id ?? null)
  const [step, setStep] = useState<Step>('welcome')

  // Resumes an in-progress account exactly once per mount. Deliberately NOT
  // re-run on every myProfile cache update — a successful NameStep save
  // would otherwise recompute 'name' again and trap the user re-submitting
  // it forever. All forward movement after this is local setStep() calls.
  const resumedRef = useRef(false)
  useEffect(() => {
    if (!user || resumedRef.current || myProfileLoading || !myProfile) return
    resumedRef.current = true
    if (myProfile.onboardingCompleted) return // defensive; the gate unmounts us shortly anyway
    setStep(myProfile.birthDate === null ? 'territory-intro' : 'color')
  }, [user, myProfile, myProfileLoading])

  if (user && myProfileLoading) return null

  if (step === 'welcome') return <WelcomeStep onCapture={() => setStep('account')} onSignIn={() => setStep('signin')} />
  if (step === 'signin') return <SignInStep onBack={() => setStep('welcome')} />
  if (step === 'account') return <AccountStep onBack={() => setStep('welcome')} />
  if (step === 'territory-intro') return <TerritoryIntroStep onDone={() => setStep('catch-intro')} />
  if (step === 'catch-intro') return <CatchIntroStep onDone={() => setStep('name')} />
  if (step === 'name') return <NameStep initialName={myProfile?.displayName ?? ''} onBack={() => setStep('welcome')} onDone={() => setStep('details')} />
  if (step === 'details') return <DetailsStep onBack={() => setStep('name')} onDone={() => setStep('color')} />
  return <ColorStep onBack={() => setStep('details')} onDone={() => {}} />
}
