'use client'

import { useState } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useProfile, useUpdateProfile } from '@/lib/supabase/queries'
import { WelcomeStep } from '@/components/app-shell/onboarding/WelcomeStep'
import { SignInStep } from '@/components/app-shell/onboarding/SignInStep'
import { AccountStep } from '@/components/app-shell/onboarding/AccountStep'
import { TerritoryIntroStep } from '@/components/app-shell/onboarding/TerritoryIntroStep'
import { CatchIntroStep } from '@/components/app-shell/onboarding/CatchIntroStep'
import { CityStep } from '@/components/app-shell/onboarding/CityStep'
import { NameStep } from '@/components/app-shell/onboarding/NameStep'
import { ColorStep } from '@/components/app-shell/onboarding/ColorStep'
import type { CityId } from '@/lib/data/city'

// Listed in actual flow order: welcome -> account -> name -> color -> city ->
// territory-intro -> catch-intro (which flips onboarding_completed and ends
// the wizard). signin is a side branch off welcome, not part of the linear
// sequence.
type Step = 'welcome' | 'signin' | 'account' | 'name' | 'color' | 'city' | 'territory-intro' | 'catch-intro'

// Rendered by FishZoneApp whenever `!user || !myProfile.onboardingCompleted`
// (see DECISIONS.md) — self-contained like AchievementDetailScreen, fetches
// its own auth/profile state rather than taking it via props. The one
// exception is onCityChosen: FishZoneApp's own `city` state was already
// initialized (and its localStorage-reading effect already ran) by the time
// CityStep's onDone fires here, since this whole flow renders *inside*
// FishZoneApp rather than replacing it — writing to localStorage alone
// wouldn't be re-read, so the pick has to reach that live state directly.
export function OnboardingFlow({
  onCityChosen,
  onForgotPassword,
  initialStep,
  onBackToShare,
}: {
  onCityChosen?: (city: CityId) => void
  onForgotPassword: () => void
  // Opened from a guest's shared screen (GuestShareScreen): straight to
  // sign-up or sign-in, and «back» returns to that screen, not to Welcome.
  initialStep?: 'account' | 'signin'
  onBackToShare?: () => void
}) {
  const { user, signOut, signInWithTelegram } = useAuth()
  // Only true for an account that just got silently created by the Telegram
  // auto-sign-in (see AuthProvider) — offers a way out for someone who
  // actually already has an email account, instead of stranding them on a
  // freshly-made, empty Telegram-linked one. Read once: by the time this
  // matters (NameStep) the WebApp object is already populated.
  const [viaTelegram] = useState(() => typeof window !== 'undefined' && !!window.Telegram?.WebApp?.initData)
  const { data: myProfile, isLoading: myProfileLoading } = useProfile(user?.id ?? null)
  const [step, setStep] = useState<Step>(initialStep ?? 'welcome')
  const updateProfile = useUpdateProfile()

  // Resumes an in-progress account exactly once per mount. Deliberately NOT
  // re-run on every myProfile cache update — a successful NameStep save
  // would otherwise recompute 'name' again and trap the user re-submitting
  // it forever. All forward movement after this is local setStep() calls.
  //
  // Only territoryColor is a reliable nullable checkpoint (name always falls
  // back to a default display name server-side, city/territory-intro/
  // catch-intro persist nothing at all) — so a reload mid tail just restarts
  // that tail from 'city' rather than trying to guess exactly which of the
  // unpersisted screens was last seen.
  // Decided once, during render, as soon as the profile is in.
  const [resumed, setResumed] = useState(false)
  const [resumeTarget, setResumeTarget] = useState<Step>('name')
  if (user && !resumed && !myProfileLoading && myProfile) {
    setResumed(true)
    // Already finished: nothing to resume (defensive; the gate unmounts us shortly anyway).
    if (!myProfile.onboardingCompleted) {
      const target: Step = myProfile.territoryColor === null ? 'name' : 'city'
      // Telegram already silently signed this account in — Welcome still gets
      // shown (see WelcomeStep's onContinue variant below) instead of jumping
      // straight past it, so there's at least one deliberate tap before
      // landing in the wizard. A resumed *web* session skips it as before.
      if (viaTelegram) setResumeTarget(target)
      else setStep(target)
    }
  }

  if (user && myProfileLoading) return null

  if (step === 'welcome') {
    if (viaTelegram)
      return (
        <WelcomeStep
          onContinue={async () => {
            if (!user) {
              // Signed out earlier this Mini App session — re-run the handshake;
              // once it resolves, the resume effect above (keyed on `user`) and
              // FishZoneApp's own gate take over from here, so there's nothing
              // left to do in this branch — setting a step now would only race
              // ahead of the profile fetch it depends on.
              await signInWithTelegram()
              return
            }
            setStep(resumeTarget)
          }}
        />
      )
    return <WelcomeStep onCapture={() => setStep('account')} onSignIn={() => setStep('signin')} />
  }
  const backFromAuth = () => (onBackToShare ? onBackToShare() : setStep('welcome'))
  if (step === 'signin') return <SignInStep onBack={backFromAuth} onForgotPassword={onForgotPassword} />
  if (step === 'account') return <AccountStep onBack={backFromAuth} />
  if (step === 'name')
    return (
      <NameStep
        initialName={myProfile?.displayName ?? ''}
        // AccountStep (email signup) makes no sense to land on for a
        // Telegram-authenticated user — send them back to Welcome instead.
        onBack={() => setStep(viaTelegram ? 'welcome' : 'account')}
        onDone={() => setStep('color')}
        onSwitchToEmailSignIn={
          viaTelegram
            ? async () => {
                await signOut()
                setStep('signin')
              }
            : undefined
        }
      />
    )
  if (step === 'color') return <ColorStep onBack={() => setStep('name')} onDone={() => setStep('city')} />
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
