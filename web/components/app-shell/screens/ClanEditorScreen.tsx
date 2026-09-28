'use client'

import { useEffect, useState } from 'react'
import { BackButton } from '@/components/app-shell/BackButton'
import { ClanCrest } from '@/components/app-shell/ClanCrest'
import { ClanHero } from '@/components/app-shell/ClanHero'
import { CoinIcon } from '@/components/app-shell/CoinIcon'
import { HeroBgLive } from '@/components/app-shell/HeroBgLive'
import { useClanEligibility, useClanInviteCode, useClanNameCheck, useCreateClan, useUpdateClan } from '@/lib/supabase/queries'
import { CREST_COLORS, CREST_SECONDARY_COLORS, CREST_SHAPES, CREST_SYMBOLS, resolveCrest, type ClanCrest as CrestValue } from '@/lib/data/clanCrests'
import { CLAN_BACKGROUNDS } from '@/lib/data/clanBackgrounds'
import { CLAN_PRICE, JOIN_TYPE_LABEL, MIN_SECTORS_OPTIONS, clanErrorMessage, type ClanJoinType } from '@/lib/data/clanLevels'
import { hapticSuccess } from '@/lib/telegram/haptics'
import type { ClanDetail } from '@/lib/data/types'

const STEPS = ['Герб', 'Название', 'Фон', 'Вступление'] as const
const NAME_RE = /^[A-Za-zА-Яа-яЁё0-9]([A-Za-zА-Яа-яЁё0-9 -]*[A-Za-zА-Яа-яЁё0-9])?$/

const JOIN_DESCRIPTION: Record<ClanJoinType, string> = {
  open: 'Любой рыбак из города вступает сразу',
  request: 'Глава, соруководители и старейшины принимают заявки',
  invite: 'Только те, кого вы пригласили сами',
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

// A random base-level crest, so every new clan starts from something that
// already looks like a crest instead of a blank form.
function startCrest(): CrestValue {
  const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]
  return {
    shape: pick(CREST_SHAPES.filter((s) => s.level === 1)).id,
    symbol: pick(CREST_SYMBOLS.filter((s) => s.level === 1)).id,
    primary: pick(CREST_COLORS).id,
    secondary: '#FFE7C2',
  }
}

function LockTag({ level }: { level: number }) {
  return (
    <span className="clan-opt-lock">
      <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M7 10V7a5 5 0 0 1 10 0v3h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Zm2 0h6V7a3 3 0 0 0-6 0Z" />
      </svg>
      ур. {level}
    </span>
  )
}

// One screen for both creating a clan (four steps, then payment) and editing
// it later (the same four sections as tabs, saved at once). Everything
// on screen updates the live preview at the top as it's picked.
export function ClanEditorScreen({
  mode,
  clan,
  onBack,
  onDone,
  onShareClan,
}: {
  mode: 'create' | 'edit'
  clan: ClanDetail | null
  onBack: () => void
  onDone: (clanId: number) => void
  onShareClan: (clanId: number, name: string, inviteCode?: string | null) => void
}) {
  const isEdit = mode === 'edit'
  const level = clan?.level ?? 1
  const isLeader = !isEdit || clan?.myRole === 'leader'
  // Read once when the editor opens — the 14-day rename lock doesn't need
  // to tick while it's on screen.
  const [openedAt] = useState(() => Date.now())
  const renameBlockedUntil =
    isEdit && clan?.renamedAt && openedAt - new Date(clan.renamedAt).getTime() < 14 * 86_400_000
      ? new Date(new Date(clan.renamedAt).getTime() + 14 * 86_400_000)
      : null
  const canRename = isLeader && !renameBlockedUntil

  const [step, setStep] = useState(0)
  const [crest, setCrest] = useState<CrestValue>(() => (isEdit ? resolveCrest(clan?.crest) : startCrest()))
  const [name, setName] = useState(clan?.name ?? '')
  const [motto, setMotto] = useState(clan?.motto ?? '')
  const [announcement, setAnnouncement] = useState(clan?.announcement ?? '')
  const [background, setBackground] = useState(clan?.background ?? 'deep')
  const [joinType, setJoinType] = useState<ClanJoinType>(clan?.joinType ?? 'open')
  const [minSectors, setMinSectors] = useState(clan?.minSectors ?? 0)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ id: number; name: string } | null>(null)
  // The founder shares straight from the final step — the link should already
  // be an invitation (see useClanInviteCode).
  const { data: createdInviteCode } = useClanInviteCode(created?.id ?? null, !!created)

  const trimmed = name.trim()
  const debouncedName = useDebounced(trimmed, 450)
  const nameChanged = !isEdit || trimmed !== clan?.name
  const localNameProblem = trimmed.length === 0 ? null : trimmed.length < 3 ? 'Минимум 3 символа' : !NAME_RE.test(trimmed) || /\s{2}/.test(trimmed) ? 'Только буквы, цифры, пробел и дефис' : null
  const { data: nameProblem, isFetching: checkingName } = useClanNameCheck(debouncedName, nameChanged && !localNameProblem)
  const nameSettled = debouncedName === trimmed && !checkingName
  const nameOk = trimmed.length >= 3 && !localNameProblem && (!nameChanged || (nameSettled && !nameProblem))

  const { data: eligibility } = useClanEligibility(!isEdit)
  const create = useCreateClan()
  const update = useUpdateClan()
  const busy = create.isPending || update.isPending

  const sectorsOk = !eligibility || eligibility.sectors >= eligibility.sectorsNeeded
  const coinsOk = !eligibility || eligibility.coins >= CLAN_PRICE
  const cooldown = eligibility?.cooldownUntil ? new Date(eligibility.cooldownUntil) : null

  const input = { name: trimmed, motto, crest, background, joinType, minSectors }

  function submit() {
    setError(null)
    if (!nameOk) {
      setStep(1)
      setError(localNameProblem ?? (nameProblem ? clanErrorMessage(nameProblem) : 'Проверь название'))
      return
    }
    if (isEdit) {
      update.mutate(
        { ...input, announcement, rename: canRename && nameChanged, clanId: clan!.id },
        { onSuccess: () => onDone(clan!.id), onError: (e) => setError(clanErrorMessage(e)) }
      )
      return
    }
    create.mutate(input, {
      onSuccess: (id) => {
        hapticSuccess()
        setCreated({ id, name: trimmed })
      },
      onError: (e) => setError(clanErrorMessage(e)),
    })
  }

  function next() {
    if (step === 1 && !nameOk) {
      setError(localNameProblem ?? (nameProblem ? clanErrorMessage(nameProblem) : trimmed ? 'Проверяем название…' : 'Придумай название клана'))
      return
    }
    setError(null)
    setStep((s) => Math.min(STEPS.length - 1, s + 1))
  }

  let nameStatus: { text: string; ok: boolean } | null = null
  if (!nameChanged) nameStatus = null
  else if (localNameProblem) nameStatus = { text: localNameProblem, ok: false }
  else if (trimmed.length >= 3 && !nameSettled) nameStatus = { text: 'Проверяем…', ok: true }
  else if (nameProblem) nameStatus = { text: clanErrorMessage(nameProblem), ok: false }
  else if (trimmed.length >= 3) nameStatus = { text: 'Название свободно', ok: true }

  if (created) {
    return <ClanFounded crest={crest} name={created.name} background={background} onOpen={() => onDone(created.id)} onShare={() => onShareClan(created.id, created.name, createdInviteCode)} />
  }

  return (
    <div className="clan-editor">
      <div className="clan-editor-top">
        <div className="header-row" style={{ padding: '6px 0 8px' }}>
          <BackButton onClick={onBack} registerNative={false} />
          <div style={{ fontWeight: 800, fontSize: 15 }}>{isEdit ? 'Настройки клана' : 'Новый клан'}</div>
          <div style={{ width: 36, textAlign: 'right', fontSize: 12, fontWeight: 800, color: 'var(--ink-faint)' }}>{isEdit ? '' : `${step + 1}/${STEPS.length}`}</div>
        </div>
        {isEdit ? (
          <div className="clan-tabs">
            {STEPS.map((label, i) => (
              <button key={label} className={`clan-tab${step === i ? ' on' : ''}`} onClick={() => setStep(i)}>
                {label}
              </button>
            ))}
          </div>
        ) : (
          <div className="clan-steps">
            {STEPS.map((label, i) => (
              <div key={label} className={`clan-step-bar${i <= step ? ' on' : ''}`} />
            ))}
          </div>
        )}
        <ClanHero crest={crest} name={trimmed} motto={motto.trim() || null} background={background} compact />
      </div>

      <div className="clan-editor-body" key={step}>
        {step === 0 && (
          <>
            <div className="clan-section-label">Форма</div>
            <div className="clan-opt-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
              {CREST_SHAPES.map((s) => {
                const locked = s.level > level
                return (
                  <button
                    key={s.id}
                    className={`clan-opt${crest.shape === s.id ? ' on' : ''}${locked ? ' locked' : ''}`}
                    disabled={locked}
                    aria-label={s.label}
                    onClick={() => setCrest((c) => ({ ...c, shape: s.id }))}
                  >
                    <svg viewBox="0 0 100 100" width="30" height="30" aria-hidden>
                      <path d={s.d} fill={crest.shape === s.id ? crest.primary : '#C9C7C1'} />
                    </svg>
                    {locked && <LockTag level={s.level} />}
                  </button>
                )
              })}
            </div>
            <div className="clan-section-label">Символ</div>
            <div className="clan-opt-grid" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
              {CREST_SYMBOLS.map((s) => {
                const locked = s.level > level
                return (
                  <button
                    key={s.id}
                    className={`clan-opt${crest.symbol === s.id ? ' on' : ''}${locked ? ' locked' : ''}`}
                    disabled={locked}
                    aria-label={s.label}
                    title={s.label}
                    onClick={() => setCrest((c) => ({ ...c, symbol: s.id }))}
                  >
                    <ClanCrest crest={{ shape: 'round', symbol: s.id, primary: crest.symbol === s.id ? crest.primary : '#9C9A94', secondary: '#FFFFFF' }} size={36} />
                    {locked && <LockTag level={s.level} />}
                  </button>
                )
              })}
            </div>
            <div className="clan-section-label">Цвет герба</div>
            <div className="clan-swatches">
              {CREST_COLORS.map((c) => (
                <button
                  key={c.id}
                  className={`clan-swatch${crest.primary === c.id ? ' on' : ''}`}
                  style={{ background: c.id }}
                  aria-label={c.label}
                  onClick={() => setCrest((cr) => ({ ...cr, primary: c.id }))}
                />
              ))}
            </div>
            <div className="clan-section-label">Цвет кольца</div>
            <div className="clan-swatches">
              {CREST_SECONDARY_COLORS.map((c) => (
                <button
                  key={c.id}
                  className={`clan-swatch${crest.secondary === c.id ? ' on' : ''}`}
                  style={{ background: c.id }}
                  aria-label={c.label}
                  onClick={() => setCrest((cr) => ({ ...cr, secondary: c.id }))}
                />
              ))}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div className="clan-section-label">Название</div>
            <div className={`clan-field${nameStatus && !nameStatus.ok ? ' bad' : ''}`}>
              <input
                value={name}
                maxLength={20}
                disabled={isEdit && !canRename}
                placeholder="Щуки Батуми"
                onChange={(e) => {
                  setName(e.target.value)
                  setError(null)
                }}
              />
              <span className="clan-field-count">{name.length}/20</span>
            </div>
            {isEdit && !isLeader && <div className="clan-hint">Название меняет только глава клана</div>}
            {isEdit && isLeader && renameBlockedUntil && (
              <div className="clan-hint">Переименовать можно с {renameBlockedUntil.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</div>
            )}
            {nameStatus && <div className={`clan-name-status${nameStatus.ok ? ' ok' : ' bad'}`}>{nameStatus.text}</div>}
            <div className="clan-section-label">Девиз</div>
            <div className="clan-field clan-field-area">
              <textarea value={motto} maxLength={120} rows={2} placeholder="Клюёт у тех, кто рано встаёт" onChange={(e) => {
                  setMotto(e.target.value)
                  setError(null)
                }} />
              <span className="clan-field-count">{motto.length}/120</span>
            </div>
            {isEdit && (
              <>
                <div className="clan-section-label">Объявление для своих</div>
                <div className="clan-field clan-field-area">
                  <textarea
                    value={announcement}
                    maxLength={200}
                    rows={3}
                    placeholder="В субботу все на Чорохи к 6:00"
                    onChange={(e) => {
                      setAnnouncement(e.target.value)
                      setError(null)
                    }}
                  />
                  <span className="clan-field-count">{announcement.length}/200</span>
                </div>
                <div className="clan-hint">Видно только участникам клана — вверху экрана клана</div>
              </>
            )}
            <div className="clan-hint">Название, девиз и объявление проходят автоматическую проверку: без мата, ссылок и телефонов.</div>
          </>
        )}

        {step === 2 && (
          <div className="clan-bg-grid">
            {CLAN_BACKGROUNDS.map((b) => {
              const locked = b.level > level
              return (
                <button
                  key={b.id}
                  className={`clan-bg-tile${background === b.id ? ' on' : ''}${locked ? ' locked' : ''}`}
                  style={{ background: b.animated ? b.base : b.css }}
                  disabled={locked}
                  onClick={() => setBackground(b.id)}
                >
                  {background === b.id && b.animated && <HeroBgLive bg={b} variant="swatch" />}
                  <span className="clan-bg-label">{b.label}</span>
                  {b.animated && <span className="clan-bg-live">живой</span>}
                  {locked && <LockTag level={b.level} />}
                </button>
              )
            })}
          </div>
        )}

        {step === 3 && (
          <>
            <div className="clan-section-label">Как вступать</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(['open', 'request', 'invite'] as ClanJoinType[]).map((t) => (
                <button key={t} className={`clan-join-card${joinType === t ? ' on' : ''}`} onClick={() => setJoinType(t)}>
                  <span className={`clan-radio${joinType === t ? ' on' : ''}`} />
                  <span>
                    <span style={{ display: 'block', fontWeight: 800, fontSize: 14.5 }}>{JOIN_TYPE_LABEL[t]}</span>
                    <span style={{ display: 'block', fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2 }}>{JOIN_DESCRIPTION[t]}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="clan-section-label">Минимум захваченных секторов</div>
            <div className="filter-row" style={{ marginBottom: 0 }}>
              {MIN_SECTORS_OPTIONS.map((n) => (
                <button key={n} className={`filter-chip${minSectors === n ? ' active' : ''}`} onClick={() => setMinSectors(n)}>
                  {n === 0 ? 'Без условий' : `от ${n}`}
                </button>
              ))}
            </div>

            {!isEdit && (
              <div className="clan-price-card">
                <div className="clan-req-row">
                  <span className={`clan-req-dot${sectorsOk ? ' ok' : ''}`}>{sectorsOk ? '✓' : '✕'}</span>
                  Захвачено секторов: {eligibility?.sectors ?? '…'} из {eligibility?.sectorsNeeded ?? 3}
                </div>
                <div className="clan-req-row">
                  <span className={`clan-req-dot${coinsOk ? ' ok' : ''}`}>{coinsOk ? '✓' : '✕'}</span>
                  Монет: {eligibility?.coins ?? '…'} из {CLAN_PRICE}
                </div>
                {cooldown && cooldown > new Date() && (
                  <div className="clan-req-row">
                    <span className="clan-req-dot">✕</span>
                    После выхода из клана — с {cooldown.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
        {error && <div className="clan-error">{error}</div>}
      </div>

      <div className="clan-editor-footer">
        {isEdit ? (
          <button className="btn-primary" disabled={busy} onClick={submit}>
            {busy ? 'Сохраняем…' : 'Сохранить'}
          </button>
        ) : (
          <>
            {step > 0 && (
              <button className="btn-secondary" style={{ flex: '0 0 auto', width: 'auto', padding: '0 22px' }} onClick={() => setStep((s) => s - 1)}>
                Назад
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button className="btn-primary" onClick={next}>
                Далее
              </button>
            ) : (
              <button className="btn-primary clan-create-btn" disabled={busy || !sectorsOk || !coinsOk || (!!cooldown && cooldown > new Date())} onClick={submit}>
                {busy ? (
                  'Создаём…'
                ) : (
                  <>
                    Создать клан · <CoinIcon size={20} /> {CLAN_PRICE}
                  </>
                )}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// The payoff moment: the crest drops in like a stamp, a ring of sparks and
// confetti goes out, then the two obvious next steps.
function ClanFounded({ crest, name, background, onOpen, onShare }: { crest: CrestValue; name: string; background: string; onOpen: () => void; onShare: () => void }) {
  const [pieces] = useState(() =>
    Array.from({ length: 28 }, (_, i) => {
      const angle = (i / 28) * Math.PI * 2 + Math.random() * 0.3
      const dist = 110 + Math.random() * 110
      return {
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        r: Math.random() * 540 - 270,
        color: [crest.primary, crest.secondary, '#FC5200', '#F0A93E', '#FFFFFF'][i % 5],
        delay: 0.35 + Math.random() * 0.15,
      }
    })
  )
  return (
    <div className="clan-founded">
      <ClanHero crest={crest} name={name} hideName motto={null} background={background} top={<div className="clan-founded-glow" />}>
        <div className="clan-founded-burst" aria-hidden>
          {pieces.map((p, i) => (
            <span
              key={i}
              className="clan-founded-piece"
              style={{ background: p.color, '--x': `${p.x}px`, '--y': `${p.y}px`, '--r': `${p.r}deg`, animationDelay: `${p.delay}s` } as React.CSSProperties}
            />
          ))}
        </div>
      </ClanHero>
      <div className="clan-founded-text">
        <div className="clan-founded-kicker">Клан основан</div>
        <div className="clan-founded-name">{name}</div>
        <div className="clan-founded-sub">Уровень 1 · Лига «Бронза» · 1 из 15 мест</div>
      </div>
      <div className="clan-founded-actions">
        <button className="btn-primary" onClick={onShare}>
          Пригласить друзей
        </button>
        <button className="btn-secondary" onClick={onOpen}>
          Открыть клан
        </button>
      </div>
    </div>
  )
}
