'use client'

import { ClanCrest } from '@/components/app-shell/ClanCrest'
import { C2Avatar, C2Card, speciesName, useC2 } from '@/components/clan2/C2Common'
import { useDemoState } from '@/lib/clan2/demoStore'
import { formatCatchMeta } from '@/lib/format'
import { leagueFor } from '@/lib/data/clanLevels'
import { currentLocale, tn } from '@/lib/i18n/runtime'
import { thumbUrl } from '@/lib/supabase/imageUrl'

// «Слава»: the clan's records — the biggest fish of each species among its
// members — and the clan card for a Telegram story built from them.

const HALL_SIZE = 10

export function GloryTab() {
  const s = useDemoState()
  const { say } = useC2()
  const league = leagueFor(s.clan.trophies)
  // The ten biggest records (the longest fish of each species), longest first — size is the length, not the weight.
  const records = [...s.hall].sort((a, b) => b.cm - a.cm || b.kg - a.kg).slice(0, HALL_SIZE)
  const date = (at: number) => new Date(at).toLocaleDateString(currentLocale(), { day: 'numeric', month: 'short' })
  const top = records.slice(0, 3)
  const hq = s.hq.sectorId

  const share = () => {
    const text = `${s.clan.name} · ${tn('clan2.clan.level', { n: s.clan.level })}\n${top.map((r) => `${speciesName(r.species)}: ${formatCatchMeta(r.cm, r.kg)}`).join('\n')}`
    void navigator.clipboard?.writeText(text).catch(() => undefined)
    say(tn('clan2.glory.shareDone'))
  }

  return (
    <div className="c2-stack">
      <C2Card title={tn('clan2.glory.title')} hint={tn('clan2.glory.hint')} tour="glory-hall">
        <ul className="c2-hall">
          {records.map((r, i) => (
            <li key={r.species}>
              <div className={`c2-hall-photo${r.photo ? ' has' : ''}`} style={{ background: `linear-gradient(150deg, hsl(${r.hue} 55% 62%), hsl(${(r.hue + 40) % 360} 55% 38%))` }}>
                {r.photo ? (
                  <img src={thumbUrl(r.photo, 240)} alt={speciesName(r.species)} loading="lazy" decoding="async" />
                ) : (
                  <svg viewBox="0 0 64 40" width="44" height="28" aria-hidden>
                    <path d="M4 20c9-12 26-14 40-4l10-8v24l-10-8C30 34 13 32 4 20z" fill="rgba(255,255,255,.9)" />
                    <circle cx="14" cy="18" r="2" fill="rgba(0,0,0,.45)" />
                  </svg>
                )}
                {i === 0 && <span className="c2-hall-crown" aria-label={tn('clan2.glory.top')}>1</span>}
              </div>
              <div className="c2-hall-main">
                <strong>{speciesName(r.species)}</strong>
                <div className="c2-hall-size">
                  {formatCatchMeta(r.cm, r.kg)}
                  {i === 0 && <span className="c2-chip warn">{tn('clan2.glory.top')}</span>}
                </div>
                <div className="c2-muted small c2-hall-by">
                  <C2Avatar member={{ name: r.member, hue: r.hue }} size={18} />
                  <span>{tn('clan2.glory.by', { name: r.member, date: date(r.at) })}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </C2Card>

      <C2Card title={tn('clan2.glory.shareTitle')} hint={tn('clan2.glory.shareHint')} tour="glory-card">
        <div className="c2-sharecard" style={{ background: `linear-gradient(160deg, ${s.clan.crest.primary}, #0B1B2B)` }}>
          <div className="c2-sharecard-crest">
            <ClanCrest crest={s.clan.crest} size={72} shine />
          </div>
          <div className="c2-sharecard-name">{s.clan.name}</div>
          <div className="c2-sharecard-meta">
            {tn('clan2.clan.level', { n: s.clan.level })} · {tn('clan2.glory.cardLeague', { name: league.label })}
          </div>
          <div className="c2-sharecard-meta">{hq ? tn('clan2.glory.cardHq', { id: hq }) : tn('clan2.glory.cardNoHq')}</div>
          <div className="c2-sharecard-records">
            <span>{tn('clan2.glory.cardRecords')}</span>
            {top.map((r) => (
              <b key={r.species}>
                {speciesName(r.species)} {r.cm}
              </b>
            ))}
          </div>
        </div>
        <button className="btn-secondary" style={{ marginTop: 12 }} onClick={share}>
          {tn('clan2.glory.shareBtn')}
        </button>
      </C2Card>
    </div>
  )
}
