'use client'

import { useState } from 'react'
import type { PartnerCity, PartnersDoc, PlanId } from '@/lib/data/partners.shared'
import { PARTNER_CONTACTS } from '@/lib/data/partners.shared'

// The request goes to /api/partner-lead: it is saved in the database and forwarded to the owner's Telegram,
// so it is not lost if the person never presses «Send» in a chat. The hidden «website» field is for scripts.
export function PartnersForm({ doc, city }: { doc: PartnersDoc; city: PartnerCity }) {
  const [shop, setShop] = useState('')
  const [contact, setContact] = useState('')
  const [comment, setComment] = useState('')
  const [trap, setTrap] = useState('')
  const [picked, setPicked] = useState<PlanId[]>([])
  const [state, setState] = useState<'idle' | 'error' | 'sending' | 'failed' | 'sent'>('idle')

  const toggle = (id: PlanId) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (state === 'sending') return
    if (!shop.trim() || !contact.trim()) {
      setState('error')
      return
    }
    setState('sending')
    try {
      const res = await fetch('/api/partner-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city, lang: doc.lang, name: shop, contact, interest: picked, comment, website: trap }),
      })
      setState(res.ok ? 'sent' : 'failed')
    } catch {
      setState('failed')
    }
  }

  const tel = PARTNER_CONTACTS.phone.replace(/[^\d+]/g, '')

  return (
    <div className="pt-form-wrap">
      {state === 'sent' ? (
        <div className="pt-sent" role="status">
          <h3>{doc.fSentTitle}</h3>
          <p>{doc.fSent}</p>
        </div>
      ) : (
        <form className="pt-form" onSubmit={submit} noValidate>
          <label>
            <span>{doc.fShop}</span>
            <input value={shop} onChange={(e) => setShop(e.target.value)} autoComplete="organization" maxLength={120} />
          </label>
          <label>
            <span>{doc.fContact}</span>
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder={doc.fContactHint}
              autoComplete="off"
              maxLength={160}
            />
          </label>
          <fieldset>
            <legend>{doc.fInterest}</legend>
            <div className="pt-chips">
              {doc.plans.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  aria-pressed={picked.includes(p.id)}
                  className={picked.includes(p.id) ? 'pt-chip pt-chip-on' : 'pt-chip'}
                  onClick={() => toggle(p.id)}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </fieldset>
          <label>
            <span>{doc.fComment}</span>
            <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} />
          </label>
          <input className="pt-trap" name="website" value={trap} onChange={(e) => setTrap(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" />
          <button className="landing-btn landing-btn-primary pt-submit" type="submit" disabled={state === 'sending'}>
            {state === 'sending' ? doc.fSending : doc.fSubmit}
          </button>
          {state === 'error' && <p className="pt-msg pt-msg-err">{doc.fRequired}</p>}
          {state === 'failed' && <p className="pt-msg pt-msg-err">{doc.fFailed}</p>}
        </form>
      )}

      <div className="pt-direct">
        <p>{doc.orWrite}</p>
        <ul>
          {PARTNER_CONTACTS.telegram && (
            <li>
              <a href={`https://t.me/${PARTNER_CONTACTS.telegram}`}>
                <span>{doc.contactTelegram}</span>@{PARTNER_CONTACTS.telegram}
              </a>
            </li>
          )}
          {PARTNER_CONTACTS.phone && (
            <li>
              <a href={`tel:${tel}`}>
                <span>{doc.contactPhone}</span>
                {PARTNER_CONTACTS.phone}
              </a>
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}
