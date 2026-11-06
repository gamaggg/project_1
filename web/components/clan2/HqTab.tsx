'use client'

import { C2Bar, C2Card, C2Coins, fmtLeft, useC2, useDemoNow } from '@/components/clan2/C2Common'
import { ClanCrest } from '@/components/app-shell/ClanCrest'
import { SkinSwatch } from '@/components/clan2/SkinSwatch'
import { BaseScene } from '@/components/clan2/BaseScene'
import { canManage, equipSkin, setGoal, siegeMinutesOf, useDemoState } from '@/lib/clan2/demoStore'
import { CLAN_SKINS, DAY, DEFENSE_MAX, HQ_LOOT_MAX, HQ_LOOT_SHARE, HQ_MOVE_COOLDOWN_DAYS } from '@/lib/clan2/rules'
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
  const ruinsOn = !!hq.ruins && now < hq.ruins.until
  const siegeMin = siegeMinutesOf(s)

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
            <C2Bar value={sector.defense / DEFENSE_MAX} tone={sector.defense === 0 ? 'bad' : sector.defense <= 1 ? 'warn' : 'good'} label={tn('clan2.hq.defense', { n: sector.defense })} />
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
            {ruinsOn ? (
              <div className="c2-ruins-card">
                <strong>{tn('clan2.hq.ruinsTitle', { id: hq.ruins!.sectorId })}</strong>
                <span>{tn('clan2.hq.ruinsBy', { by: hq.ruins!.by, n: hq.ruins!.loot })}</span>
                <span>{tn('clan2.hq.ruinsWait', { t: fmtLeft(hq.ruins!.until - now) })}</span>
                <small>{tn('clan2.hq.ruinsBuildings')}</small>
              </div>
            ) : (
              <>
                <p className="c2-muted">{tn('clan2.hq.none')}</p>
                <p className="c2-hint">{tn('clan2.hq.noneHint', { n: s.settings.hqPlaceCost })}</p>
              </>
            )}
            {manage && (
              <button className="btn-primary" disabled={ruinsOn} onClick={() => onGoMap?.({ place: true })}>
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
          <li>{tn('clan2.hq.rule3', { m: siegeMin })}</li>
        </ol>
        <div className="c2-label">{tn('clan2.hq.fallTitle')}</div>
        <ul className="c2-fall">
          <li>{tn('clan2.hq.fall1', { p: Math.round(HQ_LOOT_SHARE * 100), n: HQ_LOOT_MAX })}</li>
          <li>{tn('clan2.hq.fall2')}</li>
          <li>{tn('clan2.hq.fall3')}</li>
          <li>{tn('clan2.hq.fall4')}</li>
        </ul>
      </C2Card>

      <C2Card title={tn('clan2.base.title')} hint={tn('clan2.base.hint')} tour="hq-buildings">
        <BaseScene />
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

    </div>
  )
}
