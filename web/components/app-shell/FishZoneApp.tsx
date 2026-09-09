'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useTerritories, useConfirmCatch, useProfile } from '@/lib/supabase/queries'
import { getCurrentCoords, nearestTerritory } from '@/lib/geolocation'
import { uploadCatchPhoto } from '@/lib/supabase/storage'
import { useActivityReadState, useAdminActionsReadState } from '@/lib/activityRead'
import { useAchievementUnlock } from '@/lib/achievementUnlock'
import { formatCooldown } from '@/lib/format'
import { DEFAULT_TERRITORY_COLOR } from '@/lib/data/territoryColors'
import type { PendingCatch } from '@/lib/data/types'
import { OnboardingFlow } from '@/components/app-shell/onboarding/OnboardingFlow'
import { BottomNav } from '@/components/app-shell/BottomNav'
import { PhotoLightbox } from '@/components/app-shell/PhotoLightbox'
import { MapScreen } from '@/components/app-shell/screens/MapScreen'
import type { LeafletMapHandle } from '@/components/app-shell/LeafletMap'
import { TerritoryScreen } from '@/components/app-shell/screens/TerritoryScreen'
import { TerritoriesListScreen } from '@/components/app-shell/screens/TerritoriesListScreen'
import { UsersListScreen } from '@/components/app-shell/screens/UsersListScreen'
import { CameraScreen } from '@/components/app-shell/screens/CameraScreen'
import { ConfirmScreen, type CatchFormData, type PhotoStatus } from '@/components/app-shell/screens/ConfirmScreen'
import { ActivityScreen } from '@/components/app-shell/screens/ActivityScreen'
import { ProfileScreen, EditProfileModal, ChangeColorModal } from '@/components/app-shell/screens/ProfileScreen'
import { UserProfileScreen } from '@/components/app-shell/screens/UserProfileScreen'
import { ReportPhotoModal } from '@/components/app-shell/screens/ReportPhotoModal'
import { DeleteCatchModal } from '@/components/app-shell/screens/DeleteCatchModal'
import { DeleteTerritoryModal } from '@/components/app-shell/screens/DeleteTerritoryModal'
import { DeleteUserModal } from '@/components/app-shell/screens/DeleteUserModal'
import { AchievementUnlockedModal } from '@/components/app-shell/screens/AchievementUnlockedModal'
import { AdminReportsScreen } from '@/components/app-shell/screens/AdminReportsScreen'
import { AdminActionsScreen } from '@/components/app-shell/screens/AdminActionsScreen'
import { AdminAccessScreen } from '@/components/app-shell/screens/AdminAccessScreen'
import { AchievementsScreen } from '@/components/app-shell/screens/AchievementsScreen'
import { AchievementDetailScreen } from '@/components/app-shell/screens/AchievementDetailScreen'
import type { Achievement } from '@/lib/data/achievements'

export type ScreenId =
  | 'screen-map'
  | 'screen-territory'
  | 'screen-territories'
  | 'screen-users'
  | 'screen-camera'
  | 'screen-confirm'
  | 'screen-activity'
  | 'screen-profile'
  | 'screen-user-profile'
  | 'screen-admin-reports'
  | 'screen-admin-access'
  | 'screen-admin-log'
  | 'screen-achievements'
  | 'screen-achievement-detail'

export type TabScreenId = 'screen-map' | 'screen-territories' | 'screen-activity' | 'screen-profile'
const NAV_SCREENS: ScreenId[] = ['screen-map', 'screen-territories', 'screen-activity', 'screen-profile']

// A real navigation stack, not a single "current screen" — so every back
// button returns to wherever you actually drilled in from (map, a list, a
// territory, someone else's profile, ...), including several levels deep.
// Territory/user-profile entries carry their own id so popping back through
// a chain that visited a *different* territory/profile in between restores
// the right one instead of whatever was opened last (see DECISIONS.md).
type StackEntry =
  | { screen: 'screen-map' }
  | { screen: 'screen-territory'; territoryId: string }
  | { screen: 'screen-territories' }
  | { screen: 'screen-users' }
  | { screen: 'screen-camera' }
  | { screen: 'screen-confirm' }
  | { screen: 'screen-activity' }
  | { screen: 'screen-profile' }
  | { screen: 'screen-user-profile'; userId: string }
  | { screen: 'screen-admin-reports' }
  | { screen: 'screen-admin-access' }
  | { screen: 'screen-admin-log' }
  | { screen: 'screen-achievements'; userId: string }
  | { screen: 'screen-achievement-detail'; userId: string; icon: Achievement['icon'] }

export function FishZoneApp() {
  const { user, loading: authLoading, signOut } = useAuth()
  const { data: myProfile, isLoading: myProfileLoading } = useProfile(user?.id ?? null)
  const { data: territories = [], isLoading: territoriesLoading, isSuccess: territoriesReady } = useTerritories()
  const confirmCatchMutation = useConfirmCatch()
  const mapHandleRef = useRef<LeafletMapHandle>(null)
  const { unreadIds, unreadCount, markAllRead } = useActivityReadState()
  const { unreadCount: adminLogUnreadCount, markAllRead: markAdminLogRead } = useAdminActionsReadState()
  const { current: unlockedAchievement, dismiss: dismissUnlockedAchievement } = useAchievementUnlock(territories, territoriesReady)

  const [stack, setStack] = useState<StackEntry[]>([{ screen: 'screen-map' }])
  const [navScreen, setNavScreen] = useState<TabScreenId>('screen-map')
  const [viewingTerritoryId, setViewingTerritoryId] = useState<string | null>(null)
  const [viewingUserId, setViewingUserId] = useState<string | null>(null)
  const [viewingAchievementsUserId, setViewingAchievementsUserId] = useState<string | null>(null)
  const [viewingAchievementDetail, setViewingAchievementDetail] = useState<{ userId: string; icon: Achievement['icon'] } | null>(null)
  // Separate from viewingTerritoryId on purpose: this is which territory the
  // camera/confirm flow is for, not what TerritoryScreen should browse to —
  // conflating the two used to mean pressing "+" while browsing a territory
  // could clobber the one you were looking at (see DECISIONS.md).
  const [catchTerritoryId, setCatchTerritoryId] = useState<string | null>(null)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [editingProfile, setEditingProfile] = useState(false)
  const [changingColor, setChangingColor] = useState(false)
  const [confirmingSignOut, setConfirmingSignOut] = useState(false)
  const [cooldownSeconds, setCooldownSeconds] = useState<number | null>(null)
  const [reportingCatchId, setReportingCatchId] = useState<number | null>(null)
  const [deletingCatchId, setDeletingCatchId] = useState<number | null>(null)
  const [deletingTerritoryId, setDeletingTerritoryId] = useState<string | null>(null)
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null)
  const { data: deletingUserProfile } = useProfile(deletingUserId)
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

  const currentScreen: ScreenId = stack[stack.length - 1].screen
  // The trophy-card celebration is full-bleed and edge-to-edge on purpose —
  // both the nav and any achievement popup stay off it, see below.
  const showingTrophyScene = currentScreen === 'screen-confirm' && confirmStep === 'success'

  // Drill-in navigation (territory, camera, confirm, someone's profile) — push
  // onto the stack so the eventual back button unwinds to exactly this point.
  function push(entry: StackEntry) {
    setStack((s) => [...s, entry])
  }
  // Generic back button target for every screen below — pops one level and,
  // if that reveals a territory/user-profile entry, restores which one it was
  // (see StackEntry comment above).
  function pop() {
    setStack((s) => {
      if (s.length <= 1) return s
      const next = s.slice(0, -1)
      const top = next[next.length - 1]
      if (top.screen === 'screen-territory') setViewingTerritoryId(top.territoryId)
      if (top.screen === 'screen-user-profile') setViewingUserId(top.userId)
      if (top.screen === 'screen-achievements') setViewingAchievementsUserId(top.userId)
      if (top.screen === 'screen-achievement-detail') setViewingAchievementDetail({ userId: top.userId, icon: top.icon })
      return next
    })
  }
  // Bottom-nav taps replace the whole stack — each tab starts its own fresh
  // drill-down, it doesn't resume wherever you left off inside another tab.
  function resetTo(entry: StackEntry) {
    setStack([entry])
  }
  function navClick(id: TabScreenId) {
    resetTo({ screen: id })
    setNavScreen(id)
  }
  function openTerritory(id: string) {
    // A "Последние действия"/activity link can point at a sector a super
    // admin has since deleted (admin_delete_territory) — it's gone from
    // `territories` (see useTerritories' is_deleted filter), so guard
    // against pushing a screen that'd render blank.
    if (!territories.some((t) => t.id === id)) {
      showToast('Этот сектор удалён')
      return
    }
    setViewingTerritoryId(id)
    push({ screen: 'screen-territory', territoryId: id })
  }
  // Viewing yourself through this path (e.g. tapping your own name somewhere)
  // just goes to the real (editable) profile tab instead of a second read-only
  // copy of it.
  function openUserProfile(id: string) {
    if (id === user?.id) {
      navClick('screen-profile')
      return
    }
    setViewingUserId(id)
    push({ screen: 'screen-user-profile', userId: id })
  }
  function openAchievements(userId: string) {
    setViewingAchievementsUserId(userId)
    push({ screen: 'screen-achievements', userId })
  }
  function openAchievementDetail(userId: string, icon: Achievement['icon']) {
    setViewingAchievementDetail({ userId, icon })
    push({ screen: 'screen-achievement-detail', userId, icon })
  }
  function openReportModal(catchId: number) {
    if (!user) {
      navClick('screen-profile')
      return
    }
    setReportingCatchId(catchId)
  }
  // Admin-only escape hatch from TerritoryScreen: same tail end as handlePlus()
  // after a successful nearestTerritory() match, minus the geolocation call —
  // see DECISIONS.md, confirm_catch never checked location server-side anyway.
  function startAdminCatch(territoryId: string) {
    setCatchTerritoryId(territoryId)
    setCameraSessionId((n) => n + 1)
    push({ screen: 'screen-camera' })
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
      setCatchTerritoryId(found.id)
      setCameraSessionId((n) => n + 1)
      push({ screen: 'screen-camera' })
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
    if (!catchTerritoryId) return
    setCapturedPhoto(blob)
    setPhotoUrl(null)
    setPhotoStatus('uploading')
    setConfirmStep('form')
    push({ screen: 'screen-confirm' })
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
    pop()
  }
  async function submitCatch(form: CatchFormData) {
    if (!catchTerritoryId || !photoUrl) return
    const t = territories.find((x) => x.id === catchTerritoryId)
    const payload: PendingCatch = { territoryId: catchTerritoryId, photoUrl, ...form }
    try {
      await confirmCatchMutation.mutateAsync(payload)
      setWasFree(t?.status !== 'mine')
      setPendingCatch(payload)
      setConfirmStep('success')
    } catch (err) {
      // Supabase's PostgrestError isn't an Error instance — duck-type the
      // message instead of `instanceof Error` (see confirm_catch's
      // COOLDOWN: exception, surfaced verbatim as error.message).
      const message = typeof err === 'object' && err !== null && 'message' in err ? String((err as { message: unknown }).message) : ''
      const match = /COOLDOWN:(\d+)/.exec(message)
      if (match) {
        setCooldownSeconds(Number(match[1]))
      } else {
        showToast('Не удалось сохранить улов, попробуй ещё раз')
      }
    }
  }
  function finishCatchFlow() {
    setPendingCatch(null)
    setCapturedPhoto(null)
    setPhotoUrl(null)
    setCatchTerritoryId(null)
    navClick('screen-map')
  }
  // Real clipboard write, not a fake toast — the link round-trips through the
  // deep-link effect below, which opens screen-territory straight from it.
  async function shareTerritory(territoryId: string) {
    const url = `${window.location.origin}${window.location.pathname}?territory=${territoryId}`
    try {
      await navigator.clipboard.writeText(url)
      showToast('Ссылка на территорию скопирована')
    } catch {
      showToast('Не удалось скопировать ссылку')
    }
  }

  const viewingTerritory = territories.find((t) => t.id === viewingTerritoryId) ?? null
  const catchTerritory = territories.find((t) => t.id === catchTerritoryId) ?? null
  const myTerritories = territories.filter((t) => t.status === 'mine')

  // Opens a ?territory=<id> link (from shareTerritory above) straight into
  // that sector on first load. Guarded by a ref, not just the effect's deps,
  // since territories can re-fetch/re-render many times over the session but
  // this should only ever fire once. Query string is cleared afterwards so a
  // later refresh/back doesn't reopen it.
  const deepLinkOpened = useRef(false)
  useEffect(() => {
    if (deepLinkOpened.current || territoriesLoading || !territories.length) return
    const id = new URLSearchParams(window.location.search).get('territory')
    if (id && territories.some((t) => t.id === id)) {
      deepLinkOpened.current = true
      openTerritory(id)
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [territories, territoriesLoading])

  if (authLoading || (user && myProfileLoading)) {
    return <LoadingShell />
  }

  // Onboarding gate: no account, or an account that hasn't finished the
  // wizard (onboarding_completed=false) — never render the real map/screens
  // in either case. See DECISIONS.md.
  if (!user || (myProfile && !myProfile.onboardingCompleted)) {
    return (
      <div className="app-shell">
        <OnboardingFlow />
      </div>
    )
  }

  if (territoriesLoading) {
    return <LoadingShell />
  }

  const myTerritoryColor = myProfile?.territoryColor ?? DEFAULT_TERRITORY_COLOR

  return (
    <div className="app-shell">
      <div className="screens">
        <Screen id="screen-map" current={currentScreen}>
          <MapScreen ref={mapHandleRef} territories={territories} myTerritoryColor={myTerritoryColor} onOpenTerritory={openTerritory} />
        </Screen>
        <Screen id="screen-territory" current={currentScreen}>
          {viewingTerritory && (
            <TerritoryScreen
              territory={viewingTerritory}
              myTerritoryColor={myTerritoryColor}
              onBack={pop}
              onOpenUser={openUserProfile}
              onOpenPhoto={setLightboxSrc}
              onReportPhoto={openReportModal}
              onAdminCatch={startAdminCatch}
              onDeleteCatch={setDeletingCatchId}
              onDeleteTerritory={setDeletingTerritoryId}
              onShare={() => shareTerritory(viewingTerritory.id)}
            />
          )}
        </Screen>
        <Screen id="screen-territories" current={currentScreen}>
          <TerritoriesListScreen
            territories={territories}
            myTerritoryColor={myTerritoryColor}
            onOpenTerritory={openTerritory}
            onOpenUsersList={() => push({ screen: 'screen-users' })}
          />
        </Screen>
        <Screen id="screen-users" current={currentScreen}>
          <UsersListScreen onBack={pop} onOpenUser={openUserProfile} />
        </Screen>
        <Screen id="screen-camera" current={currentScreen}>
          <CameraScreen key={cameraSessionId} onBack={pop} onCapture={handleCapture} />
        </Screen>
        <Screen id="screen-confirm" current={currentScreen}>
          {catchTerritory && capturedPhoto && (confirmStep === 'form' || pendingCatch) && (
            <ConfirmScreen
              territory={catchTerritory}
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
              onShare={() => shareTerritory(catchTerritory.id)}
            />
          )}
        </Screen>
        <Screen id="screen-activity" current={currentScreen}>
          <ActivityScreen onOpenUser={openUserProfile} onOpenTerritory={openTerritory} onOpenPhoto={setLightboxSrc} unreadIds={unreadIds} onMarkAllRead={markAllRead} />
        </Screen>
        <Screen id="screen-profile" current={currentScreen}>
          <ProfileScreen
            myTerritories={myTerritories}
            allTerritories={territories}
            onOpenTerritory={openTerritory}
            onSignOut={() => setConfirmingSignOut(true)}
            onEditProfile={() => setEditingProfile(true)}
            onChangeColor={() => setChangingColor(true)}
            onOpenPhoto={setLightboxSrc}
            onOpenReports={() => push({ screen: 'screen-admin-reports' })}
            onOpenAdminAccess={() => push({ screen: 'screen-admin-access' })}
            onOpenAdminLog={() => {
              markAdminLogRead()
              push({ screen: 'screen-admin-log' })
            }}
            adminLogUnreadCount={adminLogUnreadCount}
            onOpenAchievements={() => user && openAchievements(user.id)}
            onOpenAchievementDetail={(icon) => user && openAchievementDetail(user.id, icon)}
            onShowToast={showToast}
          />
        </Screen>
        <Screen id="screen-user-profile" current={currentScreen}>
          {viewingUserId && (
            <UserProfileScreen
              userId={viewingUserId}
              territories={territories.filter((t) => t.ownerId === viewingUserId)}
              allTerritories={territories}
              onBack={pop}
              onOpenTerritory={openTerritory}
              onOpenPhoto={setLightboxSrc}
              onOpenAchievements={() => openAchievements(viewingUserId)}
              onOpenAchievementDetail={(icon) => openAchievementDetail(viewingUserId, icon)}
              onDeleteUser={setDeletingUserId}
            />
          )}
        </Screen>
        <Screen id="screen-achievements" current={currentScreen}>
          {viewingAchievementsUserId && (
            <AchievementsScreen
              userId={viewingAchievementsUserId}
              territories={territories}
              onBack={pop}
              onOpenDetail={(icon) => openAchievementDetail(viewingAchievementsUserId, icon)}
            />
          )}
        </Screen>
        <Screen id="screen-achievement-detail" current={currentScreen}>
          {viewingAchievementDetail && (
            <AchievementDetailScreen
              userId={viewingAchievementDetail.userId}
              icon={viewingAchievementDetail.icon}
              territories={territories}
              onBack={pop}
              onShowToast={showToast}
            />
          )}
        </Screen>
        <Screen id="screen-admin-reports" current={currentScreen}>
          <AdminReportsScreen onBack={pop} onOpenPhoto={setLightboxSrc} onOpenUser={openUserProfile} onOpenTerritory={openTerritory} />
        </Screen>
        <Screen id="screen-admin-access" current={currentScreen}>
          <AdminAccessScreen onBack={pop} onOpenUser={openUserProfile} />
        </Screen>
        <Screen id="screen-admin-log" current={currentScreen}>
          <AdminActionsScreen title="Последние действия" onBack={pop} onOpenUser={openUserProfile} onOpenTerritory={openTerritory} />
        </Screen>
      </div>

      <div className={`toast${toast ? ' show' : ''}`}>{toast}</div>

      {outOfZone && (
        <div className="modal-overlay" onClick={() => setOutOfZone(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 21c-4-4.5-7-8-7-11a7 7 0 0 1 14 0c0 3-3 6.5-7 11z" />
                <circle cx="12" cy="10" r="2.3" />
                <path d="M4 4l16 16" />
              </svg>
            </div>
            <div className="modal-title">Ты не на территории</div>
            <div className="modal-body">Подойди ближе к воде, чтобы зафиксировать улов.</div>
            <button className="btn-primary" onClick={() => setOutOfZone(false)}>
              Понятно
            </button>
          </div>
        </div>
      )}

      {cooldownSeconds !== null && (
        <div className="modal-overlay" onClick={() => setCooldownSeconds(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon" style={{ background: 'linear-gradient(160deg,#FFB067,#FC5200 65%)' }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3.5 2" />
              </svg>
            </div>
            <div className="modal-title">Небольшой перерыв</div>
            <div className="modal-body">Следующий улов можно добавить через {formatCooldown(cooldownSeconds)}.</div>
            <button className="btn-primary" onClick={() => setCooldownSeconds(null)}>
              Понятно
            </button>
          </div>
        </div>
      )}

      {confirmingSignOut && (
        <div className="modal-overlay" onClick={() => setConfirmingSignOut(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon" style={{ background: 'linear-gradient(160deg,#FF6B6B,#D33 65%)' }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="M16 17l5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
            </div>
            <div className="modal-title">Выйти из аккаунта?</div>
            <div className="modal-body">Тебе нужно будет войти снова, чтобы продолжить пользоваться RANGE.</div>
            <button
              className="btn-danger"
              onClick={() => {
                setConfirmingSignOut(false)
                void signOut()
              }}
            >
              Выйти
            </button>
            <button className="btn-secondary" style={{ marginTop: 8 }} onClick={() => setConfirmingSignOut(false)}>
              Отмена
            </button>
          </div>
        </div>
      )}

      {editingProfile && <EditProfileModal onClose={() => setEditingProfile(false)} />}
      {changingColor && <ChangeColorModal onClose={() => setChangingColor(false)} />}
      {lightboxSrc && <PhotoLightbox src={lightboxSrc} alt="Улов" onClose={() => setLightboxSrc(null)} />}
      {reportingCatchId !== null && (
        <ReportPhotoModal
          catchId={reportingCatchId}
          onClose={() => setReportingCatchId(null)}
          onSubmitted={() => showToast('Жалоба отправлена, спасибо')}
        />
      )}
      {deletingCatchId !== null && (
        <DeleteCatchModal
          catchId={deletingCatchId}
          onClose={() => setDeletingCatchId(null)}
          onDeleted={() => showToast('Улов удалён')}
        />
      )}
      {deletingTerritoryId !== null && (
        <DeleteTerritoryModal
          territoryId={deletingTerritoryId}
          onClose={() => setDeletingTerritoryId(null)}
          onDeleted={() => {
            pop()
            showToast('Сектор удалён')
          }}
        />
      )}
      {deletingUserId !== null && (
        <DeleteUserModal
          userId={deletingUserId}
          userName={deletingUserProfile?.displayName ?? 'этого пользователя'}
          onClose={() => setDeletingUserId(null)}
          onDeleted={() => {
            pop()
            showToast('Пользователь удалён')
          }}
        />
      )}
      {/* Held back while the trophy-card success screen is up so it never stacks
          on top of that screen's own celebration — it shows right after
          "Готово"/"Поделиться уловом" moves on, instead. */}
      {unlockedAchievement && !showingTrophyScene && (
        <AchievementUnlockedModal achievement={unlockedAchievement} onClose={dismissUnlockedAchievement} onShowToast={showToast} />
      )}

      {currentScreen !== 'screen-camera' && !showingTrophyScene && (
        <BottomNav
          active={NAV_SCREENS.includes(currentScreen) ? (currentScreen as TabScreenId) : navScreen}
          onNavigate={navClick}
          onPlus={handlePlus}
          plusPending={locating}
          unreadCount={unreadCount}
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

function LoadingShell() {
  return (
    <div className="app-shell" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-soft)' }}>Загрузка RANGE…</div>
    </div>
  )
}
