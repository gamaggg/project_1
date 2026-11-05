'use client'

import { createContext, useCallback, useContext, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { CoinIcon } from '@/components/app-shell/CoinIcon'
import { useNow } from '@/lib/useNow'
import { useDemoState, type Result } from '@/lib/clan2/demoStore'
import { DAY, HOURS, fmt } from '@/lib/clan2/rules'
import type { DemoMember } from '@/lib/clan2/types'
import { tn, tnd } from '@/lib/i18n/runtime'

// Small pieces shared by every screen of the clan update: the demo clock, time
// phrases, avatars, coin amounts, a progress bar, a bottom sheet and the toast.

// The demo clock: real time plus what «ускорить время» has added.
export function useDemoNow(): number {
  const s = useDemoState()
  return useNow(1000) + s.clockOffsetMs
}

export function fmtAgo(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60_000))
  if (min < 1) return tn('clan2.time.now')
  if (min < 60) return tn('clan2.time.minAgo', { n: min })
  if (min < 48 * 60) return tn('clan2.time.hourAgo', { n: Math.round(min / 60) })
  return tn('clan2.time.dayAgo', { n: Math.round(min / 1440) })
}

// «1 ч 20 мин», «2 дн. 4 ч», «35 мин».
export function fmtLeft(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 60_000))
  const d = Math.floor(total / 1440)
  const h = Math.floor((total % 1440) / 60)
  const m = total % 60
  const u = { d: tn('clan2.time.d'), h: tn('clan2.time.h'), m: tn('clan2.time.m') }
  if (d > 0) return `${d} ${u.d} ${h} ${u.h}`
  if (h > 0) return `${h} ${u.h} ${m} ${u.m}`
  return `${m} ${u.m}`
}

export const speciesName = (key: string) => tnd(`species.${key}`)

export function C2Avatar({ member, size = 36 }: { member: Pick<DemoMember, 'name' | 'hue'>; size?: number }) {
  return (
    <span className="c2-avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.38), background: `hsl(${member.hue} 62% 52%)` }} aria-hidden>
      {member.name.slice(0, 2).toUpperCase()}
    </span>
  )
}

export function C2Coins({ n, sign, className }: { n: number; sign?: boolean; className?: string }) {
  const text = `${sign && n > 0 ? '+' : n < 0 ? '−' : ''}${fmt(Math.abs(n))}`
  return (
    <span className={`c2-coins${className ? ` ${className}` : ''}`}>
      <span>{text}</span>
      <CoinIcon size={16} />
    </span>
  )
}

export function C2Bar({ value, tone = 'accent', label }: { value: number; tone?: 'accent' | 'good' | 'warn' | 'bad'; label?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  return (
    <div className={`c2-bar tone-${tone}`} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <i style={{ width: `${pct}%` }} />
    </div>
  )
}

export function C2Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="c2-sheet-overlay" onClick={onClose}>
      <div className="c2-sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="c2-sheet-handle" />
        <div className="c2-sheet-title">{title}</div>
        <div className="c2-sheet-body">{children}</div>
      </div>
    </div>
  )
}

export function C2Card({ title, hint, right, children, style, tour }: { title?: string; hint?: string; right?: ReactNode; children: ReactNode; style?: CSSProperties; tour?: string }) {
  return (
    <section className="c2-card card" style={style} data-tour={tour}>
      {(title || right) && (
        <header className="c2-card-head">
          {title && <h3>{title}</h3>}
          {right}
        </header>
      )}
      {hint && <p className="c2-hint">{hint}</p>}
      {children}
    </section>
  )
}

// ───────────── toast ─────────────

type Ctx = { say: (msg: string) => void; act: (res: Result, ok?: string) => boolean; toast: { text: string; id: number } | null }
const ToastContext = createContext<Ctx>({ say: () => {}, act: () => false, toast: null })
export const useC2 = () => useContext(ToastContext)

export function C2ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<{ text: string; id: number } | null>(null)
  const timer = useRef<number | null>(null)
  const say = useCallback((text: string) => {
    setMsg({ text, id: Date.now() })
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setMsg(null), 2600)
  }, [])
  // Shows the reason of a refusal, or the confirmation of what was done.
  const act = useCallback(
    (res: Result, ok?: string) => {
      if (!res.ok) {
        say(tnd(`clan2.err.${res.reason}`))
        return false
      }
      const key = res.info ?? ok
      if (key) say(tnd(`clan2.ok.${key}`))
      return true
    },
    [say]
  )
  return (
    <ToastContext.Provider value={{ say, act, toast: msg }}>{children}</ToastContext.Provider>
  )
}

// Where the toast shows: put it inside the screen it belongs to (the phone of the demo).
export function C2Toast() {
  const { toast } = useC2()
  if (!toast) return null
  return (
    <div className="c2-toast" key={toast.id} role="status">
      {toast.text}
    </div>
  )
}

export const weekAgo = (now: number) => now - 7 * DAY
export { DAY, HOURS }
