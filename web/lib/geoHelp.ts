// A tiny bus between the places that ask for the player's position (the «+» button, the
// «my location» button) or the camera (the catch camera) and the one GeoHelpModal mounted
// in the app shell: when the phone refuses access, the modal explains where to switch it on
// and offers a recheck.
export type HelpKind = 'geo' | 'camera'
type Listener = (kind: HelpKind, retry: (() => void) | null) => void

let listener: Listener | null = null

export function showGeoHelp(retry: () => void) {
  listener?.('geo', retry)
}

export function showCameraHelp(retry: () => void) {
  listener?.('camera', retry)
}

export function subscribeGeoHelp(l: Listener) {
  listener = l
  return () => {
    if (listener === l) listener = null
  }
}
