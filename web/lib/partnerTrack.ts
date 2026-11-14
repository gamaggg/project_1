'use client'

import { createClient } from '@/lib/supabase/client'
import { analyticsDeviceId } from '@/lib/analytics'

// What players do with a partner's pin and card, for the partner's statistics (supabase-drafts/partner-points-13-11/
// 03_partner_stats.sql, partner_point_track). Fire and forget: a failure never reaches the player. The database skips
// admins, double taps within 10 seconds and points that are not on the map; the admin's preview does not call this.
export type PartnerEventKind = 'pin' | 'open' | 'route' | 'call' | 'site' | 'copy_address' | 'copy_promo' | 'photo'

type Loose = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ error: unknown }> }

export function trackPartner(pointId: number, kind: PartnerEventKind) {
  if (typeof window === 'undefined' || pointId <= 0) return
  try {
    const db = createClient() as unknown as Loose
    Promise.resolve(db.rpc('partner_point_track', { p_point: pointId, p_kind: kind, p_device: analyticsDeviceId() })).catch(() => {})
  } catch {
    /* statistics never break the card */
  }
}
