import { AWARD_ICONS, AWARD_COLOR } from '@/components/app-shell/awardIcons'
import { ACH_ICONS } from '@/components/app-shell/icons'
import type { AwardKind } from '@/lib/data/types'

// Icons for the feed's own (non-person) entries — awards, weekly results,
// moderation, challenges — in place of emoji, drawn in the same line style
// as the rest of the app.

// Award/achievement notifications carry only a title (see
// fanout_award_notification / _sync_achievements_for_user), and those titles
// are fixed strings in the database — so the title is enough to find the
// right medal or badge.
const AWARD_BY_TITLE: Record<string, string> = {
  '1 место': 'weekly_rank',
  '2 место': 'weekly_rank',
  '3 место': 'weekly_rank',
  'Хранитель сектора': 'guardian',
  'Улов месяца': 'catch_of_month',
  'Молния': 'lightning',
  'Легенда сезона': 'season_legend',
  'Ночной страж': 'night_watch',
  'Дуэлянт': 'duelist',
  'Победитель битвы кланов': 'clan_race_winner',
  // The weekly race's earlier name — medals already issued keep it.
  'Победитель регаты': 'clan_race_winner',
  'Хозяин горячего сектора': 'hot_sector',
}

const ACHIEVEMENT_BY_TITLE: Record<string, string> = {
  'Первый улов': 'first',
  'Три территории': 'territory',
  'Коллекционер видов': 'species',
  'Ранний рыбак': 'sunrise',
  'Личный рекорд 40 см': 'record',
  'Десять уловов': 'ten',
  'Ночной клёв': 'nightowl',
  'Универсал': 'universal',
  'Всеядный': 'allmethods',
  'Экспериментатор': 'allbaits',
  'Обошёл всё побережье': 'allwaters',
  'Тяжеловес': 'heavy',
  'Гигант': 'giant',
  'Постоянный клиент': 'loyal',
  'Хозяин побережья': 'landlord',
  'Известный рыбак': 'popular',
  'Отбил территорию': 'conqueror',
}

const Svg = ({ children }: { children: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
)

export const FEED_ICONS = {
  medal: (
    <Svg>
      <path d="M8 3h8l-2.2 5.2M8 3l2.2 5.2" />
      <circle cx="12" cy="14.5" r="5.5" />
      <path d="m12 12 .9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2-1.45-1.4 2-.3Z" fill="currentColor" stroke="none" />
    </Svg>
  ),
  podium: (
    <Svg>
      <path d="M9 20V9h6v11M3 20v-7h6M15 20v-5h6v5M2.5 20h19" />
      <path d="m12 3.2.7 1.4 1.5.2-1.1 1.1.3 1.5-1.4-.7-1.4.7.3-1.5-1.1-1.1 1.5-.2Z" fill="currentColor" stroke="none" />
    </Svg>
  ),
  shield: (
    <Svg>
      <path d="M12 3 19.5 6v5.5c0 4.6-3.2 8-7.5 9.5-4.3-1.5-7.5-4.9-7.5-9.5V6Z" />
      <path d="M12 8.5v4.2" />
      <circle cx="12" cy="15.8" r=".6" fill="currentColor" />
    </Svg>
  ),
  alert: (
    <Svg>
      <path d="M10.3 4.2 2.8 17.5A2 2 0 0 0 4.5 20.5h15a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9.5v4" />
      <circle cx="12" cy="16.9" r=".6" fill="currentColor" />
    </Svg>
  ),
  target: (
    <Svg>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.8" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
    </Svg>
  ),
  targetDone: (
    <Svg>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8 12.3 2.7 2.7L16.2 9.5" />
    </Svg>
  ),
  clock: (
    <Svg>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Svg>
  ),
  flame: (
    <Svg>
      <path d="M12 21c-3.6 0-6-2.4-6-5.6 0-3.4 2.6-5.4 3.6-8.4.3-.9 1.4-1.1 1.9-.3.9 1.5 1.1 2.8 2.4 3.6.4-.6.6-1.3.7-2 .1-.8 1.1-1.1 1.6-.4C17.6 9.9 18 12.4 18 15.4 18 18.6 15.6 21 12 21Z" />
    </Svg>
  ),
  laurel: (
    <Svg>
      <path d="M8.5 20.5C4.6 18.7 3 15 3.4 10.5M15.5 20.5c3.9-1.8 5.5-5.5 5.1-10M9.5 21.5h5" />
      <path d="M4.2 14.6c-1.2-.6-1.9-1.7-2-3 1.3 0 2.4.6 3 1.7M19.8 14.6c1.2-.6 1.9-1.7 2-3-1.3 0-2.4.6-3 1.7M3.6 10.4c-.9-.9-1.2-2.2-.9-3.4 1.2.4 2.1 1.3 2.4 2.5M20.4 10.4c.9-.9 1.2-2.2.9-3.4-1.2.4-2.1 1.3-2.4 2.5" />
    </Svg>
  ),
  bars: (
    <Svg>
      <path d="M5 19v-3M9.5 19v-6M14 19v-9M18.5 19V6" />
    </Svg>
  ),
  chat: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12Z" />
    </svg>
  ),
  gift: (
    <Svg>
      <path d="M4 11h16v9H4zM3 7.5h18V11H3zM12 7.5V20" />
      <path d="M12 7.5C10.5 7.5 8 7 8 5.2 8 3.9 9.6 3.3 10.6 4.4 11.3 5.2 12 7.5 12 7.5Zm0 0c1.5 0 4-.5 4-2.3 0-1.3-1.6-1.9-2.6-.8-.7.8-1.4 3.1-1.4 3.1Z" />
    </Svg>
  ),
}

type Tone = 'accent' | 'blue' | 'red' | 'gold' | 'green'

export function FeedIcon({ tone, icon }: { tone: Tone; icon: React.ReactNode }) {
  return <div className={`avatar feed-icon feed-icon-${tone}`}>{icon}</div>
}

// A medal in its own colours (as in the profile's awards ring), an
// achievement on the brand orange, or a plain medal if the title is new.
export function AwardFeedIcon({ title }: { title: string | null }) {
  const mapped = title ? AWARD_BY_TITLE[title] : undefined
  // Only medal kinds this build can draw (the regatta medal ships with clans).
  const awardKind = mapped && mapped in AWARD_COLOR ? (mapped as AwardKind) : undefined
  if (awardKind) {
    const { color, colorHi } = AWARD_COLOR[awardKind]
    return (
      <div className="avatar feed-icon" style={{ background: `linear-gradient(160deg, ${colorHi}, ${color})` }}>
        {AWARD_ICONS[awardKind]}
      </div>
    )
  }
  const achKey = title ? ACHIEVEMENT_BY_TITLE[title] : undefined
  if (achKey && ACH_ICONS[achKey]) return <FeedIcon tone="accent" icon={ACH_ICONS[achKey]} />
  return <FeedIcon tone="accent" icon={FEED_ICONS.medal} />
}
