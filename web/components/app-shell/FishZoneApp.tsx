'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useTerritories, useConfirmCatch } from '@/lib/supabase/queries'
import { getCurrentCoords, nearestTerritory } from '@/lib/geolocation'
import { uploadCatchPhoto } from '@/lib/supabase/storage'
import type { PendingCatch } from '@/lib/data/types'
import { BottomNav } from '@/components/app-shell/BottomNav'
import { MapScreen } from '@/components/app-shell/screens/MapScreen'
import type { LeafletMapHandle } from '@/components/app-shell/LeafletMap'
import { TerritoryScreen } from '@/components/app-shell/screens/TerritoryScreen'
import { TerritoriesListScreen } from '@/components/app-shell/screens/TerritoriesListScreen'
import { CameraScreen } from '@/components/app-shell/screens/CameraScreen'
import { ConfirmScreen, type CatchFormData, type PhotoStatus } from '@/components/app-shell/screens/ConfirmScreen'
import { ActivityScreen } from '@/components/app-shell/screens/ActivityScreen'
import { ProfileScreen } from '@/components/app-shell/screens/ProfileScreen'
import { UserProfileScreen } from '@/components/app-shell/screens/UserProfileScreen'

export type ScreenId =
  | 'screen-map'
  | 'screen-territory'
  | 'screen-territories'
  | 'screen-camera'
  | 'screen-confirm'
  | 'screen-activity'
  | 'screen-profile'
  | 'screen-user-profile'

const NAV_SCREENS: ScreenId[] = ['screen-map', 'screen-territories', 'screen-activity', 'screen-profile']

export function FishZoneApp() {
  const { user, loading: authLoading, signOut } = useAuth()
  const { data: territories = [], isLoading: territoriesLoading } = useTerritories()
  const confirmCatchMutation = useConfirmCatch()
  const mapHandleRef = useRef<LeafletMapHandle>(null)

  const [currentScreen, setCurrentScreen] = useState<ScreenId>('screen-map')
  const [navScreen, setNavScreen] = useState<ScreenId>('screen-map')
  const [activeTerritoryId, setActiveTerritoryId] = useState<string | null>(null)
  const [viewedUserId, setViewedUserId] = useState<string | null>(null)
  const [pendingCatch, setPendingCatch] = useState<PendingCatch | null>(null)
  const [confirmStep, setConfirmStep] = useState<'form' | 'success'>('form')
  const [wasFree, setWasFree] = useState(false)
  const [capturedPhoto, setCapturedPhoto] = useState<Blob | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoStatus, setPhotoStatus] = useState<PhotoStatus>('uploading')
  // CameraScreen never unmounts on its own (screens stay mounted, only their CSS
  // 'active' class toggles) — bump this on every fresh entry into screen-camera
  // and pass it as `key` so getUserMedia state resets instead of reusing a
  // stopped stream from a previous catch.
  const [cameraSessionId, setCameraSessionId] = useState(0)
  const [locating, setLocating] = useState(false)
  const [outOfZone, setOutOfZone] = useState(false)
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
  // Viewing yourself through this path (e.g. tapping your own name somewhere)
  // just goes to the real (editable) profile tab instead of a second read-only
  // copy of it.
  function openUserProfile(id: string) {
    if (id === user?.id) {
      navClick('screen-profile')
      return
    }
    setViewedUserId(id)
    goTo('screen-user-profile')
  }
  // "+" in the bottom nav is the ONLY way into the camera/catch flow — picking a
  // sector by hand (map/list) only ever opens the read-only TerritoryScreen, see
  // DECISIONS.md. Finds the visitor's current position (asked on-demand here, not
  // eagerly on the map screen), always drops a marker for it on the map, and only
  // proceeds to the camera if that position actually lands on a sector.
  async function handlePlus() {
    if (!user) {
      navClick('screen-profile')
      return
    }
    setLocating(true)
    showToast('Определяем твоё местоположение…')
    const coords = await getCurrentCoords()
    setLocating(false)
    if (!coords) {
      showToast('Не получилось определить твоё местоположение. Попробуй ещё раз')
      return
    }
    mapHandleRef.current?.showUserLocation(coords.lat, coords.lng)
    const found = nearestTerritory(coords.lat, coords.lng, territories)
    setToast(null)
    if (found) {
      mapHandleRef.current?.flyToTerritory(found.id)
      setActiveTerritoryId(found.id)
      setCameraSessionId((n) => n + 1)
      goTo('screen-camera')
      return
    }
    setOutOfZone(true)
  }
  async function startUpload(blob: Blob) {
    if (!user) return
    try {
      const url = await uploadCatchPhoto(user.id, blob)
      setPhotoUrl(url)
      setPhotoStatus('success')
    } catch {
      setPhotoStatus('error')
    }
  }
  // Upload starts right after the shutter fires, not at form submit — the user
  // fills in species/length/etc. on screen-confirm while it runs in the background.
  function handleCapture(blob: Blob) {
    if (!activeTerritoryId) return
    setCapturedPhoto(blob)
    setPhotoUrl(null)
    setPhotoStatus('uploading')
    setConfirmStep('form')
    goTo('screen-confirm')
    void startUpload(blob)
  }
  function retryUpload() {
    if (!capturedPhoto) return
    setPhotoStatus('uploading')
    void startUpload(capturedPhoto)
  }
  function backToCamera() {
    setCapturedPhoto(null)
    setPhotoUrl(null)
    setCameraSessionId((n) => n + 1)
    goTo('screen-camera')
  }
  async function submitCatch(form: CatchFormData) {
    if (!activeTerritoryId || !photoUrl) return
    const t = territories.find((x) => x.id === activeTerritoryId)
    const payload: PendingCatch = { territoryId: activeTerritoryId, photoUrl, ...form }
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
    setCapturedPhoto(null)
    setPhotoUrl(null)
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
          {activeTerritory && <TerritoryScreen territory={activeTerritory} onBack={() => goTo('screen-map')} onOpenUser={openUserProfile} />}
        </Screen>
        <Screen id="screen-territories" current={currentScreen}>
          <TerritoriesListScreen territories={territories} onOpenTerritory={openTerritory} />
        </Screen>
        <Screen id="screen-camera" current={currentScreen}>
          <CameraScreen key={cameraSessionId} onBack={() => goTo('screen-map')} onCapture={handleCapture} />
        </Screen>
        <Screen id="screen-confirm" current={currentScreen}>
          {activeTerritory && capturedPhoto && (confirmStep === 'form' || pendingCatch) && (
            <ConfirmScreen
              territory={activeTerritory}
              pendingCatch={pendingCatch}
              wasFree={wasFree}
              step={confirmStep}
              pending={confirmCatchMutation.isPending}
              capturedPhoto={capturedPhoto}
              photoStatus={photoStatus}
              onRetryUpload={retryUpload}
              onSubmit={submitCatch}
              onFinish={finishCatchFlow}
              onBack={backToCamera}
              onShare={() => showToast('Ссылка на улов скопирована')}
            />
          )}
        </Screen>
        <Screen id="screen-activity" current={currentScreen}>
          <ActivityScreen onOpenUser={openUserProfile} />
        </Screen>
        <Screen id="screen-profile" current={currentScreen}>
          <ProfileScreen myTerritories={myTerritories} onOpenTerritory={openTerritory} onSignOut={signOut} />
        </Screen>
        <Screen id="screen-user-profile" current={currentScreen}>
          {viewedUserId && (
            <UserProfileScreen
              userId={viewedUserId}
              territories={territories.filter((t) => t.ownerId === viewedUserId)}
              onBack={() => goTo('screen-activity')}
              onOpenTerritory={openTerritory}
            />
          )}
        </Screen>
      </div>

      <div className={`toast${toast ? ' show' : ''}`}>{toast}</div>

      {outOfZone && (
        <div className="modal-overlay" onClick={() => setOutOfZone(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Ты не на территории</div>
            <div className="modal-body">
              Похоже, сейчас ты не находишься ни на одном из секторов лова — зафиксировать улов не получится. Подойди ближе к воде и попробуй ещё раз.
            </div>
            <button className="btn-primary" onClick={() => setOutOfZone(false)}>
              Понятно
            </button>
          </div>
        </div>
      )}

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
