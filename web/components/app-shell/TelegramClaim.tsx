'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import { forgetOfflineData } from '@/lib/offlineCache'
import { isLinkToken } from '@/lib/telegram/startParamCodec'
import { tn } from '@/lib/i18n/runtime'

// «Купить в Telegram», the Telegram side (26.11.2026). The Mini App was opened by the bot's button with
// ?tglink=<key>&buy=<product> (app/api/telegram/buy-link → webhook): the key signs in to the account that asked for the
// link on the website and ties this Telegram to it (app/api/auth/telegram/claim), then the app reloads with ?buy= alone
// and FishZoneApp opens that product in the Shop. If this Telegram already belongs to another account with real play,
// the person chooses here which account stays in Telegram.
type Conflict = { main: { name: string }; other: { name: string; catches: number; sectors: number; hasEmail: boolean } }
type Step = { kind: 'working' } | { kind: 'conflict'; c: Conflict } | { kind: 'confirm'; c: Conflict } | { kind: 'expired' } | { kind: 'failed' }

function readLink(): { token: string; buy: string | null } | null {
  if (typeof window === 'undefined' || !window.Telegram?.WebApp?.initData) return null
  const params = new URLSearchParams(window.location.search)
  const token = params.get('tglink')
  if (!token || !isLinkToken(token)) return null
  const buy = params.get('buy')
  return { token, buy: buy && /^[a-z0-9_]{1,24}$/.test(buy) ? buy : null }
}

// Back to the app at the product (or plain, with nothing to open); the Telegram launch data rides in the hash.
function reloadAt(buy: string | null) {
  window.location.replace(`${window.location.pathname}${buy ? `?buy=${buy}` : ''}${window.location.hash}`)
}

export function TelegramClaim() {
  // Read after mount (the server renders nothing here, so the first client render must not either).
  const [link, setLink] = useState<{ token: string; buy: string | null } | null>(null)
  const [step, setStep] = useState<Step | null>(null)

  async function send(decision?: 'move' | 'stay', l = link) {
    if (!l) return
    const link = l
    setStep({ kind: 'working' })
    try {
      const res = await fetch('/api/auth/telegram/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: window.Telegram?.WebApp?.initData, token: link.token, decision }),
      })
      const body = (await res.json().catch(() => ({}))) as { status?: string; email?: string; token?: string } & Partial<Conflict>
      if (body.status === 'expired') return setStep({ kind: 'expired' })
      if (body.status === 'conflict' && body.main && body.other) return setStep({ kind: 'conflict', c: { main: body.main, other: body.other } })
      // «Остаться»: this Telegram's own account (signed in at launch as usual) opens the product.
      if (body.status === 'stayed') return reloadAt(link.buy)
      if (body.status !== 'ok' || !body.email || !body.token) return setStep({ kind: 'failed' })
      const supabase = createClient()
      const { data: current } = await supabase.auth.getUser()
      // Another account was open in this Telegram: out of it first, so nothing of it is left on the phone.
      if (current.user && current.user.email !== body.email) {
        await supabase.auth.signOut()
        forgetOfflineData()
      }
      const { error } = await supabase.auth.verifyOtp({ email: body.email, token: body.token, type: 'magiclink' })
      if (error) return setStep({ kind: 'failed' })
      reloadAt(link.buy)
    } catch {
      setStep({ kind: 'failed' })
    }
  }

  useEffect(() => {
    const l = readLink()
    if (!l) return
    /* eslint-disable react-hooks/set-state-in-effect -- one request at launch, from the launch URL (external input) */
    setLink(l)
    void send(undefined, l)
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!step || typeof document === 'undefined') return null
  const close = () => reloadAt(null)

  if (step.kind === 'working') {
    return createPortal(
      <div className="stars-opening tg-claim-wait" role="status" aria-live="polite">
        <span className="spinner" aria-hidden />
        <span>{tn('claim.working')}</span>
      </div>,
      document.body,
    )
  }

  let content
  if (step.kind === 'conflict') {
    const { main, other } = step.c
    content = (
      <>
        <div className="modal-title">{tn('claim.conflictTitle')}</div>
        <div className="modal-body">
          {tn('claim.conflictText', {
            other: other.name,
            main: main.name,
            catches: tn('claim.catches', { count: other.catches }),
            sectors: tn('claim.sectors', { count: other.sectors }),
          })}
        </div>
        <button className="btn-primary" onClick={() => setStep({ kind: 'confirm', c: step.c })}>
          {tn('claim.moveTo', { name: main.name })}
        </button>
        <button className="btn-secondary" style={{ marginTop: 8 }} onClick={() => void send('stay')}>
          {tn('claim.stayIn', { name: other.name })}
        </button>
      </>
    )
  } else if (step.kind === 'confirm') {
    const { main, other } = step.c
    content = (
      <>
        <div className="modal-title">{tn('claim.confirmTitle', { name: main.name })}</div>
        <div className="modal-body">{tn(other.hasEmail ? 'claim.confirmEmail' : 'claim.confirmNoEmail', { other: other.name })}</div>
        <button className="btn-primary" onClick={() => void send('move')}>
          {tn('claim.confirmYes', { name: main.name })}
        </button>
        <button className="btn-secondary" style={{ marginTop: 8 }} onClick={() => setStep({ kind: 'conflict', c: step.c })}>
          {tn('claim.back')}
        </button>
      </>
    )
  } else if (step.kind === 'expired') {
    content = (
      <>
        <div className="modal-title">{tn('claim.expiredTitle')}</div>
        <div className="modal-body">{tn('claim.expiredText')}</div>
        <button className="btn-primary" onClick={close}>
          {tn('claim.ok')}
        </button>
      </>
    )
  } else {
    content = (
      <>
        <div className="modal-title">{tn('claim.failedTitle')}</div>
        <div className="modal-body">{tn('claim.failedText')}</div>
        <button className="btn-primary" onClick={() => void send()}>
          {tn('claim.retry')}
        </button>
        <button className="btn-secondary" style={{ marginTop: 8 }} onClick={close}>
          {tn('common.close')}
        </button>
      </>
    )
  }
  return createPortal(
    <div className="modal-overlay tg-claim">
      <div className="modal-card">{content}</div>
    </div>,
    document.body,
  )
}
