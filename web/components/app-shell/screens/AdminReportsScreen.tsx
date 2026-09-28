'use client'

import { useState } from 'react'
import {
  useReports,
  useAdminDeleteCatch,
  useDismissReport,
  useAdminCommentReports,
  useAdminDismissCommentReports,
  useDeleteComment,
  useAdminTextModerationLog,
  useAdminUnmuteUser,
  type TextModerationLogEntry,
} from '@/lib/supabase/queries'
import { BackButton } from '@/components/app-shell/BackButton'
import { formatWhen } from '@/lib/format'

// Where a turned-down text was written (text_moderation_log.context).
const CONTEXT_LABEL: Record<string, string> = {
  comment: 'Комментарий',
  clan_chat: 'Чат клана',
  clan_name: 'Название клана',
  clan_motto: 'Девиз клана',
  clan_announcement: 'Объявление клана',
}

const REASON_LABEL: Record<string, string> = {
  profanity: 'мат',
  link: 'ссылка',
  phone: 'телефон',
  caps: 'капс',
  repeat: 'повторы',
  reserved: 'занятое название',
  too_long: 'слишком длинно',
  empty: 'пусто',
}

function ModerationLogRow({ entry, onOpenUser, onUnmute, unmuting }: { entry: TextModerationLogEntry; onOpenUser: (id: string) => void; onUnmute: () => void; unmuting: boolean }) {
  const isMute = entry.context === 'mute'
  return (
    <div className={`card moderation-log-row${isMute ? ' is-mute' : ''}`}>
      {isMute ? (
        <div style={{ fontSize: 14, fontWeight: 800 }}>Включён мьют</div>
      ) : (
        entry.body && <div className="moderation-log-body">«{entry.body}»</div>
      )}
      <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 6 }}>
        <button className="activity-who-btn" onClick={() => onOpenUser(entry.userId)}>
          {entry.displayName}
        </button>
        {' · '}
        {isMute ? `после нарушения: ${REASON_LABEL[entry.reason] ?? entry.reason}` : `${CONTEXT_LABEL[entry.context] ?? entry.context} · ${REASON_LABEL[entry.reason] ?? entry.reason}`}
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 2 }}>{formatWhen(entry.createdAt)}</div>
      {entry.mutedUntil && (
        <div className="moderation-log-muted">
          <span>
            Мьют до {new Date(entry.mutedUntil).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button className="btn-secondary" style={{ width: 'auto', padding: '7px 14px', fontSize: 12.5 }} disabled={unmuting} onClick={onUnmute}>
            Снять мьют
          </button>
        </div>
      )}
    </div>
  )
}

export function AdminReportsScreen({
  onBack,
  onOpenPhoto,
  onOpenUser,
  onOpenTerritory,
}: {
  onBack: () => void
  onOpenPhoto: (catchId: number, commentId?: number | null) => void
  onOpenUser: (id: string) => void
  onOpenTerritory: (id: string) => void
}) {
  const [tab, setTab] = useState<'photos' | 'comments' | 'filter'>('photos')
  const { data: reports = [], isLoading } = useReports()
  const deleteCatch = useAdminDeleteCatch()
  const dismissReport = useDismissReport()
  // Fetched from the start (not only once the tab opens) so its count can
  // sit on the tab chip.
  const { data: commentReports = [], isLoading: commentsLoading } = useAdminCommentReports(true)
  const dismissCommentReports = useAdminDismissCommentReports()
  const deleteComment = useDeleteComment()
  // Only once the tab is opened — nothing here needs a count on the chip.
  const { data: moderationLog = [], isLoading: logLoading } = useAdminTextModerationLog(tab === 'filter')
  const unmute = useAdminUnmuteUser()
  // The newest row per user carries their mute, so «Снять мьют» shows once.
  const unmuteShownFor = new Set<string>()

  return (
    <>
      <div className="header-row">
        <BackButton onClick={onBack} registerNative={false} />
        <div style={{ fontWeight: 800, fontSize: 15 }}>Жалобы</div>
        <div style={{ width: 36 }} />
      </div>
      <div className="screen-inner">
        <div className="filter-row">
          <button className={`filter-chip${tab === 'photos' ? ' active' : ''}`} onClick={() => setTab('photos')}>
            Фото{reports.length ? ` · ${reports.length}` : ''}
          </button>
          <button className={`filter-chip${tab === 'comments' ? ' active' : ''}`} onClick={() => setTab('comments')}>
            Комментарии{commentReports.length ? ` · ${commentReports.length}` : ''}
          </button>
          <button className={`filter-chip${tab === 'filter' ? ' active' : ''}`} onClick={() => setTab('filter')}>
            Фильтр
          </button>
        </div>
        {tab === 'filter' ? (
          logLoading ? (
            <div style={{ padding: 26, textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5 }}>Загрузка…</div>
          ) : moderationLog.length ? (
            <>
              <div className="moderation-log-note">Тексты, которые автомодерация не пропустила: комментарии, чат клана, названия и девизы кланов. Три нарушения за час — мьют на час, повтор за сутки — на сутки.</div>
              {moderationLog.map((entry) => {
                const showUnmute = !!entry.mutedUntil && !unmuteShownFor.has(entry.userId)
                if (showUnmute) unmuteShownFor.add(entry.userId)
                return (
                  <ModerationLogRow
                    key={entry.id}
                    entry={showUnmute ? entry : { ...entry, mutedUntil: null }}
                    onOpenUser={onOpenUser}
                    unmuting={unmute.isPending}
                    onUnmute={() => unmute.mutate(entry.userId)}
                  />
                )
              })}
            </>
          ) : (
            <div style={{ padding: 26, textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5 }}>Фильтр пока ничего не отклонял</div>
          )
        ) : tab === 'comments' ? (
          commentsLoading ? (
            <div style={{ padding: 26, textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5 }}>Загрузка…</div>
          ) : commentReports.length ? (
            commentReports.map((r) => (
              <div key={r.commentId} className="card" style={{ padding: 14, marginBottom: 12 }}>
                <div style={{ fontSize: 14, lineHeight: 1.42, overflowWrap: 'anywhere' }}>«{r.body}»</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 6 }}>
                  Автор:{' '}
                  <button className="activity-who-btn" onClick={() => onOpenUser(r.authorId)}>
                    {r.authorName}
                  </button>{' '}
                  ·{' '}
                  <button className="activity-who-btn" onClick={() => onOpenPhoto(r.catchId, r.commentId)}>
                    открыть улов
                  </button>
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 2 }}>
                  {r.reasons.join(', ')} · жалоб: {r.reportCount} · {formatWhen(r.lastReportedAt)}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button
                    className="btn-primary"
                    style={{ flex: 1, padding: '9px 0', fontSize: 13 }}
                    disabled={deleteComment.isPending}
                    onClick={() => deleteComment.mutate({ commentId: r.commentId, catchId: r.catchId })}
                  >
                    Удалить комментарий
                  </button>
                  <button
                    className="btn-secondary"
                    style={{ flex: 1, padding: '9px 0', fontSize: 13 }}
                    disabled={dismissCommentReports.isPending}
                    onClick={() => dismissCommentReports.mutate(r.commentId)}
                  >
                    Отклонить
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div style={{ padding: 26, textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5 }}>Жалоб на комментарии нет</div>
          )
        ) : isLoading ? (
          <div style={{ padding: 26, textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5 }}>Загрузка…</div>
        ) : reports.length ? (
          reports.map((r) => (
            <div key={r.id} className="card" style={{ padding: 14, marginBottom: 12, display: 'flex', gap: 12 }}>
              <div className="fish-thumb" style={{ width: 56, height: 56, cursor: 'pointer', flex: '0 0 auto' }} onClick={() => onOpenPhoto(r.catchId)}>
                <img src={r.photoUrl} alt={r.speciesName ?? ''} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{r.reason}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2 }}>
                  <button className="activity-who-btn" onClick={() => onOpenTerritory(r.territoryId)}>
                    Территория {r.territoryId}
                  </button>
                  {r.speciesName ? ` · ${r.speciesName}` : ''}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 2 }}>
                  Пожаловался:{' '}
                  <button className="activity-who-btn" onClick={() => onOpenUser(r.reporterId)}>
                    {r.reporterName}
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button
                    className="btn-primary"
                    style={{ flex: 1, padding: '9px 0', fontSize: 13 }}
                    disabled={deleteCatch.isPending}
                    onClick={() => deleteCatch.mutate(r.catchId)}
                  >
                    Удалить улов
                  </button>
                  <button
                    className="btn-secondary"
                    style={{ flex: 1, padding: '9px 0', fontSize: 13 }}
                    disabled={dismissReport.isPending}
                    onClick={() => dismissReport.mutate(r.id)}
                  >
                    Отклонить
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div style={{ padding: 26, textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5 }}>Жалоб нет</div>
        )}
      </div>
    </>
  )
}
