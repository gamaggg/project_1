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
