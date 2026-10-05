// «Что нового» after the big update: a short tour per screen — the map
// first, then the sector screen and the profile the first time the player
// opens them. Each step dims the screen around one element marked with
// data-tour="<target>" and explains it (WhatsNewTour.tsx). A step whose
// element isn't on screen for this player (no sectors → no Казна chip) is
// left out. Once per tour, per device; «Пропустить» ends all of them.

export const WHATS_NEW_VERSION = '2026-10'

export type TourKey = 'treasury' | 'forecast' | 'recap' | 'camera' | 'standing' | 'sectorForecast' | 'insights' | 'shop' | 'diary'
export type TourStep = { target: string; key: TourKey }

export const WHATS_NEW_TOURS: Partial<Record<string, TourStep[]>> = {
  'screen-map': [
    { target: 'treasury', key: 'treasury' },
    { target: 'forecast', key: 'forecast' },
    { target: 'recap', key: 'recap' },
    { target: 'camera', key: 'camera' },
  ],
  'screen-territory': [
    { target: 'standing', key: 'standing' },
    { target: 'sector-forecast', key: 'sectorForecast' },
    { target: 'insights', key: 'insights' },
  ],
  'screen-profile': [
    { target: 'shop', key: 'shop' },
    { target: 'diary', key: 'diary' },
  ],
}
