// Spotlight tours (SpotlightTours.tsx): the screen dimmed around one element
// at a time — marked data-tour="<target>" — with a note beside it.
//
// Two audiences:
//   whatsNew — players who already fish (had catches before the release):
//              «Что нового» after the big update, map / sector / profile.
//   newcomer — new players and old ones without a catch: «Подсказка», shown
//              screen by screen as they get there — the map at once, the
//              catch form on the first catch, the Казна once they hold a
//              sector, the sector screen and the profile on first visit.
// A tour starts on its screen once its `requires` element is there; steps
// whose element this player doesn't have are left out. Each tour once per
// device; «Пропустить» ends every tour of that audience.
// RULE: new or changed features go into the FAQ too (lib/data/faq.ts).

export const TOURS_VERSION = '2026-10'

export type TourKey =
  | 'treasury'
  | 'forecast'
  | 'recap'
  | 'camera'
  | 'standing'
  | 'sectorForecast'
  | 'insights'
  | 'shop'
  | 'diary'
  | 'legend'
  | 'sectorCard'
  | 'nearest'
  | 'firstSteps'
  | 'species'
  | 'catchReward'
  | 'treasuryOwner'
  | 'challenges'
  | 'clan'
  | 'faq'
  | 'slotsMoved'
  | 'slots'
  | 'rewardsHere'
  | 'boosts'
  | 'boostDouble'
  | 'boostShields'
  | 'diaryNew'
  | 'diaryPeriods'
  | 'diaryNumbers'
  | 'diaryTimes'
export type TourStep = { target: string; key: TourKey }
// `always`: shown even to a player who pressed «Пропустить» on the tours.
// `unlessSeen`: not shown once the tour with that id has been seen.
export type Tour = { id: string; screen: string; requires: string; steps: TourStep[]; always?: boolean; unlessSeen?: string }
export type TourAudience = 'whatsNew' | 'newcomer'

// 09.10: the daily reward and the Казна are collected from the coin chip on
// the map, and «×2» / shields in reserve sit beside it. For everyone, old and
// new; a step whose chip this player doesn't have is left out — with none
// of them on the bar yet, the tour waits until one turns up.
// 09.10: the diary got its stats (periods, numbers that open what's behind
// them) and catch times under the photos. On «Мои уловы» the Diary tab is
// pointed out first; inside it the new parts, one by one.
const DIARY_TAB_TOUR: Tour = { id: 'diary-new-tab', screen: 'screen-catches', requires: 'diary-tab', steps: [{ target: 'diary-tab', key: 'diaryNew' }], always: true, unlessSeen: 'diary-stats' }
const DIARY_STATS_TOUR: Tour = {
  id: 'diary-stats',
  screen: 'screen-catches',
  requires: 'diary-numbers',
  steps: [
    { target: 'diary-periods', key: 'diaryPeriods' },
    { target: 'diary-numbers', key: 'diaryNumbers' },
    { target: 'diary-time', key: 'diaryTimes' },
  ],
  always: true,
}

const MAP_REWARDS_TOUR: Tour = {
  id: 'map-rewards',
  screen: 'screen-map',
  requires: 'map-hud',
  steps: [
    { target: 'treasury', key: 'rewardsHere' },
    { target: 'boosts', key: 'boosts' },
    { target: 'double', key: 'boostDouble' },
    { target: 'shields', key: 'boostShields' },
  ],
  always: true,
}

export const TOURS: Record<TourAudience, Tour[]> = {
  whatsNew: [
    {
      id: 'map',
      screen: 'screen-map',
      requires: 'camera',
      steps: [
        { target: 'treasury', key: 'treasury' },
        { target: 'forecast', key: 'forecast' },
        { target: 'recap', key: 'recap' },
        { target: 'camera', key: 'camera' },
      ],
    },
    {
      id: 'sector',
      screen: 'screen-territory',
      requires: 'standing',
      steps: [
        { target: 'standing', key: 'standing' },
        { target: 'sector-forecast', key: 'sectorForecast' },
        { target: 'insights', key: 'insights' },
      ],
    },
    {
      id: 'profile',
      screen: 'screen-profile',
      requires: 'shop',
      steps: [
        { target: 'shop', key: 'shop' },
        { target: 'diary', key: 'diary' },
        { target: 'faq', key: 'faq' },
      ],
    },
    // 09.10: the slots left the end of the Shop's tab row for a card under
    // the balance — everyone who knew them as a tab is told where they went.
    { id: 'shop-slots', screen: 'screen-shop', requires: 'slots-card', steps: [{ target: 'slots-card', key: 'slotsMoved' }], always: true },
    MAP_REWARDS_TOUR,
    DIARY_STATS_TOUR,
    DIARY_TAB_TOUR,
  ],
  newcomer: [
    {
      id: 'map',
      screen: 'screen-map',
      requires: 'legend',
      steps: [
        { target: 'legend', key: 'legend' },
        { target: 'sector-card', key: 'sectorCard' },
        { target: 'nearest', key: 'nearest' },
        { target: 'forecast', key: 'forecast' },
        { target: 'camera', key: 'camera' },
        { target: 'first-steps', key: 'firstSteps' },
      ],
    },
    { id: 'catch', screen: 'screen-confirm', requires: 'species', steps: [{ target: 'species', key: 'species' }] },
    { id: 'catch-done', screen: 'screen-confirm', requires: 'catch-reward', steps: [{ target: 'catch-reward', key: 'catchReward' }] },
    { id: 'owner', screen: 'screen-map', requires: 'treasury', steps: [{ target: 'treasury', key: 'treasuryOwner' }] },
    {
      id: 'sector',
      screen: 'screen-territory',
      requires: 'standing',
      steps: [
        { target: 'standing', key: 'standing' },
        { target: 'sector-forecast', key: 'sectorForecast' },
        { target: 'insights', key: 'insights' },
      ],
    },
    {
      id: 'profile',
      screen: 'screen-profile',
      requires: 'challenges',
      steps: [
        { target: 'challenges', key: 'challenges' },
        { target: 'shop', key: 'shop' },
        { target: 'clan', key: 'clan' },
        { target: 'faq', key: 'faq' },
      ],
    },
    { id: 'shop-slots', screen: 'screen-shop', requires: 'slots-card', steps: [{ target: 'slots-card', key: 'slots' }], always: true },
    MAP_REWARDS_TOUR,
    DIARY_STATS_TOUR,
    DIARY_TAB_TOUR,
  ],
}
