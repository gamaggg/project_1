'use client'

import 'leaflet/dist/leaflet.css'
import { thumbUrl } from '@/lib/supabase/imageUrl'
import { useEffect, useRef, useState } from 'react'
import type { Territory } from '@/lib/data/types'
import { resolveTerritoryColor, OTHER_TERRITORY_COLOR } from '@/lib/data/territoryColors'
import { previewTileUrl } from '@/lib/mapbox/rasterTiles'
import { splitSector } from '@/lib/map/sectorParts'
import { useSkinAssetsVersion, useSkinPatterns } from '@/lib/map/skinPattern'
import { isAnimatedSkin } from '@/lib/map/animatedSkins'
import { createAnimatedSkinLayer, type AnimatedSkinEntry } from '@/lib/map/animatedSkinLayer'
import { tn } from '@/lib/i18n/runtime'

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
  claimFx = false,
}: {
  territory: Territory
  myTerritoryColor: string
  ownerAvatarUrl?: string | null
  ownerInitials?: string | null
  // The sector screen's arrival: the map settles in from a little closer
  // while the hex's outline is drawn round in its colour and its fill
  // flashes once — the same "claimed" beat the map plays on a capture.
  claimFx?: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('leaflet').Map | null>(null)
  // The holders' equipped skins, as on the big map (LeafletMap.tsx): each fill, so a skin that
  // finishes loading after the map was built can be put in (skinAssetsVersion below).
  const fillsRef = useRef<{ layer: import('leaflet').Polygon; skin: string | null; color: string; opacity: number; clip: [number, number][] }[]>([])
  const animatedSkinsRef = useRef<ReturnType<typeof createAnimatedSkinLayer> | null>(null)
  const getSkinPattern = useSkinPatterns()
  const skinAssetsVersion = useSkinAssetsVersion()
  // Shared by clan-mates: the hex is cut into one part per holder (see
  // lib/map/sectorParts.ts), and each holder's avatar sits in their part —
  // as a pixel offset from the map's center, which is the sector's center
  // (fitBounds below) and stays put when the box resizes.
  const holders = territory.ownerId
    ? [
        { id: territory.ownerId, avatarUrl: ownerAvatarUrl ?? null, initials: ownerInitials ?? '', isMe: territory.status === 'mine', color: territory.ownerColor, skin: territory.ownerEquippedSkin },
        ...territory.coHolders.map((h) => ({ id: h.id, avatarUrl: h.avatarUrl, initials: (h.displayName ?? tn('common.angler')).slice(0, 2).toUpperCase(), isMe: h.isMe, color: h.color, skin: h.equippedSkin })),
      ]
    : []
  const shared = holders.length > 1
  const holdersKey = holders.map((h) => `${h.id}:${h.isMe}:${h.color ?? ''}:${h.skin ?? ''}`).join(',')
  const [partOffsets, setPartOffsets] = useState<{ key: string; offsets: { x: number; y: number }[] } | null>(null)
  // The hex's corners in the container's pixels, for the claimFx outline.
  const [claim, setClaim] = useState<{ id: string; points: string; color: string } | null>(null)

  // A skin's fill for one polygon: a pattern laid on the whole hex's box (so each part of a shared sector shows its
  // own slice of its holder's skin), or null — no skin, an animated one (painted over the tint by the overlay), or
  // its picture not loaded yet.
  function skinFill(skin: string | null, color: string) {
    const map = mapRef.current
    if (!skin || territory.status === 'free' || isAnimatedSkin(skin) || !map) return null
    const pts = territory.corners.map((c) => map.latLngToLayerPoint(c))
    const xs = pts.map((p) => p.x)
    const ys = pts.map((p) => p.y)
    const x = Math.min(...xs)
    const y = Math.min(...ys)
    return getSkinPattern(skin, color, x, y, Math.max(...ys) - y, Math.max(...xs) - x)
  }
  function paintSkins() {
    const animated: AnimatedSkinEntry[] = []
    for (const f of fillsRef.current) {
      const pattern = skinFill(f.skin, f.color)
      // A CanvasPattern is a legal fillStyle next to a colour string; Leaflet's types just don't know it. It carries its own tint (skinPattern.ts).
      f.layer.setStyle({ fillColor: (pattern ?? f.color) as unknown as string, fillOpacity: pattern ? 1 : f.opacity })
      if (f.skin && territory.status !== 'free' && isAnimatedSkin(f.skin)) animated.push({ skinId: f.skin, color: f.color, tile: territory.corners, clip: f.clip })
    }
    animatedSkinsRef.current?.set(animated)
  }

  useEffect(() => {
    let cancelled = false
    let claimTimer = 0
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
      const tiles = L.tileLayer(previewTileUrl(), { tileSize: 256 }).addTo(map)
      // The view first: a skin pattern is placed in the map's layer pixels, which only exist once it is set.
      map.fitBounds(L.latLngBounds(territory.corners), { padding: [10, 10] })
      animatedSkinsRef.current = createAnimatedSkinLayer(L, map)
      const color = resolveTerritoryColor(territory.status, myTerritoryColor, territory.ownerColor)
      const fillOpacity = territory.status === 'free' ? 0.22 : 0.32
      const split = shared ? splitSector(territory.corners, holders.length) : null
      const fills: typeof fillsRef.current = []
      split?.parts.forEach((part, i) => {
        const partColor = i === 0 ? color : holders[i].isMe ? myTerritoryColor : (holders[i].color ?? OTHER_TERRITORY_COLOR)
        const layer = L.polygon(part, { stroke: false, fillColor: partColor, fillOpacity, interactive: false }).addTo(map)
        fills.push({ layer, skin: holders[i].skin, color: partColor, opacity: fillOpacity, clip: part })
      })
      const poly = L.polygon(territory.corners, {
        color,
        weight: 1.5,
        fillColor: color,
        fillOpacity: split ? 0 : fillOpacity,
        opacity: 0.9,
      }).addTo(map)
      if (!split) fills.push({ layer: poly, skin: holders[0]?.skin ?? null, color, opacity: fillOpacity, clip: territory.corners })
      fillsRef.current = fills
      paintSkins()
      if (split) {
        L.polyline(
          split.cuts.map((cut) => [split.center, cut]),
          { color: '#FFFFFF', weight: 2, opacity: 0.95, interactive: false }
        ).addTo(map)
      }
      if (claimFx) {
        const next = {
          id: territory.id,
          points: territory.corners.map((c) => {
            const p = map.latLngToContainerPoint(c)
            return `${Math.round(p.x)},${Math.round(p.y)}`
          }).join(' '),
          color,
        }
        // Played once the map's tiles are in (on a slow network at most 2 s later), not over grey squares.
        const play = () => {
          window.clearTimeout(claimTimer)
          if (!cancelled) setClaim(next)
        }
        tiles.once('load', play)
        claimTimer = window.setTimeout(play, 2000)
      }
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
      window.clearTimeout(claimTimer)
      animatedSkinsRef.current?.destroy()
      animatedSkinsRef.current = null
      fillsRef.current = []
      mapRef.current?.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [territory.id, territory.status, holdersKey, myTerritoryColor])

  // A skin picture that finished loading after the map was built.
  useEffect(() => {
    paintSkins()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skinAssetsVersion])

  const offsets = shared && partOffsets?.key === holdersKey ? partOffsets.offsets : null

  const claimNow = claimFx && claim?.id === territory.id ? claim : null

  return (
    <div className={`territory-thumb-wrap${claimFx ? ' claim-fx' : ''}${claimNow ? ' go' : ''}`}>
      <div className="territory-thumb-map" ref={containerRef} />
      {claimNow && (
        <svg key={claimNow.id} className="territory-thumb-claim" aria-hidden style={{ '--claim': claimNow.color } as React.CSSProperties}>
          <polygon points={claimNow.points} pathLength={1} />
        </svg>
      )}
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
