'use client'

import { lazyComponent } from '@/components/app-shell/lazyComponent'

// Screens and modals kept out of the startup bundle (see lazyComponent).
// Anything opened on most visits — map, sector, rating, activity, profile,
// the catch flow — stays a plain import in FishZoneApp.

const spinner = (
  <div className="lazy-loading">
    <div className="spinner" />
  </div>
)

// Shown at launch only on their own rare paths (a password-reset link,
// linking an email from the profile) — a spinner while the chunk arrives.
export const ForgotPasswordFlow = lazyComponent(
  () => import('@/components/app-shell/onboarding/ForgotPasswordFlow').then((m) => m.ForgotPasswordFlow),
  spinner,
)
export const LinkEmailFlow = lazyComponent(
  () => import('@/components/app-shell/onboarding/LinkEmailFlow').then((m) => m.LinkEmailFlow),
  spinner,
)

export const LastWeekScreen = lazyComponent(() => import('@/components/app-shell/screens/LastWeekScreen').then((m) => m.LastWeekScreen))
export const ClanRaceScreen = lazyComponent(() => import('@/components/app-shell/screens/ClanRaceScreen').then((m) => m.ClanRaceScreen))
export const ClanChatScreen = lazyComponent(() => import('@/components/app-shell/screens/ClanChatScreen').then((m) => m.ClanChatScreen))
export const ClanEditorScreen = lazyComponent(() => import('@/components/app-shell/screens/ClanEditorScreen').then((m) => m.ClanEditorScreen))
export const UsersListScreen = lazyComponent(() => import('@/components/app-shell/screens/UsersListScreen').then((m) => m.UsersListScreen))
export const AchievementsScreen = lazyComponent(() => import('@/components/app-shell/screens/AchievementsScreen').then((m) => m.AchievementsScreen))
export const AchievementDetailScreen = lazyComponent(() =>
  import('@/components/app-shell/screens/AchievementDetailScreen').then((m) => m.AchievementDetailScreen),
)
export const WeekTopModal = lazyComponent(() => import('@/components/app-shell/screens/WeekTopModal').then((m) => m.WeekTopModal))
export const AchievementUnlockedModal = lazyComponent(() =>
  import('@/components/app-shell/screens/AchievementUnlockedModal').then((m) => m.AchievementUnlockedModal),
)
export const ClanBattleCeremony = lazyComponent(() => import('@/components/app-shell/ClanBattleCeremony').then((m) => m.ClanBattleCeremony))

// Admin tools — only preloaded for admins.
export const AdminReportsScreen = lazyComponent(() => import('@/components/app-shell/screens/AdminReportsScreen').then((m) => m.AdminReportsScreen))
export const AdminActionsScreen = lazyComponent(() => import('@/components/app-shell/screens/AdminActionsScreen').then((m) => m.AdminActionsScreen))
export const AdminAccessScreen = lazyComponent(() => import('@/components/app-shell/screens/AdminAccessScreen').then((m) => m.AdminAccessScreen))
export const AdminPermissionsModal = lazyComponent(() => import('@/components/app-shell/AdminPermissionsModal').then((m) => m.AdminPermissionsModal))
export const DeleteTerritoryModal = lazyComponent(() => import('@/components/app-shell/screens/DeleteTerritoryModal').then((m) => m.DeleteTerritoryModal))
export const BulkDeleteTerritoriesModal = lazyComponent(() =>
  import('@/components/app-shell/screens/BulkDeleteTerritoriesModal').then((m) => m.BulkDeleteTerritoriesModal),
)
export const BulkAddTerritoriesModal = lazyComponent(() =>
  import('@/components/app-shell/screens/BulkAddTerritoriesModal').then((m) => m.BulkAddTerritoriesModal),
)
export const DeleteUserModal = lazyComponent(() => import('@/components/app-shell/screens/DeleteUserModal').then((m) => m.DeleteUserModal))
export const ChangeUserIdModal = lazyComponent(() => import('@/components/app-shell/screens/ChangeUserIdModal').then((m) => m.ChangeUserIdModal))
export const GrantCoinsModal = lazyComponent(() => import('@/components/app-shell/screens/GrantCoinsModal').then((m) => m.GrantCoinsModal))
export const PostAnnouncementModal = lazyComponent(() =>
  import('@/components/app-shell/screens/PostAnnouncementModal').then((m) => m.PostAnnouncementModal),
)
export const MoveCatchSheet = lazyComponent(() => import('@/components/app-shell/MoveCatchSheet').then((m) => m.MoveCatchSheet))
export const EditCatchSheet = lazyComponent(() => import('@/components/app-shell/EditCatchSheet').then((m) => m.EditCatchSheet))

const everyone = [
  ForgotPasswordFlow,
  LinkEmailFlow,
  LastWeekScreen,
  ClanRaceScreen,
  ClanChatScreen,
  ClanEditorScreen,
  UsersListScreen,
  AchievementsScreen,
  AchievementDetailScreen,
  WeekTopModal,
  AchievementUnlockedModal,
  ClanBattleCeremony,
]

const adminOnly = [
  AdminReportsScreen,
  AdminActionsScreen,
  AdminAccessScreen,
  AdminPermissionsModal,
  DeleteTerritoryModal,
  BulkDeleteTerritoriesModal,
  BulkAddTerritoriesModal,
  DeleteUserModal,
  ChangeUserIdModal,
  GrantCoinsModal,
  PostAnnouncementModal,
  MoveCatchSheet,
  EditCatchSheet,
]

// Fetched one after another rather than all at once, so they never compete
// with a request the user is actually waiting on. A failure is fine here —
// opening that screen later simply tries again.
export async function preloadLazyScreens(admin: boolean) {
  for (const component of admin ? [...everyone, ...adminOnly] : everyone) {
    await component.preload().catch(() => {})
  }
}
