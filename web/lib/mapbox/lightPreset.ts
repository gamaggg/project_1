import type { Map as MapboxMap } from 'mapbox-gl'

// Mapbox Standard's own 4 built-in lighting presets (color temperature,
// shadow direction/intensity, ambient light) — see LeafletMap.tsx for how
// it's applied. There's no "auto" mode built into Mapbox itself; picking a
// preset from the local hour is our own logic. Boundaries chosen after a
// live side-by-side comparison of all 4 on our actual style, not sunrise/
// sunset math.
export type MapLightPreset = 'dawn' | 'day' | 'dusk' | 'night'

export function lightPresetForHour(hour: number): MapLightPreset {
  if (hour >= 5 && hour < 8) return 'dawn'
  if (hour >= 8 && hour < 18) return 'day'
  if (hour >= 18 && hour < 20) return 'dusk'
  return 'night'
}

export function currentLightPreset(): MapLightPreset {
  return lightPresetForHour(new Date().getHours())
}

// mapboxgl-leaflet's getMapboxMap() isn't in its (community) type
// declarations even though the method exists at runtime — see the `.default`
// workaround note in LeafletMap.tsx's init effect for the same package.
export function applyCurrentLightPreset(mapboxMap: MapboxMap | null | undefined) {
  mapboxMap?.setConfigProperty('basemap', 'lightPreset', currentLightPreset())
}
