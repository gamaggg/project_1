'use client'

import '@/app/clan2.css'
import { useState, useSyncExternalStore } from 'react'
import { ClanCrest } from '@/components/app-shell/ClanCrest'
import { ClanHero } from '@/components/app-shell/ClanHero'
import { RaceBoat } from '@/components/app-shell/RaceBoat'
import { SkinPreview } from '@/components/app-shell/SkinPreview'
import { ART } from '@/components/clan2/BaseArt'
import { BaseView } from '@/components/clan2/BaseView'
import { BuildMoment } from '@/components/clan2/BuildMoment'
import { ClanFrame } from '@/components/clan2/ClanItems'
import { HqMoment, type HqMomentKind, type HqMomentSide } from '@/components/clan2/HqMoment'
import { SectorMoment, type SectorMomentDemo } from './SectorMoments'
import { hqBannerSvg, hqMarkerHtml, ruinsMarkerHtml } from '@/lib/clan2/live/hqMarker'
import { previewProjects } from '@/lib/clan2/live/otherHqs'
import { clanWeekDigestText } from '@/lib/telegram/clanDigest'
import { PROJECT_IDS, SHOP_ITEMS } from '@/lib/clan2/rules'
import type { ProjectId, ProjectLevel } from '@/lib/clan2/types'
import { CLAN_BACKGROUNDS } from '@/lib/data/clanBackgrounds'
import { CREST_COLORS, CREST_SHAPES, CREST_SYMBOLS } from '@/lib/data/clanCrests'
import { TERRITORY_SKINS } from '@/lib/data/territorySkins'
import { tn, tnd } from '@/lib/i18n/runtime'

// /clan-preview/art: every picture and animation of the clan update side by side, for the owner to look at without
// playing — the buildings of the base in their three levels, every crest shape, symbol and colour, the frames on every
// shape, the sector skins and the boats of the clan shop, the clan banner's backgrounds, the HQ on the map, the
// headquarters' moments (both sides) and the sector moments of solo play. Development only.

const OUR = { shape: 'shield', symbol: 'fish', primary: '#2F6FD0', secondary: '#FFFFFF' }
const THEIRS = { shape: 'round', symbol: 'anchor', primary: '#D2452E', secondary: '#FFE7A0' }

const MOMENTS: { kind: HqMomentKind; side: HqMomentSide; title: string; note: string; props: Record<string, unknown> }[] = [
  { kind: 'hit', side: 'defender', title: 'Твой штаб: снят щит', note: 'Чужой улов на секторе штаба: щит трескается и падает.', props: { defense: 1 } },
  { kind: 'siege', side: 'defender', title: 'Твой штаб: осада', note: 'Щитов нет, чужой улов начал осаду: флаг дрожит, часы идут.', props: { minutes: 90 } },
  { kind: 'saved', side: 'defender', title: 'Твой штаб: осада снята', note: 'Улов участника на секторе штаба: щит вернулся, награда.', props: { name: 'Ruslan', coins: 150 } },
  { kind: 'fell', side: 'defender', title: 'Твой штаб: пал', note: 'Осаду не сняли: флаг падает, остаются руины, монеты унесли.', props: { coins: -1200 } },
  { kind: 'hit', side: 'attacker', title: 'Ты атакуешь: снял щит', note: 'Твой улов на чужом штабе снял щит.', props: { defense: 0 } },
  { kind: 'siege', side: 'attacker', title: 'Ты атакуешь: осада', note: 'Твой улов при пустых щитах начал осаду.', props: { minutes: 90, clanName: 'Морские волки' } },
  { kind: 'captured', side: 'attacker', title: 'Ты атакуешь: штаб захвачен', note: 'Осада не снята: их флаг падает, встаёт твой, добыча летит к тебе.', props: { coins: 1200, clanName: 'Морские волки' } },
]

const ME = '#FC5200'
const OTHER = '#3E7BFA'
const SECTOR_MOMENTS: { title: string; note: string; m: SectorMomentDemo }[] = [
  { title: 'Захват свободного сектора', note: 'Твой улов на свободном секторе: аватар падает сверху, сектор заливается твоим цветом.', m: { kind: 'capture', fromColor: '#9AA4B2', toColor: ME, fromName: null, toName: 'gamag', defense: 1 } },
  { title: 'Отбил сектор у игрока', note: 'Защиты у чужого сектора нет: ты выбиваешь его аватар и забираешь сектор.', m: { kind: 'steal', fromColor: OTHER, toColor: ME, fromName: 'Ruslan', toName: 'gamag', defense: 1 } },
  { title: 'Атака: снял щит', note: 'У чужого сектора есть защита: твой аватар отскакивает, щит гаснет.', m: { kind: 'attack', fromColor: OTHER, toColor: ME, fromName: 'Ruslan', toName: 'gamag', defense: 1 } },
  { title: 'Укрепил свой сектор', note: 'Улов на своём секторе: аватар подпрыгивает, загорается новый щит.', m: { kind: 'own', fromColor: ME, toColor: ME, fromName: 'gamag', toName: 'gamag', defense: 2 } },
  { title: 'Пока тебя не было: сектор отбили', note: 'Повтор для того, у кого отбили сектор, при входе в приложение.', m: { kind: 'steal', victim: true, fromColor: ME, toColor: OTHER, fromName: 'gamag', toName: 'Ruslan', defense: 1 } },
  { title: 'Пока тебя не было: атаковали', note: 'Повтор для того, чей сектор атаковали: щит снят, сектор устоял.', m: { kind: 'attack', victim: true, fromColor: ME, toColor: OTHER, fromName: 'gamag', toName: 'Ruslan', defense: 1 } },
]

// A tile with its own «Повторить» under it (the page is long: no scrolling back to the top to replay).
function Replay({ all, children, className, caption }: { all: number; children: (key: string) => React.ReactNode; className: string; caption: React.ReactNode }) {
  const [own, setOwn] = useState(0)
  return (
    <figure className={className}>
      {children(`${all}-${own}`)}
      <figcaption>{caption}</figcaption>
      <button type="button" className="btn-secondary art-tile-replay" onClick={() => setOwn((n) => n + 1)}>
        Повторить анимацию
      </button>
    </figure>
  )
}

// Drawn in the browser only: the crests' SVG ids are numbered as they are drawn, so a server render would not match.
const noop = () => () => {}
const FRAMES = [null, 'frame_bronze', 'frame_silver', 'frame_gold', 'frame_legend'] as const
const fmt = (n: number) => n.toLocaleString('ru-RU')
const priceOf = (id: string) => SHOP_ITEMS.find((x) => x.id === id)
const SECTIONS = [
  ['buildings', 'Постройки'],
  ['crests', 'Гербы'],
  ['frames', 'Рамки'],
  ['skins', 'Скины секторов'],
  ['boats', 'Лодки'],
  ['backgrounds', 'Фоны шапки'],
  ['map', 'Штаб на карте'],
  ['hq', 'Анимации штаба'],
  ['built', 'Постройка готова'],
  ['other', 'Чужая база'],
  ['telegram', 'Итоги недели'],
  ['sector', 'Анимации сектора'],
] as const
// «Постройка готова» on every building, at a level each (1, 2, 3, 1, 2, 3).
const BUILT: { id: ProjectId; level: ProjectLevel }[] = PROJECT_IDS.map((id, i) => ({ id, level: ((i % 3) + 1) as ProjectLevel }))
// Another clan's base, as a player sees it from that clan's HQ on the map (the geo: a sector of Batumi by the sea).
const OTHER_GEO = { lat: 41.653959, lng: 41.628128, widthDeg: 0.008332 }
// The Monday message of a clan, as the bot sends it.
const DIGEST = {
  clanName: 'BFC',
  income: 2140,
  spent: 900,
  top: [
    { name: 'Ruslan', coins: 600 },
    { name: 'gamag', coins: 450 },
    { name: 'Nika', coins: 300 },
  ],
  built: [{ project: 'dock', level: 2 }],
  sectors: 27,
  catches: 54,
  fishers: 8,
}
export function ArtShowcase() {
  const [play, setPlay] = useState(0)
  const client = useSyncExternalStore(noop, () => true, () => false)
  if (!client) return <div className="art-page" />
  return (
    <div className="art-page">
      <h1>Клановое обновление: картинки и анимации</h1>
      <p className="art-lead">Всё, что нарисовано для клана, на одной странице. Цены и уровни — как в магазине клана. Анимации можно повторить кнопкой под каждой.</p>
      <nav className="art-nav">
        {SECTIONS.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="filter-chip">
            {label}
          </a>
        ))}
      </nav>

      <section id="buildings">
        <h2>Постройки базы: уровни 1, 2, 3</h2>
        <div className="art-grid buildings">
          {PROJECT_IDS.map((id) => {
            const Art = ART[id]
            return (
              <figure key={id} className="art-tile">
                <div className="art-levels">
                  {([1, 2, 3] as ProjectLevel[]).map((lv) => (
                    <svg key={lv} viewBox="-56 -108 112 120" width="150" height="160" overflow="visible">
                      <Art level={lv} p={OUR.primary} s={OUR.secondary} />
                    </svg>
                  ))}
                </div>
                <figcaption>
                  <b>{tnd(`clan2.project.${id}.name`)}</b>
                </figcaption>
              </figure>
            )
          })}
        </div>
      </section>

      <section id="crests">
        <h2>Гербы</h2>
        <h3 className="art-sub">Формы ({CREST_SHAPES.length})</h3>
        <div className="art-grid crests">
          {CREST_SHAPES.map((x) => (
            <figure key={x.id} className="art-tile art-crest">
              <ClanCrest crest={{ ...OUR, shape: x.id }} size={84} />
              <figcaption>
                <b>{x.label}</b>
                <span>с уровня {x.level}</span>
              </figcaption>
            </figure>
          ))}
        </div>
        <h3 className="art-sub">Значки ({CREST_SYMBOLS.length})</h3>
        <div className="art-grid crests">
          {CREST_SYMBOLS.map((x) => (
            <figure key={x.id} className="art-tile art-crest">
              <ClanCrest crest={{ ...OUR, symbol: x.id }} size={84} />
              <figcaption>
                <b>{x.label}</b>
                <span>с уровня {x.level}</span>
              </figcaption>
            </figure>
          ))}
        </div>
        <h3 className="art-sub">Цвета ({CREST_COLORS.length})</h3>
        <div className="art-grid crests">
          {CREST_COLORS.map((x) => (
            <figure key={x.id} className="art-tile art-crest">
              <ClanCrest crest={{ ...OUR, primary: x.id }} size={72} />
              <figcaption>
                <b>{x.label}</b>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section id="frames">
        <h2>Рамки герба на каждой форме</h2>
        <p className="art-lead art-note">Строка — форма герба, столбец — рамка. На телефоне таблица листается вбок.</p>
        <div className="art-matrix">
          <div className="art-matrix-row art-matrix-head">
            <span />
            {FRAMES.map((f) => {
              const it = f ? priceOf(f) : null
              return (
                <b key={f ?? 'none'}>
                  {f ? tnd(`clan2.shop.item.${f}`) : 'Без рамки'}
                  {it && <small>{fmt(it.cost)} · ур. {it.minLevel}</small>}
                </b>
              )
            })}
          </div>
          {CREST_SHAPES.map((x) => (
            <div key={x.id} className="art-matrix-row">
              <span>{x.label}</span>
              {FRAMES.map((f) => (
                <div key={f ?? 'none'} className="art-frame">
                  <ClanFrame id={f} size={64} crest={{ ...OUR, shape: x.id }}>
                    <ClanCrest crest={{ ...OUR, shape: x.id }} size={64} />
                  </ClanFrame>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section id="skins">
        <h2>Скины секторов ({TERRITORY_SKINS.length})</h2>
        <p className="art-lead art-note">В цвете герба клана, как их видно на слое «Кланы». Цена — для клана (впятеро дороже, чем игроку).</p>
        <div className="art-grid skins">
          {TERRITORY_SKINS.map((x) => {
            const it = priceOf(x.id)
            return (
              <figure key={x.id} className="art-tile art-skin">
                <SkinPreview skinId={x.id} color={OUR.primary} width={140} />
                <figcaption>
                  <b>{x.label}</b>
                  {it && <span>{fmt(it.cost)} монет · с уровня клана {it.minLevel}</span>}
                </figcaption>
              </figure>
            )
          })}
        </div>
      </section>

      <section id="boats">
        <h2>Лодки для битвы кланов</h2>
        <div className="art-grid boats">
          {[
            [null, 'Цвета клана (без скина)'],
            ['boat_coral', 'Коралловая'],
            ['boat_night', 'Ночная'],
            ['boat_gold', 'Золотая'],
            ['boat_dragon', 'Дракон'],
          ].map(([id, title]) => {
            const it = id ? priceOf(id) : null
            return (
              <figure key={title} className="art-tile">
                <div className="art-water">
                  <RaceBoat crest={OUR} crew={6} unit={2} skin={id} />
                </div>
                <figcaption>
                  <b>{title}</b>
                  {it && <span>{fmt(it.cost)} монет · с уровня клана {it.minLevel}</span>}
                </figcaption>
              </figure>
            )
          })}
          <figure className="art-tile">
            <div className="art-water">
              <RaceBoat crest={THEIRS} crew={6} unit={2} />
            </div>
            <figcaption>
              <b>Цвета другого клана (без скина)</b>
            </figcaption>
          </figure>
        </div>
      </section>

      <section id="backgrounds">
        <h2>Фоны шапки клана ({CLAN_BACKGROUNDS.length})</h2>
        <div className="art-grid backgrounds">
          {CLAN_BACKGROUNDS.map((b) => (
            <figure key={b.id} className="art-tile">
              <ClanHero crest={OUR} name="BFC" motto={null} background={b.id} compact frame="frame_gold" />
              <figcaption>
                <b>{b.label}</b>
                <span>с уровня {b.level}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section id="map">
        <h2>Штаб на карте</h2>
        <div className="art-grid markers">
          {[
            ['Штаб клана', hqMarkerHtml(OUR, { siege: false, label: 'BFC', tag: 'B1079', tier: 2 })],
            ['Штаб в осаде', hqMarkerHtml(OUR, { siege: true, label: 'BFC', tag: 'B1079', tier: 2 })],
            ['Штаб издалека', hqMarkerHtml(OUR, { siege: false, label: 'BFC', tag: '', tier: 0 })],
            ['Осада издалека', hqMarkerHtml(OUR, { siege: true, label: 'BFC', tag: '', tier: 0 })],
            ['Руины павшего штаба', ruinsMarkerHtml('', 2)],
          ].map(([title, html]) => (
            <figure key={title} className="art-tile">
              <div className="art-stage art-stage-map art-marker" dangerouslySetInnerHTML={{ __html: html }} />
              <figcaption>
                <b>{title}</b>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section id="hq">
        <div className="art-head">
          <h2>Анимации штаба</h2>
          <button className="btn-primary art-replay" onClick={() => setPlay((n) => n + 1)}>
            Проиграть ещё раз
          </button>
        </div>
        <div className="art-grid moments">
          {MOMENTS.map((m) => (
            <Replay
              key={`${m.kind}${m.side}`}
              all={play}
              className={`art-tile ${m.side}`}
              caption={
                <>
                  <b>{m.title}</b>
                  <span>{m.note}</span>
                </>
              }
            >
              {(k) => (
                <div className="art-stage">
                  <HqMoment key={k} kind={m.kind} side={m.side} crest={m.side === 'attacker' ? THEIRS : OUR} attackerCrest={m.side === 'attacker' ? OUR : THEIRS} {...m.props} size={230} />
                </div>
              )}
            </Replay>
          ))}
        </div>
      </section>

      <section id="built">
        <div className="art-head">
          <h2>Постройка готова</h2>
          <button className="btn-primary art-replay" onClick={() => setPlay((n) => n + 1)}>
            Проиграть ещё раз
          </button>
        </div>
        <p className="art-lead art-note">Стройка закончилась: момент видит весь клан, где бы игрок ни был в приложении, и уведомление приходит в «Активность» и Telegram.</p>
        <div className="art-grid moments">
          {BUILT.map((b) => (
            <Replay
              key={b.id}
              all={play}
              className="art-tile"
              caption={
                <>
                  <b>
                    {tnd(`clan2.project.${b.id}.name`)}, уровень {b.level}
                  </b>
                  <span>{tn('clan2.moment.textBuilt')}</span>
                </>
              }
            >
              {(k) => (
                <div className="art-stage">
                  <BuildMoment key={k} id={b.id} level={b.level} crest={OUR} size={230} />
                </div>
              )}
            </Replay>
          ))}
        </div>
      </section>

      <section id="other">
        <h2>Чужая база и путь в клан</h2>
        <p className="art-lead art-note">На слое «Кланы» стоят штабы всех кланов города. Нажал на чужой флаг — открылся сектор, на нём база этого клана, уровень, места и кнопка «Вступить в клан». Игроку без клана под панелью карты подсказка.</p>
        <div className="art-other">
          <div className="art-other-col">
            <div className="map-hud art-hud">
              <div className="c2-solo-hint" role="note">
                <span className="c2-solo-hint-flag" aria-hidden>
                  <svg width="14" height="14" viewBox="0 0 14 14">
                    <path d="M3.5 1.5v11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                    <path d="M4.1 2.2h7.2l-1.7 2.9 1.7 2.9H4.1z" fill="currentColor" />
                  </svg>
                </span>
                <span className="c2-solo-hint-text">{tn('clan2.other.hint')}</span>
              </div>
            </div>
            <figcaption className="art-caption">
              <b>Подсказка игроку без клана</b>
              <span>Под панелью карты на слое «Кланы»; крестик скрывает её насовсем.</span>
            </figcaption>
          </div>
          <div className="art-other-col">
            <div className="c2-hq-card other" style={{ ['--hq' as string]: THEIRS.primary }}>
              <div className="c2-hq-card-top">
                <span className="c2-hq-card-banner" dangerouslySetInnerHTML={{ __html: hqBannerSvg(THEIRS, 34, 50) }} />
                <div className="c2-hq-card-text">
                  <b>{tn('clan2.other.title', { name: 'Морские волки' })}</b>
                  <span className="c2-hq-card-name">{tn('clan2.other.meta', { level: 6, n: 17, cap: 25 })}</span>
                </div>
              </div>
              <div className="c2-hq-card-base">
                <BaseView crest={THEIRS} projects={previewProjects(21, 6)} geo={OTHER_GEO} />
              </div>
              <p className="c2-hq-card-rent">{tn('clan2.other.why')}</p>
              <p className="c2-hq-card-join">Вход свободный</p>
              <button type="button" className="c2-hq-card-open">
                {tn('clan2.other.join')}
              </button>
            </div>
            <figcaption className="art-caption">
              <b>Карточка чужого штаба на экране сектора</b>
              <span>Кнопка ведёт на страницу клана: там его условия и настоящая кнопка вступления. Тот, кто уже в клане, видит «Открыть клан».</span>
            </figcaption>
          </div>
        </div>
      </section>

      <section id="telegram">
        <h2>Итоги недели клана в Telegram</h2>
        <p className="art-lead art-note">Каждый понедельник в 10:00 по Москве всем участникам клана. Клану без монет и уловов за неделю не приходит. То же событие есть в «Активности».</p>
        <div className="art-tg">
          <div className="art-tg-bubble">
            <pre>{clanWeekDigestText(DIGEST)}</pre>
            <span className="art-tg-time">10:00</span>
          </div>
          <div className="art-tg-btn">{tn('tg.btnClan')}</div>
        </div>
      </section>

      <section id="sector">
        <div className="art-head">
          <h2>Анимации сектора (одиночная игра)</h2>
          <button className="btn-primary art-replay" onClick={() => setPlay((n) => n + 1)}>
            Проиграть ещё раз
          </button>
        </div>
        <div className="art-grid moments">
          {SECTOR_MOMENTS.map((x) => (
            <Replay
              key={x.title}
              all={play}
              className="art-tile"
              caption={
                <>
                  <b>{x.title}</b>
                  <span>{x.note}</span>
                </>
              }
            >
              {(k) => (
                <div className="art-stage art-stage-map">
                  <SectorMoment key={k} m={x.m} />
                </div>
              )}
            </Replay>
          ))}
        </div>
      </section>

    </div>
  )
}
