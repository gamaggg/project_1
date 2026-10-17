'use client'

// Tells the stylesheet whether a sheet / modal / photo viewer is open, with one
// class on <html> (has-overlay / has-lightbox / has-modal) instead of the CSS asking
// `:has(...)` on <body> and on the app shell. Those selectors make the browser
// re-check, on every change anywhere in the page (and the map changes it all the
// time), whether such a layer exists below — Safari does that slowly on a big
// page. Here the page is looked at only when a layer is added or removed.
const OVERLAYS = '.screens .modal-overlay, .screens .comments-overlay, .screens .move-sheet-overlay'
const LIGHTBOX = '.screens .lightbox-overlay'
// Any sheet or modal anywhere on the page (the comments sheet and the app-level
// modals sit beside the screens, not in them): the animations under it stand still.
const MODAL = '.modal-overlay, .comments-overlay, .move-sheet-overlay'
const ANY = `${MODAL}, ${LIGHTBOX}`

function touches(nodes: NodeList): boolean {
  for (const n of nodes) {
    if (n.nodeType !== 1) continue
    const el = n as Element
    if (el.matches(ANY) || el.querySelector(ANY)) return true
  }
  return false
}

export function installOverlayWatch(): () => void {
  const root = document.documentElement
  const sync = () => {
    root.classList.toggle('has-overlay', !!document.querySelector(OVERLAYS))
    root.classList.toggle('has-lightbox', !!document.querySelector(LIGHTBOX))
    root.classList.toggle('has-modal', !!document.querySelector(MODAL))
  }
  sync()
  const observer = new MutationObserver((records) => {
    for (const r of records) {
      if (touches(r.addedNodes) || touches(r.removedNodes)) {
        sync()
        return
      }
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })
  return () => {
    observer.disconnect()
    root.classList.remove('has-overlay', 'has-lightbox', 'has-modal')
  }
}
