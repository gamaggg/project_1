// Small drawing helpers for the clan screens' canvases (skin swatches, the
// preview map): a flat-top hexagon path in a w×h box, and a colour with alpha.

export function flatHexPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.beginPath()
  ctx.moveTo(x + w * 0.25, y)
  ctx.lineTo(x + w * 0.75, y)
  ctx.lineTo(x + w, y + h * 0.5)
  ctx.lineTo(x + w * 0.75, y + h)
  ctx.lineTo(x + w * 0.25, y + h)
  ctx.lineTo(x, y + h * 0.5)
  ctx.closePath()
}

export function tint(color: string, alpha: number): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color)
  if (!m) return color
  const hex = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1]
  return `rgba(${parseInt(hex.slice(0, 2), 16)},${parseInt(hex.slice(2, 4), 16)},${parseInt(hex.slice(4, 6), 16)},${alpha})`
}
