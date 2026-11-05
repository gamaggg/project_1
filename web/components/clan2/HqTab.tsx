'use client'

import { C2Bar, C2Card, C2Coins, fmtLeft, useC2, useDemoNow } from '@/components/clan2/C2Common'
import { ClanCrest } from '@/components/app-shell/ClanCrest'
import { SkinSwatch } from '@/components/clan2/SkinSwatch'
import { buyOffer, canManage, equipSkin, setGoal, upgradeProject, useDemoState } from '@/lib/clan2/demoStore'
import { CLAN_SKINS, DAY, HQ_MOVE_COOLDOWN_DAYS, PROJECTS, PROJECT_IDS } from '@/lib/clan2/rules'
import type { ProjectId } from '@/lib/clan2/types'
import { tn, tnd } from '@/lib/i18n/runtime'

// «Штаб»: the headquarters of the clan, how to defend it, the buildings the
// treasury pays for, the clan skins of its sectors and the partners' rewards.

export type MapFocus = { sectorId?: string; place?: boolean }

export function HqTab({ onGoMap }: { onGoMap?: (focus?: MapFocus) => void }) {
  const s = useDemoState()
  const now = useDemoNow()
  const { act } = useC2()
  const manage = canManage(s)
  const hq = s.hq
  const sector = s.sectors.find((x) => x.id === hq.sectorId)
  const coolLeft = hq.sectorId ? Math.max(0, (hq.lastMoveAt ?? hq.placedAt ?? 0) + HQ_MOVE_COOLDOWN_DAYS * DAY - now) : 0
  const color = s.clan.crest.primary

  return (
    <div className="c2-stack">
      <C2Card title={tn('clan2.hq.title')} tour="hq-card">
        {sector ? (
          <>
            <div className="c2-hq-head">
              <div className="c2-hq-crest">
                <ClanCrest crest={s.clan.crest} size={56} />
              </div>
              <div>
                <strong>{tn('clan2.hq.where', { id: sector.id })}</strong>
                <div className="c2-muted small">{tn('clan2.hq.defense', { n: sector.defense })}</div>
              </div>
            </div>
            <C2Bar value={sector.defense / 4} tone={sector.defense === 0 ? 'bad' : sector.defense <= 1 ? 'warn' : 'good'} label={tn('clan2.hq.defense', { n: sector.defense })} />
            {hq.siege && (
              <div className="c2-siege">
                <strong>{tn('clan2.hq.siege')}</strong>
                <span>{tn('clan2.hq.siegeLeft', { t: fmtLeft(hq.siege.endsAt - now) })}</span>
                <small>{tn('clan2.hq.siegeHow')}</small>
              </div>
            )}
            <div className="c2-label">{tn('clan2.hq.perksTitle')}</div>
            <ul className="c2-perks">
              <li>{tn('clan2.hq.perk1')}</li>
              <li>{tn('clan2.hq.perk2')}</li>
              <li>{tn('clan2.hq.perk3')}</li>
            </ul>
            <div className="c2-row-btns">
              <button className="btn-secondary" onClick={() => onGoMap?.({ sectorId: sector.id })}>
                {tn('clan2.hq.onMap')}
              </button>
              {manage && (
                <button className="btn-secondary" onClick={() => onGoMap?.({ place: true })}>
                  {tn('clan2.hq.move')}
                </button>
              )}
            </div>
            <p className="c2-muted small" style={{ marginTop: 8 }}>
              {coolLeft > 0 ? `${tn('clan2.hq.moveCost', { n: s.settings.hqMoveCost })} · ${fmtLeft(coolLeft)}` : tn('clan2.hq.moveCost', { n: s.settings.hqMoveCost })}
            </p>
          </>
        ) : (
          <>
            <p className="c2-muted">{tn('clan2.hq.none')}</p>
            <p className="c2-hint">{tn('clan2.hq.noneHint', { n: s.settings.hqPlaceCost })}</p>
            {manage && (
              <button className="btn-primary" onClick={() => onGoMap?.({ place: true })}>
                {tn('clan2.hq.place')}
              </button>
            )}
          </>
        )}
      </C2Card>

      <C2Card title={tn('clan2.hq.ruleTitle')} tour="hq-rules">
        <ol className="c2-rules">
          <li>{tn('clan2.hq.rule1')}</li>
          <li>{tn('clan2.hq.rule2')}</li>
          <li>{tn('clan2.hq.rule3')}</li>
          <li>{tn('clan2.hq.rule4')}</li>
        </ol>
      </C2Card>

      <C2Card title={tn('clan2.hq.buildingsTitle')} hint={tn('clan2.hq.buildingsHint')} tour="hq-buildings">
        <ul className="c2-projects">
          {PROJECT_IDS.map((id: ProjectId) => {
            const level = s.projects[id]
            const cost = level < 3 ? PROJECTS[id].costs[level as 0 | 1 | 2] : 0
            return (
              <li key={id}>
                <div className="c2-project-top">
                  <strong>{tnd(`clan2.project.${id}.name`)}</strong>
                  <span className="c2-pips" aria-label={tn('clan2.hq.level', { a: level })}>
                    {[1, 2, 3].map((n) => (
                      <i key={n} className={level >= n ? 'on' : undefined} />
                    ))}
                  </span>
                </div>
                <p className="c2-muted small">{tnd(`clan2.project.${id}.desc`)}</p>
                {level < 3 ? (
                  manage && (
                    <button className="btn-secondary" onClick={() => act(upgradeProject(id), 'upgraded')} disabled={s.treasury.balance < cost}>
                      {tn('clan2.hq.upgrade', { n: cost })}
                    </button>
                  )
                ) : (
                  <span className="c2-ok">{tn('clan2.hq.maxed')}</span>
                )}
              </li>
            )
          })}
        </ul>
      </C2Card>

      <C2Card title={tn('clan2.hq.skinsTitle')} hint={tn('clan2.hq.skinsHint')} tour="hq-skins">
        <div className="c2-skins">
          {CLAN_SKINS.map((k) => {
            const owned = s.owned.includes(k.id)
            const worn = s.equippedSkin === k.id
            return (
              <div key={k.id} className={`c2-skin${worn ? ' worn' : ''}`}>
                <SkinSwatch id={k.id} color={color} size={88} seed={0.21 + CLAN_SKINS.indexOf(k) * 0.17} />
                <strong>{tnd(`clan2.skin.${k.id}`)}</strong>
                {owned ? (
                  manage ? (
                    <button className={worn ? 'btn-secondary' : 'btn-primary'} disabled={worn} onClick={() => act(equipSkin(k.id), 'skinEquipped')}>
                      {worn ? tn('clan2.hq.skinOn') : tn('clan2.hq.skinWear')}
                    </button>
                  ) : (
                    <span className="c2-muted small">{worn ? tn('clan2.hq.skinOn') : ''}</span>
                  )
                ) : (
                  <>
                    <C2Coins n={k.price} />
                    {manage && (
                      <button className="btn-secondary" onClick={() => act(setGoal(`skin_${k.id}`), 'goalSet')}>
                        {tn('clan2.hq.skinSave')}
                      </button>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
        {manage && s.equippedSkin && (
          <button className="c2-link" onClick={() => act(equipSkin(null))}>
            {tn('clan2.hq.skinNone')}
          </button>
        )}
      </C2Card>

      <C2Card title={tn('clan2.hq.partnersTitle')} hint={tn('clan2.hq.partnersHint')} tour="hq-partners">
        <ul className="c2-offers">
          {s.offers.map((o) => (
            <li key={o.id}>
              <div>
                <strong>{o.shop}</strong>
                <div className="c2-muted small">{tnd(`clan2.offer.${o.titleKey}`)}</div>
              </div>
              {o.owned ? (
                <span className="c2-ok">{tn('clan2.hq.offerOwned')}</span>
              ) : (
                <button className="btn-secondary" disabled={!manage || s.treasury.balance < o.cost} onClick={() => act(buyOffer(o.id), 'bought')}>
                  {tn('clan2.hq.offerBuy', { n: o.cost })}
                </button>
              )}
            </li>
          ))}
        </ul>
      </C2Card>
    </div>
  )
}
