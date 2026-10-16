import { tn } from '@/lib/i18n/runtime'

// Small fixed list, same spirit as METHODS/BAITS in species.ts — not a DB
// table, since it's a handful of options picked from a <select>, not a
// growing reference catalog.
export const REPORT_REASONS = [
  'Фото не с этого места',
  'Похоже на чужое или скачанное фото',
  'На фото нет рыбы/улова',
  'Оскорбительное или неприемлемое содержание',
]

// Comments are text, not photos — none of the photo-specific reasons above
// apply, so they get their own short list (see CommentsSheet).
export const COMMENT_REPORT_REASONS = ['Оскорбление', 'Спам или реклама', 'Другое']

// What the person sees. The values above are what is stored and what the
// moderators read (in Russian), so they stay as they are; only the label is
// translated.
export function reportReasonLabel(reason: string): string {
  const i = REPORT_REASONS.indexOf(reason)
  if (i >= 0) return tn(`reportReason.r${i}` as 'reportReason.r0')
  const c = COMMENT_REPORT_REASONS.indexOf(reason)
  if (c >= 0) return tn(`reportReason.c${c}` as 'reportReason.c0')
  return reason
}
