'use client'

import { useSyncExternalStore } from 'react'

// Small UI state shared between the real screens and the clan update layer:
// «place the headquarters» mode on the map, and requests to open the map.

// focus: the block (data-focus) the clan screen scrolls to once its tab is open; baseSel: the building the base opens on.
// tour: the clan tour asked for again («Пройти тур»).
export type LiveUi = { placing: boolean; toolsOpen: boolean; alertsOpen: boolean; hqSheet: boolean; confirmPlace: string | null; clanTab: string | null; mapClanLayer: boolean; hqGeo: HqGeo | null; focus: string | null; baseSel: string | null; tour: boolean }
// Where the clan's HQ sector really is: its centre and the width of its hexagon in degrees of longitude (the base screen lays the real map under itself).
export type HqGeo = { id: string; lat: number; lng: number; widthDeg: number }
let ui: LiveUi = { placing: false, toolsOpen: false, alertsOpen: false, hqSheet: false, confirmPlace: null, clanTab: null, mapClanLayer: false, hqGeo: null, focus: null, baseSel: null, tour: false }
const listeners = new Set<() => void>()

export const getLiveUi = () => ui
export function subscribeLiveUi(l: () => void): () => void {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}
export function setLiveUi(patch: Partial<LiveUi>) {
  ui = { ...ui, ...patch }
  listeners.forEach((l) => l())
}
export function useLiveUi(): LiveUi {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => ui,
    () => ui
  )
}

// «Show on the map»: the app shell opens the map and, if asked, flies to the sector.
export type MapRequest = { sectorId?: string; place?: boolean }
const mapListeners = new Set<(r: MapRequest) => void>()
export function onMapRequest(fn: (r: MapRequest) => void): () => void {
  mapListeners.add(fn)
  return () => {
    mapListeners.delete(fn)
  }
}
export function requestMap(r: MapRequest = {}) {
  if (r.place) setLiveUi({ placing: true })
  mapListeners.forEach((fn) => fn(r))
}
