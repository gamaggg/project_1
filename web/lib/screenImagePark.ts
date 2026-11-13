'use client'

// Screens out of sight let go of their pictures. iOS throws the app's page away without a word when it runs out of
// memory (lib/crashBeacon.ts: 42 times in a week at 13.11.2026, on 14 phones), and most of those pages held 140–280
// pictures: the tabs (feed, profile, clan) and the screens under the top one in the stack stay mounted
// (FishZoneApp Screen, KeptScreens) — their state and scroll must survive — so every thumbnail they ever showed
// stayed decoded. A screen that has been out of sight for PARK_AFTER_MS swaps each picture's address for an empty
// SVG of the same size (layout and scroll do not move, nothing is painted: the screen is visibility:hidden), and puts
// the addresses back the moment it is shown again, before the next frame; the browser's cache has the files.
// Nothing in React changes: the components keep their state and props, only the DOM attribute moves aside.

const PARK_AFTER_MS = 10_000
const ATTR = 'data-parked-src'
// The map is under every other screen and draws its own markers: left alone.
const KEEP = new Set(['screen-map'])

const placeholder = (w: number, h: number) => `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'/%3E`
const isPlaceholder = (src: string | null) => !!src && src.startsWith('data:image/svg+xml,%3Csvg')

function parkImage(img: HTMLImageElement) {
  if (img.hasAttribute(ATTR)) return
  const src = img.getAttribute('src')
  // Inline pictures cost nothing to keep; a photo just taken (blob:) is the app's own and short-lived.
  if (!src || src.startsWith('data:') || src.startsWith('blob:')) return
  // The same natural size, so a picture laid out by its own proportions keeps its box.
  const w = img.naturalWidth || img.width || 1
  const h = img.naturalHeight || img.height || 1
  img.setAttribute(ATTR, src)
  img.setAttribute('src', placeholder(w, h))
}

function restoreImage(img: HTMLImageElement) {
  const src = img.getAttribute(ATTR)
  if (src === null) return
  img.removeAttribute(ATTR)
  // A component may have given it a new picture meanwhile: that one stays.
  if (isPlaceholder(img.getAttribute('src'))) img.setAttribute('src', src)
}

let installed = false

export function installScreenImagePark(): () => void {
  if (installed || typeof window === 'undefined') return () => {}
  installed = true
  const timers = new Map<Element, number>()
  const parked = new Set<Element>()

  const park = (screen: Element) => {
    timers.delete(screen)
    if (screen.classList.contains('active') || !screen.isConnected) return
    parked.add(screen)
    screen.querySelectorAll('img').forEach(parkImage)
  }
  const wake = (screen: Element) => {
    window.clearTimeout(timers.get(screen))
    timers.delete(screen)
    if (!parked.delete(screen)) return
    screen.querySelectorAll<HTMLImageElement>(`img[${ATTR}]`).forEach(restoreImage)
  }
  const check = (screen: Element) => {
    if (KEEP.has(screen.id)) return
    if (screen.classList.contains('active')) wake(screen)
    else if (!parked.has(screen) && !timers.has(screen)) timers.set(screen, window.setTimeout(() => park(screen), PARK_AFTER_MS))
  }
  const parkedScreenOf = (el: Element) => {
    const screen = el.closest('.screen')
    return screen && parked.has(screen) ? screen : null
  }

  document.querySelectorAll('.screen').forEach(check)
  const observer = new MutationObserver((records) => {
    for (const r of records) {
      const target = r.target as Element
      if (r.type === 'attributes') {
        if (r.attributeName === 'class') {
          if (target.classList.contains('screen')) check(target)
        } else if (target instanceof HTMLImageElement && !isPlaceholder(target.getAttribute('src')) && parkedScreenOf(target)) {
          // A component gave a parked picture a new address: that one is parked too.
          target.removeAttribute(ATTR)
          parkImage(target)
        }
        continue
      }
      for (const node of r.addedNodes) {
        if (!(node instanceof Element)) continue
        // Screens arrive once the app is on the page; pictures arrive in screens already parked.
        if (node.matches('.screen')) check(node)
        node.querySelectorAll('.screen').forEach(check)
        if (parked.size && parkedScreenOf(node)) {
          if (node instanceof HTMLImageElement) parkImage(node)
          node.querySelectorAll('img').forEach(parkImage)
        }
      }
    }
  })
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'src'] })
  return () => {
    observer.disconnect()
    timers.forEach((t) => window.clearTimeout(t))
    parked.forEach(wake)
    installed = false
  }
}
