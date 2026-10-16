'use client'

import { useState } from 'react'
import { IntroJourney } from '@/components/app-shell/onboarding/IntroJourney'
import { OnboardingCrossfade } from '@/components/app-shell/onboarding/OnboardingCrossfade'
import { AccountStep } from '@/components/app-shell/onboarding/AccountStep'
import { OtpCodeStep } from '@/components/app-shell/onboarding/OtpCodeStep'
import { NameStep } from '@/components/app-shell/onboarding/NameStep'
import { ColorStep } from '@/components/app-shell/onboarding/ColorStep'
import { CityStep } from '@/components/app-shell/onboarding/CityStep'
import { SignInStep } from '@/components/app-shell/onboarding/SignInStep'
import type { Stage } from '@/lib/welcome/journeyScene'

// The whole onboarding, every screen in order, to look at without making an
// account: the welcome and the two intro screens (one picture), then the email
// sign-up, the confirmation code, the name, the colour, the city — and from the
// city back to the start, so nothing ever finishes. The steps that write (account,
// name, colour, city) are in their `preview` mode: they go on without writing
// anything. Open at /onboarding-preview (development only); the list in the corner
// jumps to a screen.
type Step = Stage | 'account' | 'otp' | 'name' | 'color' | 'city' | 'signin'
const ORDER: Step[] = ['welcome', 'territory-intro', 'catch-intro', 'account', 'otp', 'name', 'color', 'city']
const LABEL: Record<Step, string> = {
  welcome: '1 · welcome',
  'territory-intro': '2 · territory',
  'catch-intro': '3 · catch',
  account: '4 · account',
  otp: '5 · code',
  name: '6 · name',
  color: '7 · color',
  city: '8 · city',
  signin: '(sign in)',
}

export function OnboardingPreview() {
  const [step, setStep] = useState<Step>('welcome')
  const go = (d: number) => setStep((s) => ORDER[(ORDER.indexOf(s) + d + ORDER.length) % ORDER.length])
  return (
    <div className="app-shell" style={{ position: 'fixed' }}>
      <select
        value={step}
        onChange={(e) => setStep(e.target.value as Step)}
        style={{ position: 'fixed', top: 6, right: 6, zIndex: 9999, fontSize: 12, padding: '2px 4px', borderRadius: 6, border: '1px solid #ccc', background: '#fff', color: '#17181B' }}
      >
        {(Object.keys(LABEL) as Step[]).map((s) => (
          <option key={s} value={s}>
            {LABEL[s]}
          </option>
        ))}
      </select>
      <div className="screens" style={{ position: 'absolute', inset: 0, overflow: 'auto' }}>
        <OnboardingCrossfade
          journey={
            step === 'welcome' || step === 'territory-intro' || step === 'catch-intro' ? (
              <IntroJourney stage={step} onStage={setStep} onSignIn={() => setStep('signin')} onFinish={() => setStep('account')} />
            ) : null
          }
          rest={
            step === 'account' ? (
              <AccountStep onBack={() => setStep('catch-intro')} preview onPreviewDone={() => setStep('otp')} />
            ) : step === 'otp' ? (
              <OtpCodeStep
                email="you@example.com"
                type="signup"
                title="Проверь почту"
                subtitle="Мы отправили код на you@example.com"
                ctaLabel="Подтвердить"
                onBack={() => setStep('account')}
                onVerified={() => setStep('name')}
                onResend={async () => ({ error: null })}
              />
            ) : step === 'name' ? (
              <NameStep initialName="" onBack={() => go(-1)} onDone={() => go(1)} preview />
            ) : step === 'color' ? (
              <ColorStep onBack={() => go(-1)} onDone={() => go(1)} preview />
            ) : step === 'city' ? (
              <CityStep onBack={() => go(-1)} onDone={() => setStep('welcome')} preview />
            ) : step === 'signin' ? (
              <SignInStep onBack={() => setStep('welcome')} onForgotPassword={() => {}} />
            ) : null
          }
        />
      </div>
    </div>
  )
}
