// The hot-sector flame — Material Symbols "local_fire_department"
// (Google, Apache License 2.0). One mark everywhere: inside the sector's id
// label on the map, the badge at low zoom, the carousel card, the sector
// screen.
export const HOT_FLAME_PATH =
  'M12 23q-3.35 0-5.675-2.325T4 15q0-2.825 1.675-5.425T10.25 5.025q.675-.4 1.213-.05T12 6v1.3q0 .85.588 1.425T14.025 9.3q.425 0 .8-.187t.675-.538q.2-.25.512-.288t.588.163Q18.15 9.65 19.075 11.4T20 15q0 3.35-2.325 5.675T12 23Zm-6-8q0 1.3.525 2.463T8.05 19.5q-.05-.125-.05-.225V19.05q0-.8.3-1.5t.875-1.275L12 13.5l2.825 2.775q.575.575.875 1.275t.3 1.5v.225q0 .1-.05.225q1-.875 1.525-2.037T18 15q0-1.25-.462-2.363T16.2 10.65q-.5.325-1.05.488t-1.125.162q-1.55 0-2.688-1.025T10.026 7.75Q8.075 9.4 7.037 11.263T6 15Zm6 1.3l-1.425 1.4q-.275.275-.425.625t-.15.725q0 .8.588 1.375T12 21q.825 0 1.413-.575T14 19.05q0-.4-.15-.737t-.425-.613L12 16.3Z'

// The viewBox is cropped to the flame itself (x 4–20, y 5–23 of the 24-unit
// icon), so the drawing's centre is the box's centre and the mark lines up
// with text and badges instead of riding low. `size` is the height.
export function hotFlameSvg(size: number, color: string): string {
  const width = Math.round(size * (16.2 / 18.3) * 10) / 10
  return `<svg width="${width}" height="${size}" viewBox="3.9 4.85 16.2 18.3" aria-hidden="true"><path fill="${color}" d="${HOT_FLAME_PATH}"/></svg>`
}

export const HOT_FLAME_SVG = hotFlameSvg(13, '#FC5200')
