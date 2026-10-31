'use client'

import { useState } from 'react'
import type { PartnersDoc, PlanId } from '@/lib/data/partners.shared'
import { PARTNER_CONTACTS } from '@/lib/data/partners.shared'

// No server, no database: the form only writes the message and opens Telegram
// with it filled in, so the shop owner sends it from their own account.
export function PartnersForm({ doc }: { doc: PartnersDoc }) {
  const [shop, setShop] = useState('')
  const [contact, setContact] = useState('')
  const [comment, setComment] = useState('')
  const [picked, setPicked] = useState<PlanId[]>([])
  const [state, setState] = useState<'idle' | 'error' | 'sent'>('idle')

  const toggle = (id: PlanId) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!shop.trim() || !contact.trim()) {
      setState('error')
      return
    }
    const names = doc.plans.filter((p) => picked.includes(p.id)).map((p) => p.name)
    const text = [
      doc.messageHead,
      `${doc.fCity}: ${doc.cityName}`,
      `${doc.fShop}: ${shop.trim()}`,
      `${doc.messageContact}: ${contact.trim()}`,
      names.length ? `${doc.fInterest}: ${names.join(', ')}` : '',
      comment.trim(),
    ]
      .filter(Boolean)
      .join('\n')
    window.open(`https://t.me/${PARTNER_CONTACTS.telegram}?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
    setState('sent')
  }

  const tel = PARTNER_CONTACTS.phone.replace(/[^\d+]/g, '')

  return (
    <div className="pt-form-wrap">
      <form className="pt-form" onSubmit={submit} noValidate>
        <label>
          <span>{doc.fShop}</span>
          <input value={shop} onChange={(e) => setShop(e.target.value)} autoComplete="organization" />
        </label>
        <label>
          <span>{doc.fContact}</span>
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder={doc.fContactHint}
            autoComplete="off"
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
          <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
        </label>
        <button className="landing-btn landing-btn-primary pt-submit" type="submit">
          {doc.fSubmit}
        </button>
        {state === 'error' && <p className="pt-msg pt-msg-err">{doc.fRequired}</p>}
        {state === 'sent' && <p className="pt-msg">{doc.fSent}</p>}
      </form>

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
