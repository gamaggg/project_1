'use client'

import { useState } from 'react'
import { CoinIcon } from '@/components/app-shell/CoinIcon'
import { ClanHero } from '@/components/app-shell/ClanHero'
import { TerritoryColorPreviewMap } from '@/components/app-shell/TerritoryColorPreviewMap'
import { resolveCrest } from '@/lib/data/clanCrests'
import { C2Coins, C2Count, C2Sheet, useC2 } from '@/components/clan2/C2Common'
import { ItemPreview, itemName } from '@/components/clan2/ClanItems'
import { buyItem, canManage, capOf, equipItem, goalOf, setGoal, siegeLocked, useDemoState } from '@/lib/clan2/demoStore'
import { CLAN_SKIN_FACTOR, SHOP_ITEMS, SHOP_KINDS, fmt, type ShopKind } from '@/lib/clan2/rules'
import type { DemoState, GoalItem } from '@/lib/clan2/types'
import { tn } from '@/lib/i18n/runtime'

// «Магазин» (the third part of «Общак»): what the treasury buys for the whole clan, laid out like the player's own
// shop in the profile: categories, a grid of cards, «Примерить». The leader and the co-leaders buy and set the goal;
// everybody else sees the same shop and can try things on.

type TKey = Parameters<typeof tn>[0]

// The player's shop colours a card by its price; a clan's item costs about five times a player's.
function rarity(cost: number): string {
  const p = cost / CLAN_SKIN_FACTOR
  if (p >= 800) return 'shop-card-legendary'
  if (p > 500) return 'shop-card-epic'
  if (p > 200) return 'shop-card-rare'
  return 'shop-card-common'
}

const equippedOf = (s: DemoState, item: GoalItem) => (item.kind === 'clan_skin' ? s.equippedSkin === item.id : s.equipped[item.kind] === item.id)

function KindIcon({ kind }: { kind: ShopKind }) {
  const p = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
  if (kind === 'clan_skin')
    return (
      <svg {...p} aria-hidden="true">
        <path d="M7 3h10l5 9-5 9H7L2 12z" />
        <path d="M6 8l9 9M9 5l9 9M5 12l6 6" />
      </svg>
    )
  if (kind === 'boat')
    return (
      <svg {...p} aria-hidden="true">
        <path d="M2 15h20l-3 4H5z" />
        <path d="M7 15v-3M11 15v-3M15 15v-3M19 13l2-4" />
      </svg>
    )
  return (
    <svg {...p} aria-hidden="true">
      <path d="M7 2.5h10l5.5 9.5-5.5 9.5H7L1.5 12z" />
      <path d="M9 7h6l3 5-3 5H9l-3-5z" />
    </svg>
  )
}

export function ShopTab() {
  const s = useDemoState()
  const { act } = useC2()
  const manage = canManage(s)
  const [kind, setKind] = useState<ShopKind>('clan_skin')
  const [open, setOpen] = useState<GoalItem | null>(null)
  const goal = goalOf(s)
  const cap = capOf(s)
  const items = SHOP_ITEMS.filter((x) => x.kind === kind)

  return (
    <div className="c2-stack c2-shop">
      <div className="c2-shop-wallet card">
        <div className="c2-shop-wallet-top">
          <CoinIcon size={28} />
          <span className="c2-shop-wallet-num">
            <C2Count value={s.treasury.balance} />
          </span>
          <span className="c2-shop-wallet-label">{tn('clan2.shop.inTreasury', { cap: fmt(cap) })}</span>
        </div>
        <p className="c2-shop-wallet-note">{manage ? tn('clan2.shop.noteManager') : tn('clan2.shop.noteMember')}</p>
        {goal && (
          <div className="c2-shop-wallet-goal">
            <span>{tn('clan2.shop.goalNow')}</span>
            <b>{itemName(goal.id)}</b>
          </div>
        )}
      </div>

      <div className="shop-tabs c2-shop-tabs" role="tablist">
        {SHOP_KINDS.map((k) => (
          <button key={k} role="tab" aria-selected={kind === k} className={`shop-tab${kind === k ? ' active' : ''}`} onClick={() => setKind(k)}>
            <KindIcon kind={k} />
            {tn(`clan2.shop.kind_${k}` as TKey)}
          </button>
        ))}
      </div>
      <p className="shop-section-caption c2-shop-caption">{tn(`clan2.shop.caption_${kind}` as TKey)}</p>

      <div className="shop-grid c2-shop-grid" key={kind}>
        {items.map((item) => {
          const owned = s.owned.includes(item.id)
          const worn = equippedOf(s, item)
          const locked = !owned && s.clan.level < item.minLevel
          const isGoal = s.treasury.goalId === item.id
          return (
            <div key={item.id} className={`shop-card ${rarity(item.cost)}${locked ? ' c2-shop-locked' : ''}`}>
              <button type="button" className="c2-shop-preview" onClick={() => setOpen(item)} aria-label={`${itemName(item.id)}: ${tn('shop.tryOn')}`}>
                <ItemPreview item={item} crest={s.clan.crest} size={item.kind === 'boat' ? 120 : 76} />
              </button>
              <div className="shop-card-name">{itemName(item.id)}</div>
              {owned ? (
                worn ? (
                  <button className="btn-secondary shop-equipped" disabled={!manage} onClick={() => act(equipItem(item.kind, null))}>
                    {manage ? tn('clan2.shop.takeOff') : tn('clan2.shop.worn')}
                  </button>
                ) : manage ? (
                  <button className="btn-primary" onClick={() => act(equipItem(item.kind, item.id), 'equipped')}>
                    {tn('clan2.shop.wear')}
                  </button>
                ) : (
                  <span className="c2-shop-state">{tn('clan2.shop.bought')}</span>
                )
              ) : locked ? (
                <span className="c2-shop-lock">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="5" y="11" width="14" height="10" rx="2" />
                    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                  </svg>
                  {tn('clan2.shop.fromLevel', { n: item.minLevel })}
                </span>
              ) : manage ? (
                <button className="btn-secondary shop-price-btn" onClick={() => setOpen(item)}>
                  <CoinIcon size={16} />
                  {fmt(item.cost)}
                </button>
              ) : (
                <span className="c2-shop-price">
                  <C2Coins n={item.cost} />
                </span>
              )}
              <button className="challenge-swap-btn" onClick={() => setOpen(item)}>
                {tn('shop.tryOn')}
              </button>
              {manage && !owned && (isGoal ? <span className="c2-shop-goal-tag">{tn('clan2.shop.isGoal')}</span> : <button className="challenge-swap-btn" onClick={() => act(setGoal(item.id), 'goalSet')}>{tn('clan2.shop.setGoal')}</button>)}
            </div>
          )
        })}
      </div>

      <C2Sheet open={!!open} onClose={() => setOpen(null)} title={open ? itemName(open.id) : ''}>
        {open && <TryOn item={open} onDone={() => setOpen(null)} />}
      </C2Sheet>
    </div>
  )
}

// «Примерить»: the item on the clan, big, with what it is and what can be done with it.
function TryOn({ item, onDone }: { item: GoalItem; onDone: () => void }) {
  const s = useDemoState()
  const { act } = useC2()
  const manage = canManage(s)
  const owned = s.owned.includes(item.id)
  const worn = equippedOf(s, item)
  const locked = !owned && s.clan.level < item.minLevel
  const isGoal = s.treasury.goalId === item.id
  const short = Math.max(0, item.cost - s.treasury.balance)
  return (
    <div className="c2-stack c2-tryon">
      <div className={`c2-tryon-stage ${item.kind}`}>
        {item.kind === 'frame' ? (
          <ClanHero crest={s.clan.crest} name={s.clan.name} motto={null} background={s.clan.background} compact frame={item.id} />
        ) : item.kind === 'clan_skin' ? (
          <div className="tryon-map c2-tryon-map">
            <TerritoryColorPreviewMap city={s.clan.city ?? 'batumi'} myTerritoryColor={resolveCrest(s.clan.crest).primary} equippedSkin={item.id} />
          </div>
        ) : (
          <ItemPreview item={item} crest={s.clan.crest} size={item.kind === 'boat' ? 260 : 150} />
        )}
      </div>
      <p className="c2-tryon-what">{tn(`clan2.shop.what_${item.kind}` as TKey)}</p>
      <div className="c2-tryon-facts">
        <span className="challenge-fact">
          {tn('clan2.shop.price')}
          <b>
            <C2Coins n={item.cost} />
          </b>
        </span>
        <span className={`challenge-fact${locked ? '' : ' c2-fact-ok'}`}>{tn('clan2.shop.fromLevel', { n: item.minLevel })}</span>
        {owned && <span className="challenge-fact c2-fact-ok">{worn ? tn('clan2.shop.worn') : tn('clan2.shop.bought')}</span>}
      </div>
      {manage ? (
        <>
          {owned ? (
            worn ? (
              <button className="btn-secondary" onClick={() => act(equipItem(item.kind, null)) && onDone()}>
                {tn('clan2.shop.takeOff')}
              </button>
            ) : (
              <button className="btn-primary" onClick={() => act(equipItem(item.kind, item.id), 'equipped') && onDone()}>
                {tn('clan2.shop.wear')}
              </button>
            )
          ) : (
            <>
              <button className="btn-primary" disabled={siegeLocked(s) || locked || short > 0} onClick={() => act(buyItem(item.id), 'bought') && onDone()}>
                {siegeLocked(s) ? tn('clan2.siegeLock.btn') : locked ? tn('clan2.base.levelLow', { n: item.minLevel }) : short > 0 ? tn('clan2.base.missing', { n: fmt(short) }) : tn('clan2.shop.buyFor', { n: fmt(item.cost) })}
              </button>
              {isGoal ? (
                <button className="btn-secondary" onClick={() => act(setGoal(null), 'goalCleared')}>
                  {tn('clan2.shop.clearGoal')}
                </button>
              ) : (
                <button className="btn-secondary" onClick={() => act(setGoal(item.id), 'goalSet') && onDone()}>
                  {tn('clan2.shop.setGoal')}
                </button>
              )}
            </>
          )}
        </>
      ) : (
        <p className="c2-hint faint">{tn('clan2.shop.noteMember')}</p>
      )}
    </div>
  )
}
