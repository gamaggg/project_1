const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

// Plain raster tiles for the small preview maps (sector hero, colour picker),
// instead of the vector Mapbox GL layer the real map uses.
//
// Each mapbox-gl instance is its own WebGL context, and these previews live
// alongside the always-mounted main map — two contexts plus the app's DOM was
// enough for Telegram's iOS WebView to kill and reload the page when opening
// a sector. Raster tiles are just <img>s: no WebGL, no mapbox-gl bundle on
// these screens at all.
//
// Not our own Standard style: Standard (v3) is vector-only, and both its
// /tiles/ and /static/ endpoints answer 200 with a blank image (checked
// against the live style — a uniform two-colour PNG). The classic styles do
// render. Always the light one, day and night (owner, 02.11): the previews sit
// on the app's light screens and should blend into them, a dark map at night
// ended in a hard edge against the page.
export function previewTileUrl(): string {
  return `https://api.mapbox.com/styles/v1/mapbox/light-v11/tiles/256/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`
}
