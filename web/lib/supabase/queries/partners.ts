'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { CityId } from '@/lib/data/city'
import type { PartnerPoint, PartnerPointAdmin, PartnerPointInput, PartnerPrize } from '@/lib/data/partnerPoints'

// Partner points (supabase-drafts/partner-points-13-11, lib/data/partnerPoints.ts). The functions and the table are
// not in the generated types until the migration is applied, so the client is typed loosely here.
type Loose = {
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>
  from: (t: string) => {
    select: (cols: string) => { order: (col: string, o: { ascending: boolean }) => PromiseLike<{ data: unknown; error: { message: string } | null }> }
  }
}
const db = () => createClient() as unknown as Loose

type Row = {
  id: number
  city: CityId
  plan: 'start' | 'partner'
  name: string
  kind: string | null
  description: string | null
  hours: string | null
  address: string | null
  lat: number
  lng: number
  phone: string | null
  website: string | null
  photos: string[] | null
  promo_code: string | null
  promo_discount: string | null
  promo_terms: string | null
  prize_title: string | null
  prize_from: string | null
  prize_weeks: string[] | null
  ends_at: string
  icon?: string | null
  starts_at?: string
  paused?: boolean
  created_at?: string
}

const toPoint = (r: Row): PartnerPoint => ({
  id: Number(r.id),
  city: r.city,
  plan: r.plan,
  name: r.name,
  kind: r.kind,
  description: r.description,
  hours: r.hours,
  address: r.address,
  lat: Number(r.lat),
  lng: Number(r.lng),
  phone: r.phone,
  website: r.website,
  photos: r.photos ?? [],
  promoCode: r.promo_code,
  promoDiscount: r.promo_discount,
  promoTerms: r.promo_terms,
  prizeTitle: r.prize_title,
  prizeFrom: r.prize_from ?? (r.prize_title ? r.name : null),
  prizeWeeks: r.prize_weeks ?? [],
  endsAt: r.ends_at,
  icon: r.icon ?? null,
})

// The points on the map now (every city; there are few). Before the migration the function is missing: no points,
// no error on the screen.
export function usePartnerPoints() {
  return useQuery({
    queryKey: ['partner-points'],
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async (): Promise<PartnerPoint[]> => {
      const { data, error } = await db().rpc('partner_points_live')
      if (error) return []
      return ((data as Row[] | null) ?? []).map(toPoint)
    },
  })
}

// The weekly prize of the city for the week starting `monday` ('YYYY-MM-DD', city time), or null.
export function usePartnerPrize(city: CityId, monday: string) {
  return useQuery({
    queryKey: ['partner-prize', city, monday],
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async (): Promise<PartnerPrize | null> => {
      const { data, error } = await db().rpc('partner_prize_of_week', { p_city: city, p_week: monday })
      if (error) return null
      const r = ((data as { point_id: number; name: string; prize_title: string; prize_from: string; lat: number; lng: number; address: string | null }[] | null) ?? [])[0]
      return r ? { pointId: Number(r.point_id), name: r.name, prizeTitle: r.prize_title, prizeFrom: r.prize_from, lat: Number(r.lat), lng: Number(r.lng), address: r.address } : null
    },
  })
}

// Every point, past and paused too: the super admin's screen (the table lets only the super admin read it).
export function useAdminPartnerPoints(enabled: boolean) {
  return useQuery({
    queryKey: ['admin-partner-points'],
    enabled,
    queryFn: async (): Promise<PartnerPointAdmin[]> => {
      const { data, error } = await db().from('partner_points').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return ((data as Row[] | null) ?? []).map((r) => ({
        ...toPoint(r),
        // The admin sees what was typed, not the fallbacks the map uses.
        prizeFrom: r.prize_from,
        prizeWeeks: r.prize_weeks ?? [],
        startsAt: r.starts_at ?? r.ends_at,
        paused: !!r.paused,
        createdAt: r.created_at ?? r.ends_at,
      }))
    },
  })
}

function useInvalidate() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['admin-partner-points'] })
    qc.invalidateQueries({ queryKey: ['partner-points'] })
    qc.invalidateQueries({ queryKey: ['partner-prize'] })
    qc.invalidateQueries({ queryKey: ['admin-actions'] })
  }
}

export function useSavePartnerPoint() {
  const done = useInvalidate()
  return useMutation({
    mutationFn: async ({ id, input }: { id: number | null; input: PartnerPointInput }) => {
      const { data, error } = await db().rpc('admin_partner_point_save', { p_id: id, p: input })
      if (error) throw new Error(error.message)
      return Number(data)
    },
    onSuccess: done,
  })
}

export function useDeletePartnerPoint() {
  const done = useInvalidate()
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await db().rpc('admin_partner_point_delete', { p_id: id })
      if (error) throw new Error(error.message)
    },
    onSuccess: done,
  })
}

// ---- Statistics (03_partner_stats.sql) ----

export type PartnerStatKind = 'pin' | 'open' | 'route' | 'call' | 'site' | 'copy_address' | 'copy_promo' | 'photo'
export type PartnerStats = {
  people: number
  totals: Record<PartnerStatKind, { count: number; people: number }>
  funnel: { opened: number; copied: number; copied_then_route: number; copied_then_call: number; copied_then_site: number; copied_then_any: number }
  days: { day: string; pin: number; open: number; copy_promo: number }[]
  tz: string
}

// The point's numbers for [from, to). The super admin, or the player the point was shared with.
export function usePartnerStats(pointId: number | null, from: string, to: string) {
  return useQuery({
    queryKey: ['partner-stats', pointId, from, to],
    enabled: pointId != null,
    staleTime: 30_000,
    queryFn: async (): Promise<PartnerStats> => {
      const { data, error } = await db().rpc('partner_point_stats', { p_point: pointId, p_from: from, p_to: to })
      if (error) throw new Error(error.message)
      return data as PartnerStats
    },
  })
}

export type SharedPartnerPoint = { id: number; city: CityId; name: string; startsAt: string; endsAt: string; paused: boolean }

// The points whose statistics were shared with me (a partner's own account). Empty before the migration.
export function useSharedPartnerPoints(enabled: boolean) {
  return useQuery({
    queryKey: ['partner-shared'],
    enabled,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async (): Promise<SharedPartnerPoint[]> => {
      const { data, error } = await db().rpc('partner_points_shared_with_me')
      if (error) return []
      return ((data as { id: number; city: CityId; name: string; starts_at: string; ends_at: string; paused: boolean }[] | null) ?? []).map((r) => ({
        id: Number(r.id),
        city: r.city,
        name: r.name,
        startsAt: r.starts_at,
        endsAt: r.ends_at,
        paused: r.paused,
      }))
    },
  })
}

export type PartnerViewer = { userId: string; displayName: string | null; avatarUrl: string | null; grantedAt: string }

export function useAdminPartnerViewers(pointId: number | null) {
  return useQuery({
    queryKey: ['admin-partner-viewers', pointId],
    enabled: pointId != null,
    queryFn: async (): Promise<PartnerViewer[]> => {
      const { data, error } = await db().rpc('admin_partner_viewers', { p_point: pointId })
      if (error) throw new Error(error.message)
      return ((data as { user_id: string; display_name: string | null; avatar_url: string | null; granted_at: string }[] | null) ?? []).map((r) => ({
        userId: r.user_id,
        displayName: r.display_name,
        avatarUrl: r.avatar_url,
        grantedAt: r.granted_at,
      }))
    },
  })
}

// The points a player can see the statistics of (their profile, for the super admin).
export function useAdminPartnerAccessOf(userId: string | null) {
  return useQuery({
    queryKey: ['admin-partner-access', userId],
    enabled: !!userId,
    queryFn: async (): Promise<number[]> => {
      const { data, error } = await db().rpc('admin_partner_access_of', { p_user: userId })
      if (error) throw new Error(error.message)
      return ((data as { point_id: number }[] | null) ?? []).map((r) => Number(r.point_id))
    },
  })
}

export function useSetPartnerViewer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ pointId, userId, on }: { pointId: number; userId: string; on: boolean }) => {
      const { error } = await db().rpc('admin_partner_viewer_set', { p_point: pointId, p_user: userId, p_on: on })
      if (error) throw new Error(error.message)
    },
    onSuccess: (_d, { pointId, userId }) => {
      qc.invalidateQueries({ queryKey: ['admin-partner-viewers', pointId] })
      qc.invalidateQueries({ queryKey: ['admin-partner-access', userId] })
      qc.invalidateQueries({ queryKey: ['admin-actions'] })
    },
  })
}
