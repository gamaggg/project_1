'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/AuthProvider'
import { useTerritories, useConfirmCatch } from '@/lib/supabase/queries'
import { SPECIES, METHODS, BAITS } from '@/lib/data/species'
import type { PendingCatch } from '@/lib/data/types'
import { BottomNav } from '@/components/app-shell/BottomNav'
import { MapScreen } from '@/components/app-shell/screens/MapScreen'
import { TerritoryScreen } from '@/components/app-shell/screens/TerritoryScreen'
import { TerritoriesListScreen } from '@/components/app-shell/screens/TerritoriesListScreen'
import { CameraScreen } from '@/components/app-shell/screens/CameraScreen'
import { ConfirmScreen } from '@/components/app-shell/screens/ConfirmScreen'
import { ActivityScreen } from '@/components/app-shell/screens/ActivityScreen'
import { ProfileScreen } from '@/components/app-shell/screens/ProfileScreen'

export type ScreenId =
  | 'screen-map'
  | 'screen-territory'
  | 'screen-territories'
  | 'screen-camera'
  | 'screen-confirm'
  | 'screen-activity'
  | 'screen-profile'

const NAV_SCREENS: ScreenId[] = ['screen-map', 'screen-territories', 'screen-activity', 'screen-profile']

export function FishZoneApp() {
  const router = useRouter()
  const { user, loading: authLoading, signOut } = useAuth()
  const { data: territories = [], isLoading: territoriesLoading } = useTerritories()
  const confirmCatchMutation = useConfirmCatch()

  const [currentScreen, setCurrentScreen] = useState<ScreenId>('screen-map')
  const [navScreen, setNavScreen] = useState<ScreenId>('screen-map')
  const [activeTerritoryId, setActiveTerritoryId] = useState<string | null>(null)
  const [pendingCatch, setPendingCatch] = useState<PendingCatch | null>(null)
  const [confirmStep, setConfirmStep] = useState<'review' | 'success'>('review')
  const [wasFree, setWasFree] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 1700)
  }
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])

  function goTo(id: ScreenId) {
    setCurrentScreen(id)
  }
  function navClick(id: ScreenId) {
    goTo(id)
    setNavScreen(id)
  }
  function openTerritory(id: string) {
    setActiveTerritoryId(id)
    goTo('screen-territory')
  }
  function startCatchFlow(territoryId: string | null) {
    if (!user) {
      router.push('/auth')
      return
    }
    const id = territoryId ?? activeTerritoryId
    if (!id) {
      showToast('Сначала выбери территорию на карте')
      return
    }
    setActiveTerritoryId(id)
    goTo('screen-camera')
  }
  function takePhoto() {
    if (!activeTerritoryId) return
    const sp = SPECIES[Math.floor(Math.random() * SPECIES.length)]
    const lengthCm = Math.round(20 + Math.random() * 22)
    const weightKg = +(0.18 + (lengthCm / 32) * 0.28).toFixed(2)
    setPendingCatch({
      territoryId: activeTerritoryId,
      species: sp.key,
      lengthCm,
      weightKg,
      method: METHODS[Math.floor(Math.random() * METHODS.length)],
      bait: BAITS[Math.floor(Math.random() * BAITS.length)],
    })
    const t = territories.find((x) => x.id === activeTerritoryId)
    setWasFree(t?.status !== 'mine')
    setConfirmStep('review')
    goTo('screen-confirm')
  }
  async function confirmCatch() {
    if (!pendingCatch) return
    try {
      await confirmCatchMutation.mutateAsync(pendingCatch)
      setConfirmStep('success')
    } catch {
      showToast('Не удалось сохранить улов, попробуй ещё раз')
    }
  }
  function finishCatchFlow() {
    setPendingCatch(null)
    navClick('screen-map')
  }

  const activeTerritory = territories.find((t) => t.id === activeTerritoryId) ?? null
  const myTerritories = territories.filter((t) => t.status === 'mine')
  const confirmTerritory = pendingCatch ? territories.find((t) => t.id === pendingCatch.territoryId) : null

  if (authLoading || territoriesLoading) {
    return (
      <div className="app-shell" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-soft)' }}>Загрузка FishZone…</div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <div className="screens">
        <Screen id="screen-map" current={currentScreen}>
          <MapScreen territories={territories} onOpenTerritory={openTerritory} />
        </Screen>
        <Screen id="screen-territory" current={currentScreen}>
          {activeTerritory && (
            <TerritoryScreen territory={activeTerritory} onBack={() => goTo('screen-map')} onStartCatchFlow={startCatchFlow} />
          )}
        </Screen>
        <Screen id="screen-territories" current={currentScreen}>
          <TerritoriesListScreen territories={territories} onOpenTerritory={openTerritory} />
        </Screen>
        <Screen id="screen-camera" current={currentScreen}>
          <CameraScreen territory={activeTerritory} onBack={() => goTo('screen-map')} onShutter={takePhoto} />
        </Screen>
        <Screen id="screen-confirm" current={currentScreen}>
          {pendingCatch && confirmTerritory && (
            <ConfirmScreen
              pendingCatch={pendingCatch}
              territory={confirmTerritory}
              wasFree={wasFree}
              step={confirmStep}
              pending={confirmCatchMutation.isPending}
              onConfirm={confirmCatch}
              onFinish={finishCatchFlow}
              onBack={() => goTo('screen-camera')}
              onShare={() => showToast('Ссылка на улов скопирована')}
            />
          )}
        </Screen>
        <Screen id="screen-activity" current={currentScreen}>
          <ActivityScreen />
        </Screen>
        <Screen id="screen-profile" current={currentScreen}>
          <ProfileScreen myTerritories={myTerritories} onOpenTerritory={openTerritory} onSignOut={signOut} />
        </Screen>
      </div>

      <div className={`toast${toast ? ' show' : ''}`}>{toast}</div>

      {currentScreen !== 'screen-camera' && (
        <BottomNav
          active={NAV_SCREENS.includes(currentScreen) ? currentScreen : navScreen}
          onNavigate={navClick}
          onPlus={() => startCatchFlow(null)}
        />
      )}
    </div>
  )
}

function Screen({ id, current, children }: { id: ScreenId; current: ScreenId; children: React.ReactNode }) {
  return (
    <div className={`screen${current === id ? ' active' : ''}`} id={id}>
      {children}
    </div>
  )
}
