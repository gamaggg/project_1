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
  | 'geoCard'
  | 'geoPano'
  | 'geoGoal'
  | 'geoCta'
  | 'geoWindow'
  | 'geoHint'
  | 'geoQuest'
  | 'geoStory'
  | 'geoBoard'
  | 'language'
  | 'speciesStats'
  | 'challengesNew'
  | 'ownerColours'
  | 'weekPath'
  | 'challengeOpen'
  | 'chestTap'
  | 'chestMine'
  | 'editCatch'
  | 'photoZoom'
  | 'playersList'
  | 'warPill'
  | 'warCard'
  | 'warHow'
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

// 10.10: «Где это?», the daily panorama game. Its card on the profile is
// pointed out to everyone; then, once each, how to play: the screen before
// the answer, the map while picking (SpotlightTours is told 'screen-geo'
// then too), and the result with the day's quest. Marked `always` — it's
// how the game works, a player who skipped the tours still needs it.
const GEO_TOURS: Tour[] = [
  { id: 'geo-card', screen: 'screen-profile', requires: 'geo', steps: [{ target: 'geo', key: 'geoCard' }], always: true },
  {
    id: 'geo-intro',
    screen: 'screen-geo',
    requires: 'geo-cta',
    steps: [
      { target: 'geo-pano', key: 'geoPano' },
      { target: 'geo-goal', key: 'geoGoal' },
      { target: 'geo-cta', key: 'geoCta' },
    ],
    always: true,
  },
  {
    id: 'geo-pick',
    screen: 'screen-geo',
    requires: 'geo-window',
    steps: [
      { target: 'geo-window', key: 'geoWindow' },
      { target: 'geo-hint', key: 'geoHint' },
    ],
    always: true,
  },
  {
    id: 'geo-result',
    screen: 'screen-geo',
    requires: 'geo-quest',
    steps: [
      { target: 'geo-quest', key: 'geoQuest' },
      { target: 'geo-story', key: 'geoStory' },
      { target: 'geo-board', key: 'geoBoard' },
    ],
    always: true,
  },
]

// 16.10: the big update — the language switch, the species statistics, the
// unfolding challenges, the tappable chest, editing a catch later, the
// zoomable photo, the colours of owners on the map, the list of all players.
// Only for players who were here before (whatsNew); each tour on its screen,
// steps whose element this player doesn't have are left out (the language
// switch only exists once the translation is on).
const UPDATE_16_10_TOURS: Tour[] = [
  {
    id: 'u1610-map',
    screen: 'screen-map',
    requires: 'legend',
    steps: [{ target: 'legend', key: 'ownerColours' }],
    always: true,
  },
  {
    id: 'u1610-profile',
    screen: 'screen-profile',
    requires: 'species-stats',
    steps: [
      { target: 'species-stats', key: 'speciesStats' },
      { target: 'challenges', key: 'challengesNew' },
      { target: 'language', key: 'language' },
    ],
    always: true,
  },
  {
    id: 'u1610-challenges',
    screen: 'screen-challenges',
    requires: 'week-path',
    steps: [
      { target: 'week-path', key: 'weekPath' },
      { target: 'challenge-card', key: 'challengeOpen' },
    ],
    always: true,
  },
  {
    id: 'u1610-chest',
    screen: 'screen-clan',
    requires: 'chest-stops',
    steps: [
      { target: 'chest-stops', key: 'chestTap' },
      { target: 'chest-me', key: 'chestMine' },
    ],
    always: true,
  },
  {
    id: 'u1610-catch',
    screen: 'screen-catch-photo',
    requires: 'edit-catch',
    steps: [
      { target: 'photo-zoom', key: 'photoZoom' },
      { target: 'edit-catch', key: 'editCatch' },
    ],
    always: true,
  },
  { id: 'u1610-players', screen: 'screen-territories', requires: 'players-list', steps: [{ target: 'players-list', key: 'playersList' }], always: true },
]

// 19.10: the clan battle by sign-up. The map plaque of a clan member says whether
// the battle is open; on the battle screen (or the clan's «Битва кланов» tab,
// whichever the player reaches first) the card where the leader opens it and
// the «How the battle goes» block. Only players in a clan have these elements;
// the clan tab and the battle screen show the same two, so each tour is
// skipped once the other has been seen.
const UPDATE_19_10_TOURS: Tour[] = [
  { id: 'u1910-map', screen: 'screen-map', requires: 'race-pill', steps: [{ target: 'race-pill', key: 'warPill' }], always: true },
  {
    id: 'u1910-race',
    screen: 'screen-clan-race',
    requires: 'war-card',
    steps: [
      { target: 'war-card', key: 'warCard' },
      { target: 'race-how', key: 'warHow' },
    ],
    always: true,
    unlessSeen: 'u1910-clan',
  },
  {
    id: 'u1910-clan',
    screen: 'screen-clan',
    requires: 'war-card',
    steps: [
      { target: 'war-card', key: 'warCard' },
      { target: 'race-how', key: 'warHow' },
    ],
    always: true,
    unlessSeen: 'u1910-race',
  },
]

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
    ...GEO_TOURS,
    ...UPDATE_16_10_TOURS,
    ...UPDATE_19_10_TOURS,
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
    ...GEO_TOURS,
  ],
}
