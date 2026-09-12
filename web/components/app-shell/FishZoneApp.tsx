'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useTerritories, useConfirmCatch, useProfile, useUpdateProfile, useRealtimeSync, useIsSuperAdmin, useAllTerritoryIds } from '@/lib/supabase/queries'
import { getCurrentCoords, nearestTerritory, queryGeolocationPermission } from '@/lib/geolocation'
import { uploadCatchPhoto } from '@/lib/supabase/storage'
import { useActivityReadState, useAdminActionsReadState } from '@/lib/activityRead'
import { useAchievementUnlock } from '@/lib/achievementUnlock'
import { useWeekTopModal } from '@/lib/weekTopModal'
import { formatCooldown } from '@/lib/format'
import { DEFAULT_TERRITORY_COLOR } from '@/lib/data/territoryColors'
import { draftHexAt } from '@/lib/data/hexGrid'
import { cityForSectorId, loadStoredCity, storeCity, type CityId } from '@/lib/data/city'
import type { PendingCatch, TerritoryStatus } from '@/lib/data/types'
import { OnboardingFlow } from '@/components/app-shell/onboarding/OnboardingFlow'
import { BottomNav } from '@/components/app-shell/BottomNav'
import { PhotoLightbox } from '@/components/app-shell/PhotoLightbox'
import { MapScreen } from '@/components/app-shell/screens/MapScreen'
import type { LeafletMapHandle } from '@/components/app-shell/LeafletMap'
import { TerritoryScreen } from '@/components/app-shell/screens/TerritoryScreen'
import { TerritoriesListScreen, type Mode as RatingMode } from '@/components/app-shell/screens/TerritoriesListScreen'
import { LastWeekScreen } from '@/components/app-shell/screens/LastWeekScreen'
import { WeekTopModal } from '@/components/app-shell/screens/WeekTopModal'
import { MyCatchesScreen } from '@/components/app-shell/screens/MyCatchesScreen'
import { UsersListScreen } from '@/components/app-shell/screens/UsersListScreen'
import { CameraScreen } from '@/components/app-shell/screens/CameraScreen'
import { ConfirmScreen, type CatchFormData, type PhotoStatus } from '@/components/app-shell/screens/ConfirmScreen'
import { ActivityScreen } from '@/components/app-shell/screens/ActivityScreen'
import { ProfileScreen, EditProfileModal, ChangeColorModal } from '@/components/app-shell/screens/ProfileScreen'
import { CityPickerModal } from '@/components/app-shell/CityPickerModal'
import { UserProfileScreen } from '@/components/app-shell/screens/UserProfileScreen'
import { ReportPhotoModal } from '@/components/app-shell/screens/ReportPhotoModal'
import { DeleteCatchModal } from '@/components/app-shell/screens/DeleteCatchModal'
import { DeleteTerritoryModal } from '@/components/app-shell/screens/DeleteTerritoryModal'
import { BulkDeleteTerritoriesModal } from '@/components/app-shell/screens/BulkDeleteTerritoriesModal'
import { BulkAddTerritoriesModal } from '@/components/app-shell/screens/BulkAddTerritoriesModal'
import { DeleteUserModal } from '@/components/app-shell/screens/DeleteUserModal'
import { AchievementUnlockedModal } from '@/components/app-shell/screens/AchievementUnlockedModal'
import { AwardDetailModal } from '@/components/app-shell/AwardDetailModal'
import type { UserAward } from '@/lib/data/types'
import { AdminReportsScreen } from '@/components/app-shell/screens/AdminReportsScreen'
import { AdminActionsScreen } from '@/components/app-shell/screens/AdminActionsScreen'
import { AdminAccessScreen } from '@/components/app-shell/screens/AdminAccessScreen'
import { AdminPermissionsModal } from '@/components/app-shell/AdminPermissionsModal'
import { AchievementsScreen } from '@/components/app-shell/screens/AchievementsScreen'
import { AchievementDetailScreen } from '@/components/app-shell/screens/AchievementDetailScreen'
import type { Achievement } from '@/lib/data/achievements'

export type ScreenId =
  | 'screen-map'
  | 'screen-territory'
  | 'screen-territories'
  | 'screen-catches'
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
  | 'screen-last-week'

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
  | { screen: 'screen-territories'; initialFilter?: TerritoryStatus; initialMode?: RatingMode }
  | { screen: 'screen-catches'; userId?: string; territoryId?: string }
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
  | { screen: 'screen-last-week' }

export function FishZoneApp() {
  const { user, loading: authLoading, signOut } = useAuth()
  const { data: myProfile, isLoading: myProfileLoading } = useProfile(user?.id ?? null)
  const { data: territories = [], isLoading: territoriesLoading, isSuccess: territoriesReady } = useTerritories()
  const isSuperAdmin = useIsSuperAdmin()
  const { data: allTerritoryIds = [] } = useAllTerritoryIds()
  const confirmCatchMutation = useConfirmCatch()
  const mapHandleRef = useRef<LeafletMapHandle>(null)
  const { unreadIds, unreadCount, markAllRead } = useActivityReadState()
  const { unreadCount: adminLogUnreadCount, markAllRead: markAdminLogRead } = useAdminActionsReadState()
  // Which city's sectors the map/territories tab/rating currently show — the
  // signed-in user's own `profiles.city` (see lib/data/city) once it loads.
  // Starts on Batumi and syncs from localStorage right after mount so
  // server-rendered and first-client-render markup still agree and there's
  // no flicker while the profile fetch is in flight; the profile value (once
  // loaded) then wins, since it's the real cross-device source of truth.
  // Declared before useAchievementUnlock below since that hook's achievement
  // computation is itself city-aware (see lib/data/achievements).
  const [city, setCity] = useState<CityId>('batumi')
  useEffect(() => {
    setCity(loadStoredCity())
  }, [])
  useEffect(() => {
    if (myProfile?.city) setCity(myProfile.city)
  }, [myProfile?.city])
  const updateProfile = useUpdateProfile()
  const { current: unlockedAchievement, dismiss: dismissUnlockedAchievement } = useAchievementUnlock(territories, territoriesReady, city)
  const { show: showWeekTop, entry: weekTopEntry, dismiss: dismissWeekTop } = useWeekTopModal()
  useRealtimeSync()

  // Jumps straight to the map tab on switch — the whole point of picking a
  // city is to see its sectors, and that's the one screen where the change
  // is immediately visible (unlike Territории/Профиль, which just relabel).
  function changeCity(next: CityId) {
    setCity(next)
    storeCity(next)
    if (user) updateProfile.mutate({ city: next })
    resetTo({ screen: 'screen-map' })
    setNavScreen('screen-map')
  }
  const [changingCity, setChangingCity] = useState(false)
  const cityTerritories = useMemo(() => territories.filter((t) => cityForSectorId(t.id) === city), [territories, city])

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
  const [openAward, setOpenAward] = useState<UserAward | null>(null)
  const [editingAdminAccessId, setEditingAdminAccessId] = useState<string | null>(null)
  const [cooldownSeconds, setCooldownSeconds] = useState<number | null>(null)
  const [reportingCatchId, setReportingCatchId] = useState<number | null>(null)
  const [deletingCatchId, setDeletingCatchId] = useState<number | null>(null)
  const [deletingTerritoryId, setDeletingTerritoryId] = useState<string | null>(null)
  // Multi-select on the map for bulk deletion (super admin only) — a Set so
  // toggling one sector doesn't touch the others, and a fresh Set instance on
  // every change so LeafletMap's redraw effect (keyed on this by reference)
  // picks it up.
  const [selectedTerritoryIds, setSelectedTerritoryIds] = useState<Set<string>>(new Set())
  const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false)
  // New-sector placement batch (super admin only) — each draft snapped to
  // the same hex grid as every existing sector (see lib/data/hexGrid.ts), no
  // id/kind yet (chosen once for the whole batch in the confirm modal).
  const [pendingAddDrafts, setPendingAddDrafts] = useState<{ lat: number; lng: number; corners: [number, number][]; gridX: number; gridY: number }[]>([])
  const [confirmingBulkAdd, setConfirmingBulkAdd] = useState(false)
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

  const topEntry = stack[stack.length - 1]
  const currentScreen: ScreenId = topEntry.screen
  const territoriesInitialFilter = topEntry.screen === 'screen-territories' ? topEntry.initialFilter : undefined
  const territoriesInitialMode = topEntry.screen === 'screen-territories' ? topEntry.initialMode : undefined
  const catchesTerritoryId = topEntry.screen === 'screen-catches' ? topEntry.territoryId : undefined
  const catchesUserId = topEntry.screen === 'screen-catches' && !catchesTerritoryId ? (topEntry.userId ?? user?.id) : undefined
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
  // "Все мои территории" from the profile — jumps to the same Территории tab
  // (pre-filtered to "Мои"), same as tapping the tab itself, not a drill-in
  // (see DECISIONS.md: TerritoriesListScreen has no back button, it's a tab).
  function openMyTerritories() {
    resetTo({ screen: 'screen-territories', initialFilter: 'mine', initialMode: 'territories' })
    setNavScreen('screen-territories')
  }
  // "Перейти к текущему рейтингу" from the last-week recap — same reset-tab
  // pattern as openMyTerritories, landing straight on the live Рейтинг view
  // instead of wherever Территории was last left (see TerritoriesListScreen's
  // initialMode re-sync effect).
  function openWeeklyRating() {
    resetTo({ screen: 'screen-territories', initialMode: 'rating' })
    setNavScreen('screen-territories')
  }
  // Drill-in from the WeekTopModal (which can show over any tab) — a real
  // push so its back button returns to wherever the modal actually caught you.
  function openLastWeek() {
    push({ screen: 'screen-last-week' })
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
  function toggleTerritorySelection(id: string) {
    setSelectedTerritoryIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  // Long-press start of a bulk-delete selection — only ever wired up for a
  // super admin (see the <MapScreen> prop below), but double-checked here too.
  function handleLongPressTerritory(id: string) {
    if (!isSuperAdmin || pendingAddDrafts.length > 0) return
    toggleTerritorySelection(id)
  }
  // While a selection is active, a plain tap on the map picks/unpicks sectors
  // instead of opening TerritoryScreen — but only for the map itself, so
  // territory links elsewhere (list, activity feed) keep navigating normally
  // even mid-selection.
  function handleMapTerritoryClick(id: string) {
    if (isSuperAdmin && selectedTerritoryIds.size > 0) {
      toggleTerritorySelection(id)
      return
    }
    openTerritory(id)
  }
  function cancelTerritorySelection() {
    setSelectedTerritoryIds(new Set())
  }
  // Toggling by grid cell (not lat/lng) means tapping the same spot twice
  // removes it again, and two taps that snap to the same cell never double
  // it up — mirrors toggleTerritorySelection's add/remove-by-id symmetry.
  function toggleAddDraft(lat: number, lng: number) {
    const { lat: cLat, lng: cLng, corners, gridX, gridY } = draftHexAt(lat, lng, 'sea', city)
    // Belt-and-suspenders on top of LeafletMap's own stopPropagation fix
    // (which is what actually stops a press on an existing sector from also
    // reaching this handler): every existing territory's own lat/lng came
    // from this exact same grid math, so a genuine cell match lands far
    // closer than 0.0001° — real neighboring cells are ~0.003°+ apart. A
    // sector already there means this press missed the stopPropagation
    // guard somehow; no-op rather than stack a duplicate on top of it.
    const collides = territories.some((t) => Math.abs(t.lat - cLat) < 0.0001 && Math.abs(t.lng - cLng) < 0.0001)
    if (collides) return
    setPendingAddDrafts((prev) => {
      const i = prev.findIndex((d) => d.gridX === gridX && d.gridY === gridY)
      if (i >= 0) return prev.filter((_, idx) => idx !== i)
      return [...prev, { lat: cLat, lng: cLng, corners, gridX, gridY }]
    })
  }
  // Long-press on empty map starts a new-sector batch — blocked while a
  // delete selection is active so the two admin gestures never overlap.
  function handleLongPressEmptyMap(lat: number, lng: number) {
    if (!isSuperAdmin || selectedTerritoryIds.size > 0) return
    toggleAddDraft(lat, lng)
  }
  function handleClickEmptyMap(lat: number, lng: number) {
    if (!isSuperAdmin || pendingAddDrafts.length === 0) return
    toggleAddDraft(lat, lng)
  }
  function cancelAddDrafts() {
    setPendingAddDrafts([])
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
      // "Попробуй ещё раз" is actively wrong once permission is explicitly
      // denied — the browser blocks getCurrentPosition silently forever
      // after that, no retry will ever succeed without a settings change.
      const permission = await queryGeolocationPermission()
      showToast(
        permission === 'denied'
          ? 'Доступ к геолокации запрещён. Разреши его в настройках браузера для этого сайта'
          : 'Не получилось определить твоё местоположение. Попробуй ещё раз'
      )
      return
    }
    mapHandleRef.current?.showUserLocation(coords.lat, coords.lng)
    const found = nearestTerritory(coords.lat, coords.lng, cityTerritories)
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
        <OnboardingFlow onCityChosen={changeCity} />
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
          <MapScreen
            ref={mapHandleRef}
            territories={cityTerritories}
            myTerritoryColor={myTerritoryColor}
            onOpenTerritory={handleMapTerritoryClick}
            selectedIds={isSuperAdmin ? selectedTerritoryIds : undefined}
            onLongPressTerritory={isSuperAdmin ? handleLongPressTerritory : undefined}
            onDeleteSelected={() => setConfirmingBulkDelete(true)}
            onCancelSelection={cancelTerritorySelection}
            pendingAddDrafts={isSuperAdmin ? pendingAddDrafts : undefined}
            onLongPressEmptyMap={isSuperAdmin ? handleLongPressEmptyMap : undefined}
            onClickEmptyMap={isSuperAdmin ? handleClickEmptyMap : undefined}
            onConfirmAdd={() => setConfirmingBulkAdd(true)}
            onCancelAdd={cancelAddDrafts}
            city={city}
          />
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
              onOpenAllCatches={() => push({ screen: 'screen-catches', territoryId: viewingTerritory.id })}
            />
          )}
        </Screen>
        <Screen id="screen-territories" current={currentScreen}>
          <TerritoriesListScreen
            territories={cityTerritories}
            myTerritoryColor={myTerritoryColor}
            city={city}
            initialFilter={territoriesInitialFilter}
            initialMode={territoriesInitialMode}
            onOpenTerritory={openTerritory}
            onOpenUsersList={() => push({ screen: 'screen-users' })}
            onOpenUser={openUserProfile}
          />
        </Screen>
        <Screen id="screen-last-week" current={currentScreen}>
          <LastWeekScreen city={city} onBack={pop} onOpenUser={openUserProfile} onOpenCurrentRating={openWeeklyRating} />
        </Screen>
        <Screen id="screen-catches" current={currentScreen}>
          {(catchesUserId || catchesTerritoryId) && (
            <MyCatchesScreen userId={catchesUserId} territoryId={catchesTerritoryId} onBack={pop} onOpenPhoto={setLightboxSrc} onOpenUser={openUserProfile} />
          )}
        </Screen>
        <Screen id="screen-users" current={currentScreen}>
          <UsersListScreen onBack={pop} onOpenUser={openUserProfile} />
        </Screen>
        <Screen id="screen-camera" current={currentScreen}>
          <CameraScreen key={cameraSessionId} active={currentScreen === 'screen-camera'} onBack={pop} onCapture={handleCapture} />
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
            city={city}
            onOpenTerritory={openTerritory}
            onOpenAllTerritories={openMyTerritories}
            onOpenAllCatches={() => push({ screen: 'screen-catches' })}
            onSignOut={() => setConfirmingSignOut(true)}
            onEditProfile={() => setEditingProfile(true)}
            onChangeColor={() => setChangingColor(true)}
            onOpenCityPicker={() => setChangingCity(true)}
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
            onOpenAward={setOpenAward}
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
              onOpenAllCatches={() => push({ screen: 'screen-catches', userId: viewingUserId })}
              onDeleteUser={setDeletingUserId}
              onOpenAward={setOpenAward}
              onEditAdminAccess={setEditingAdminAccessId}
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
          <AdminAccessScreen onBack={pop} onOpenUser={openUserProfile} onEditAccess={setEditingAdminAccessId} />
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
      {changingColor && <ChangeColorModal onClose={() => setChangingColor(false)} city={city} />}
      {changingCity && <CityPickerModal city={city} onChange={changeCity} onClose={() => setChangingCity(false)} />}
      {editingAdminAccessId && <AdminPermissionsModal userId={editingAdminAccessId} onClose={() => setEditingAdminAccessId(null)} />}
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
      {confirmingBulkDelete && (
        <BulkDeleteTerritoriesModal
          territoryIds={[...selectedTerritoryIds]}
          onClose={() => setConfirmingBulkDelete(false)}
          onDeleted={() => {
            const count = selectedTerritoryIds.size
            setSelectedTerritoryIds(new Set())
            showToast(count === 1 ? 'Сектор удалён' : `Секторов удалено: ${count}`)
          }}
        />
      )}
      {confirmingBulkAdd && (
        <BulkAddTerritoriesModal
          drafts={pendingAddDrafts}
          existingIds={allTerritoryIds}
          city={city}
          onClose={() => setConfirmingBulkAdd(false)}
          onAdded={() => {
            const count = pendingAddDrafts.length
            setPendingAddDrafts([])
            showToast(count === 1 ? 'Сектор создан' : `Секторов создано: ${count}`)
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
      {openAward && <AwardDetailModal award={openAward} onClose={() => setOpenAward(null)} />}
      {/* Deferred behind the achievement modal above so the two celebrations
          never stack — this one waits its turn and appears once that clears. */}
      {showWeekTop && weekTopEntry && !unlockedAchievement && !showingTrophyScene && (
        <WeekTopModal
          entry={weekTopEntry}
          onViewRecap={() => {
            dismissWeekTop()
            openLastWeek()
          }}
          onClose={dismissWeekTop}
        />
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
    <div className="app-shell loading-shell">
      {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset, same as MapScreen's brandmark */}
      <img src="/brand/logo_1.svg" alt="RANGE" className="loading-shell-logo" />
      <div className="spinner" />
    </div>
  )
}
