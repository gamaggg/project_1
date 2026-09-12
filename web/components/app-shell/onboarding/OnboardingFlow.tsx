'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useProfile, useUpdateProfile } from '@/lib/supabase/queries'
import { WelcomeStep } from '@/components/app-shell/onboarding/WelcomeStep'
import { SignInStep } from '@/components/app-shell/onboarding/SignInStep'
import { AccountStep } from '@/components/app-shell/onboarding/AccountStep'
import { TerritoryIntroStep } from '@/components/app-shell/onboarding/TerritoryIntroStep'
import { CatchIntroStep } from '@/components/app-shell/onboarding/CatchIntroStep'
import { CityStep } from '@/components/app-shell/onboarding/CityStep'
import { NameStep } from '@/components/app-shell/onboarding/NameStep'
import { DetailsStep } from '@/components/app-shell/onboarding/DetailsStep'
import { ColorStep } from '@/components/app-shell/onboarding/ColorStep'
import type { CityId } from '@/lib/data/city'

// Listed in actual flow order: welcome -> account -> name -> details -> color
// -> city -> territory-intro -> catch-intro (which flips onboarding_completed
// and ends the wizard). signin is a side branch off welcome, not part of the
// linear sequence.
type Step = 'welcome' | 'signin' | 'account' | 'name' | 'details' | 'color' | 'city' | 'territory-intro' | 'catch-intro'

// Rendered by FishZoneApp whenever `!user || !myProfile.onboardingCompleted`
// (see DECISIONS.md) — self-contained like AchievementDetailScreen, fetches
// its own auth/profile state rather than taking it via props. The one
// exception is onCityChosen: FishZoneApp's own `city` state was already
// initialized (and its localStorage-reading effect already ran) by the time
// CityStep's onDone fires here, since this whole flow renders *inside*
// FishZoneApp rather than replacing it — writing to localStorage alone
// wouldn't be re-read, so the pick has to reach that live state directly.
export function OnboardingFlow({ onCityChosen, onForgotPassword }: { onCityChosen?: (city: CityId) => void; onForgotPassword: () => void }) {
  const { user } = useAuth()
  const { data: myProfile, isLoading: myProfileLoading } = useProfile(user?.id ?? null)
  const [step, setStep] = useState<Step>('welcome')
  const updateProfile = useUpdateProfile()

  // Resumes an in-progress account exactly once per mount. Deliberately NOT
  // re-run on every myProfile cache update — a successful NameStep save
  // would otherwise recompute 'name' again and trap the user re-submitting
  // it forever. All forward movement after this is local setStep() calls.
  //
  // Only birthDate/territoryColor are reliable nullable checkpoints (name
  // always falls back to a default display name server-side, city/
  // territory-intro/catch-intro persist nothing at all) — so a reload mid
  // tail just restarts that tail from 'city' rather than trying to guess
  // exactly which of the 3 unpersisted screens was last seen.
  const resumedRef = useRef(false)
  useEffect(() => {
    if (!user || resumedRef.current || myProfileLoading || !myProfile) return
    resumedRef.current = true
    if (myProfile.onboardingCompleted) return // defensive; the gate unmounts us shortly anyway
    if (myProfile.birthDate === null) setStep('name')
    else if (myProfile.territoryColor === null) setStep('color')
    else setStep('city')
  }, [user, myProfile, myProfileLoading])

  if (user && myProfileLoading) return null

  if (step === 'welcome') return <WelcomeStep onCapture={() => setStep('account')} onSignIn={() => setStep('signin')} />
  if (step === 'signin') return <SignInStep onBack={() => setStep('welcome')} onForgotPassword={onForgotPassword} />
  if (step === 'account') return <AccountStep onBack={() => setStep('welcome')} />
  if (step === 'name') return <NameStep initialName={myProfile?.displayName ?? ''} onBack={() => setStep('account')} onDone={() => setStep('details')} />
  if (step === 'details') return <DetailsStep onBack={() => setStep('name')} onDone={() => setStep('color')} />
  if (step === 'color') return <ColorStep onBack={() => setStep('details')} onDone={() => setStep('city')} />
  if (step === 'city')
    return (
      <CityStep
        onBack={() => setStep('color')}
        onDone={(chosen) => {
          updateProfile.mutate({ city: chosen })
          onCityChosen?.(chosen)
          setStep('territory-intro')
        }}
      />
    )
  if (step === 'territory-intro') return <TerritoryIntroStep onBack={() => setStep('city')} onDone={() => setStep('catch-intro')} />
  // Last screen of the wizard — flips onboarding_completed, which is what
  // makes FishZoneApp's gate unmount the whole wizard and show the real map.
  return <CatchIntroStep onBack={() => setStep('territory-intro')} onDone={() => updateProfile.mutate({ onboardingCompleted: true })} />
}
