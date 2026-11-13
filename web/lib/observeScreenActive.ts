// Reports whether the <Screen> containing `el` is the visible one, now and
// whenever that changes (FishZoneApp toggles `.active` on the `.screen`
// element). Screens never unmount, so anything that draws on its own clock —
// a canvas rAF loop — has to stop itself here; CSS can pause a CSS animation
// on an inactive screen (see globals.css) but not a JS loop. An element
// outside every screen (a portalled modal) counts as always active.
export function observeScreenActive(el: Element, onChange: (active: boolean) => void): () => void {
  const screen = el.closest('.screen')
  if (!screen) {
    onChange(true)
    return () => {}
  }
  let last = screen.classList.contains('active')
  onChange(last)
  const observer = new MutationObserver(() => {
    const now = screen.classList.contains('active')
    if (now === last) return
    last = now
    onChange(now)
  })
  observer.observe(screen, { attributes: true, attributeFilter: ['class'] })
  return () => observer.disconnect()
}

// observeScreenActive for a background canvas that also lets go of its pixels while its screen is out of sight, like
// the pictures in lib/screenImagePark.ts: after RELEASE_AFTER_MS hidden the canvas is set to 0×0 (its CSS box, and so
// the layout, stays), and when the screen is shown again `refit` sizes and paints it before the next frame (the
// MutationObserver behind this runs before the page is drawn). A live profile or clan background at 2× is ~3 MB of
// graphics memory, and every profile on the stack (yours, the clan's, each player opened) kept one.
const RELEASE_AFTER_MS = 10_000

export function observeScreenActiveReleasing(canvas: HTMLCanvasElement, onChange: (active: boolean) => void, refit: () => void): () => void {
  let timer = 0
  let released = false
  const stop = observeScreenActive(canvas, (active) => {
    window.clearTimeout(timer)
    if (active) {
      if (released) {
        released = false
        refit()
      }
      onChange(true)
      return
    }
    onChange(false)
    timer = window.setTimeout(() => {
      released = true
      canvas.width = 0
      canvas.height = 0
    }, RELEASE_AFTER_MS)
  })
  return () => {
    window.clearTimeout(timer)
    stop()
  }
}
