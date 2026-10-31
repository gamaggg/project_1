'use client'

import 'leaflet/dist/leaflet.css'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useEffect, useRef } from 'react'
import type L from 'leaflet'
import { PARTNERS_MAP, SHOP_POS } from '@/lib/data/partnersMapData'
import { TERRITORY_COLORS, FREE_TERRITORY_COLOR } from '@/lib/data/territoryColors'
import { applyCurrentLightPreset } from '@/lib/mapbox/lightPreset'
import type { PartnerCity } from '@/lib/data/partners.shared'

// The demo map is the game's own: the same Leaflet map over the same Mapbox style, the same
// hexagon sectors (their real shapes), drawn the same way (outline 1.5, fill 0.32 / free 0.22).
// Only the owners are made up. It is built when it scrolls into view, so the page itself
// stays light and the map is not loaded for visitors who never reach it.
const MAPBOX_STYLE_URL = process.env.NEXT_PUBLIC_MAPBOX_STYLE!
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

const NAMES = ['Nika', 'Alex', 'Gio', 'Mari', 'Dato', 'Luka', 'Sandro', 'Ilya', 'Max', 'Oleg', 'Tina', 'Vlad']
const OWNER_COLORS = TERRITORY_COLORS.map((c) => c.hex)

// The bridge between Leaflet and Mapbox GL needs the same guard the game uses (zoom end on a removed map).
type BridgeProto = {
  _map: L.Map | null
  _glMap: { _actualCanvas: HTMLElement; once: (ev: string, fn: () => void) => void; jumpTo: (o: { center: L.LatLng; zoom: number }) => void } | null
  _zoomEnd: () => void
  _transitionEnd: (e?: unknown) => void
  __rangeGuarded?: boolean
}
function guardMapboxBridge(Lf: typeof L) {
  const proto = (Lf as unknown as { MapboxGL?: { prototype: BridgeProto } }).MapboxGL?.prototype
  if (!proto || proto.__rangeGuarded) return
  proto.__rangeGuarded = true
  const zoomEnd = proto._zoomEnd
  proto._zoomEnd = function (this: BridgeProto) {
    if (!this._map || !this._glMap) return
    zoomEnd.call(this)
  }
  proto._transitionEnd = function (this: BridgeProto) {
    Lf.Util.requestAnimFrame(() => {
      const map = this._map
      const gl = this._glMap
      if (!map || !gl) return
      const zoom = map.getZoom()
      const center = map.getCenter()
      const offset = map.latLngToContainerPoint(map.getBounds().getNorthWest())
      Lf.DomUtil.setTransform(gl._actualCanvas, offset, 1)
      gl.once('moveend', () => this._zoomEnd())
      gl.jumpTo({ center, zoom: zoom - 1 })
    }, this)
  }
}

// The shop is a pin (not a sector): sectors are hexagons, the shop stands on the map as a mark.
const STORE_SVG =
  '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5 5.5 4.5h13L20 9.5"/><path d="M4 9.5a2.67 2.67 0 0 0 5.33 0 2.67 2.67 0 0 0 5.34 0 2.67 2.67 0 0 0 5.33 0"/><path d="M5.5 12v7.5h13V12"/><path d="M10 19.5v-4.5h4v4.5"/></svg>'
const CROWN_SVG =
  '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M4 18 3 8l5 4 4-7 4 7 5-4-1 10z" fill="#fff"/></svg>'

function shopHtml(name: string, discount: string, promo: boolean, week: boolean, opened: boolean, fresh = false) {
  return (
    `<div class="pt-mk${opened ? ' pt-mk-open' : ''}${fresh ? ' pt-mk-fresh' : ''}">` +
    '<span class="pt-mk-ring"></span><span class="pt-mk-ring pt-mk-ring2"></span>' +
    `<div class="pt-mk-pin">${STORE_SVG}</div>` +
    (promo ? `<span class="pt-mk-badge pt-mk-promo">${discount}</span>` : '') +
    (week ? `<span class="pt-mk-badge pt-mk-week">${CROWN_SVG}</span>` : '') +
    `<span class="pt-mk-name">${name}</span>` +
    '</div>'
  )
}

type Props = { city: PartnerCity; shopName: string; discount: string; promo: boolean; week: boolean; opened: boolean; onOpen: () => void }

export function PartnersMap({ city, shopName, discount, promo, week, opened, onOpen }: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const leafletRef = useRef<typeof L | null>(null)
  const onOpenRef = useRef(onOpen)
  onOpenRef.current = onOpen
  const latest = useRef({ shopName, discount, promo, week, opened })
  latest.current = { shopName, discount, promo, week, opened }

  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    let cancelled = false
    let map: L.Map | null = null

    const build = () => {
      Promise.all([import('leaflet'), import('mapbox-gl-leaflet')]).then(([LModule]) => {
        if (cancelled || !box || map) return
        const Lf = (LModule as unknown as { default?: typeof L }).default ?? (LModule as unknown as typeof L)
        leafletRef.current = Lf
        guardMapboxBridge(Lf)
        const data = PARTNERS_MAP[city]

        map = Lf.map(box, {
          zoomControl: false,
          attributionControl: false,
          preferCanvas: true,
          renderer: Lf.canvas({ padding: 0.3 }),
          minZoom: data.zoom - 1,
          maxZoom: data.zoom + 2,
          maxBounds: Lf.latLngBounds([data.center[0] - 0.06, data.center[1] - 0.09], [data.center[0] + 0.06, data.center[1] + 0.09]),
          maxBoundsViscosity: 0.9,
          scrollWheelZoom: false,
        })

        const glLayer = Lf.mapboxGL({ style: MAPBOX_STYLE_URL, accessToken: MAPBOX_TOKEN } as Parameters<typeof Lf.mapboxGL>[0])
        glLayer.addTo(map)
        Lf.control
          .attribution({ prefix: false })
          .addAttribution('© <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noopener">Mapbox</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>')
          .addTo(map)
        Lf.control.zoom({ position: 'bottomright' }).addTo(map)
        map.setView(data.center, data.zoom)
        const gl = (glLayer as unknown as { getMapboxMap: () => import('mapbox-gl').Map }).getMapboxMap()
        gl.once('load', () => applyCurrentLightPreset(gl))

        const markers = Lf.layerGroup().addTo(map)
        data.sectors.forEach((t, i) => {
          const owned = (i * 7 + 3) % 5 < 3
          const color = owned ? OWNER_COLORS[(i * 5) % OWNER_COLORS.length] : FREE_TERRITORY_COLOR
          Lf.polygon(t.corners, { color, weight: 1.5, opacity: 0.9, fillColor: color, fillOpacity: owned ? 0.32 : 0.22, interactive: false }).addTo(markers)
          const label = `<div class="leaflet-territory-label">${t.id}</div>`
          const avatar = owned ? `<div class="leaflet-territory-avatar">${NAMES[i % NAMES.length].slice(0, 2).toUpperCase()}</div>` : ''
          Lf.marker([t.lat, t.lng], {
            icon: Lf.divIcon({
              className: 'leaflet-territory-marker-wrap',
              html: `<div class="leaflet-territory-marker">${avatar}${label}</div>`,
              iconSize: owned ? [40, 40] : [40, 18],
            }),
            interactive: false,
          }).addTo(markers)
        })

        const s = latest.current
        const shop = Lf.marker(SHOP_POS[city], {
          icon: Lf.divIcon({ className: 'pt-mk-wrap', html: shopHtml(s.shopName, s.discount, s.promo, s.week, s.opened, true), iconSize: [72, 92], iconAnchor: [36, 62] }),
          zIndexOffset: 1000,
          keyboard: true,
        }).addTo(map)
        shop.on('click', () => onOpenRef.current())
        markerRef.current = shop
      })
    }

    // Build the map only when it is about to be seen.
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect()
          build()
        }
      },
      { rootMargin: '200px' }
    )
    io.observe(box)

    return () => {
      cancelled = true
      io.disconnect()
      markerRef.current = null
      map?.remove()
      map = null
    }
  }, [city])

  // The pin follows the switches: badges for the promo code and the weekly catch, calm once opened.
  useEffect(() => {
    const Lf = leafletRef.current
    const marker = markerRef.current
    if (!Lf || !marker) return
    marker.setIcon(Lf.divIcon({ className: 'pt-mk-wrap', html: shopHtml(shopName, discount, promo, week, opened), iconSize: [72, 92], iconAnchor: [36, 62] }))
  }, [shopName, discount, promo, week, opened])

  return <div ref={boxRef} className="pt-leaflet" />
}
