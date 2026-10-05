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
export type TourStep = { target: string; key: TourKey }
export type Tour = { id: string; screen: string; requires: string; steps: TourStep[] }
export type TourAudience = 'whatsNew' | 'newcomer'

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
      ],
    },
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
  ],
}
