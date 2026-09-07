'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useTerritories, useConfirmCatch } from '@/lib/supabase/queries'
import { findMyTerritory } from '@/lib/geolocation'
import type { PendingCatch } from '@/lib/data/types'
import { BottomNav } from '@/components/app-shell/BottomNav'
import { MapScreen } from '@/components/app-shell/screens/MapScreen'
import type { LeafletMapHandle } from '@/components/app-shell/LeafletMap'
import { TerritoryScreen } from '@/components/app-shell/screens/TerritoryScreen'
import { TerritoriesListScreen } from '@/components/app-shell/screens/TerritoriesListScreen'
import { CameraScreen } from '@/components/app-shell/screens/CameraScreen'
import { ConfirmScreen, type CatchFormData } from '@/components/app-shell/screens/ConfirmScreen'
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
  const { user, loading: authLoading, signOut } = useAuth()
  const { data: territories = [], isLoading: territoriesLoading } = useTerritories()
  const confirmCatchMutation = useConfirmCatch()
  const mapHandleRef = useRef<LeafletMapHandle>(null)

  const [currentScreen, setCurrentScreen] = useState<ScreenId>('screen-map')
  const [navScreen, setNavScreen] = useState<ScreenId>('screen-map')
  const [activeTerritoryId, setActiveTerritoryId] = useState<string | null>(null)
  const [pendingCatch, setPendingCatch] = useState<PendingCatch | null>(null)
  const [confirmStep, setConfirmStep] = useState<'form' | 'success'>('form')
  const [wasFree, setWasFree] = useState(false)
  const [locating, setLocating] = useState(false)
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
  // Explicit territory (e.g. the CTA on TerritoryScreen) — no geolocation needed,
  // the user already picked a sector.
  function startCatchFlow(territoryId: string) {
    if (!user) {
      navClick('screen-profile')
      return
    }
    setActiveTerritoryId(territoryId)
    goTo('screen-camera')
  }
  // "+" in the bottom nav — no territory picked yet. Finds the nearest sector to
  // the visitor's current position (see DECISIONS.md: asked on-demand here, not
  // eagerly on the map screen) and jumps straight to the camera for it.
  async function handlePlus() {
    if (!user) {
      navClick('screen-profile')
      return
    }
    setLocating(true)
    showToast('Определяем твоё местоположение…')
    const found = await findMyTerritory(territories)
    setLocating(false)
    if (found) {
      mapHandleRef.current?.flyToTerritory(found.id)
      setActiveTerritoryId(found.id)
      setToast(null)
      goTo('screen-camera')
      return
    }
    if (activeTerritoryId) {
      goTo('screen-camera')
      return
    }
    showToast('Не получилось определить локацию — выбери территорию на карте')
  }
  function takePhoto() {
    if (!activeTerritoryId) return
    setConfirmStep('form')
    goTo('screen-confirm')
  }
  async function submitCatch(form: CatchFormData) {
    if (!activeTerritoryId) return
    const t = territories.find((x) => x.id === activeTerritoryId)
    const payload: PendingCatch = { territoryId: activeTerritoryId, ...form }
    try {
      await confirmCatchMutation.mutateAsync(payload)
      setWasFree(t?.status !== 'mine')
      setPendingCatch(payload)
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
          <MapScreen ref={mapHandleRef} territories={territories} onOpenTerritory={openTerritory} />
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
          {activeTerritory && (confirmStep === 'form' || pendingCatch) && (
            <ConfirmScreen
              territory={activeTerritory}
              pendingCatch={pendingCatch}
              wasFree={wasFree}
              step={confirmStep}
              pending={confirmCatchMutation.isPending}
              onSubmit={submitCatch}
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
          onPlus={handlePlus}
          plusPending={locating}
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
