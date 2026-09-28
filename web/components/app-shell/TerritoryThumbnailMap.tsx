'use client'

import 'leaflet/dist/leaflet.css'
import { thumbUrl } from '@/lib/supabase/imageUrl'
import { useEffect, useRef, useState } from 'react'
import type { Territory } from '@/lib/data/types'
import { resolveTerritoryColor, OTHER_TERRITORY_COLOR } from '@/lib/data/territoryColors'
import { previewTileUrl } from '@/lib/mapbox/rasterTiles'
import { splitSector } from '@/lib/map/sectorParts'

// A static, single-sector preview for TerritoryScreen — not the interactive
// multi-sector LeafletMap. The number/avatar overlay is plain HTML, not a
// Leaflet marker/pane: this session already hit a Leaflet-pane z-index/
// compositing bug with screenshot-tested overlays, and since this map is
// always fit to exactly one polygon, a CSS-centered div is simpler and safe.
export function TerritoryThumbnailMap({
  territory,
  myTerritoryColor,
  ownerAvatarUrl,
  ownerInitials,
}: {
  territory: Territory
  myTerritoryColor: string
  ownerAvatarUrl?: string | null
  ownerInitials?: string | null
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('leaflet').Map | null>(null)
  // Shared by clan-mates: the hex is cut into one part per holder (see
  // lib/map/sectorParts.ts), and each holder's avatar sits in their part —
  // as a pixel offset from the map's center, which is the sector's center
  // (fitBounds below) and stays put when the box resizes.
  const holders = territory.ownerId
    ? [
        { id: territory.ownerId, avatarUrl: ownerAvatarUrl ?? null, initials: ownerInitials ?? '', isMe: territory.status === 'mine' },
        ...territory.coHolders.map((h) => ({ id: h.id, avatarUrl: h.avatarUrl, initials: (h.displayName ?? 'Рыбак').slice(0, 2).toUpperCase(), isMe: h.isMe })),
      ]
    : []
  const shared = holders.length > 1
  const holdersKey = holders.map((h) => `${h.id}:${h.isMe}`).join(',')
  const [partOffsets, setPartOffsets] = useState<{ key: string; offsets: { x: number; y: number }[] } | null>(null)

  useEffect(() => {
    let cancelled = false
    import('leaflet').then((LModule) => {
      if (cancelled || !containerRef.current) return
      const L = (LModule as unknown as { default?: typeof LModule }).default ?? LModule
      const map = L.map(containerRef.current, {
        dragging: false,
        scrollWheelZoom: false,
        touchZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        zoomControl: false,
        attributionControl: false,
        preferCanvas: true,
      })
      mapRef.current = map
      L.tileLayer(previewTileUrl(), { tileSize: 256 }).addTo(map)
      const color = resolveTerritoryColor(territory.status, myTerritoryColor)
      const fillOpacity = territory.status === 'free' ? 0.22 : 0.32
      const split = shared ? splitSector(territory.corners, holders.length) : null
      split?.parts.forEach((part, i) => {
        L.polygon(part, {
          stroke: false,
          fillColor: i === 0 ? color : holders[i].isMe ? myTerritoryColor : OTHER_TERRITORY_COLOR,
          fillOpacity,
          interactive: false,
        }).addTo(map)
      })
      const poly = L.polygon(territory.corners, {
        color,
        weight: 1.5,
        fillColor: color,
        fillOpacity: split ? 0 : fillOpacity,
        opacity: 0.9,
      }).addTo(map)
      if (split) {
        L.polyline(
          split.cuts.map((cut) => [split.center, cut]),
          { color: '#FFFFFF', weight: 2, opacity: 0.95, interactive: false }
        ).addTo(map)
      }
      map.fitBounds(poly.getBounds(), { padding: [10, 10] })
      if (split) {
        const middle = map.latLngToContainerPoint(split.center)
        setPartOffsets({
          key: holdersKey,
          offsets: split.centroids.map((c) => {
            const p = map.latLngToContainerPoint(c)
            return { x: Math.round(p.x - middle.x), y: Math.round(p.y - middle.y) }
          }),
        })
      }
    })
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [territory.id, territory.status, holdersKey, myTerritoryColor])

  const offsets = shared && partOffsets?.key === holdersKey ? partOffsets.offsets : null

  return (
    <div className="territory-thumb-wrap">
      <div className="territory-thumb-map" ref={containerRef} />
      <div className="territory-thumb-overlay">
        {territory.ownerId && !shared && (
          <div className="territory-thumb-avatar">
            {ownerAvatarUrl ? <img src={thumbUrl(ownerAvatarUrl, 96)} alt="" decoding="async" /> : ownerInitials}
          </div>
        )}
        <div className="territory-thumb-label">{territory.id}</div>
      </div>
      {offsets &&
        holders.map((h, i) => (
          <div
            key={h.id}
            className="territory-thumb-avatar territory-thumb-part"
            style={{ left: `calc(50% + ${offsets[i].x}px)`, top: `calc(50% + ${offsets[i].y}px)` }}
          >
            {h.avatarUrl ? <img src={thumbUrl(h.avatarUrl, 96)} alt="" decoding="async" /> : h.initials}
          </div>
        ))}
    </div>
  )
}
