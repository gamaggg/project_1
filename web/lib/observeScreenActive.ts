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
