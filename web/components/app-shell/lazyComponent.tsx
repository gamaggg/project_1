'use client'

import { lazy, Suspense, useState, type ComponentType, type ReactNode } from 'react'

const RETRY_DELAYS_MS = [800, 2000]

// A chunk request can fail on a flaky mobile connection — retried a couple of
// times before giving up, instead of the first miss sticking for the session.
async function loadWithRetry<T>(load: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await load()
    } catch (error) {
      if (attempt >= RETRY_DELAYS_MS.length) throw error
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]))
    }
  }
}

function LoadFailed() {
  return (
    <div className="lazy-failed">
      <div>Не удалось загрузить экран — проверь интернет.</div>
      <button type="button" className="btn-secondary" onClick={() => window.location.reload()}>
        Обновить
      </button>
    </div>
  )
}

// A component whose code sits in its own chunk instead of the startup bundle
// — for screens and modals most sessions never open (admin tools, the clan
// editor, weekly ceremonies). preload() fetches the chunk ahead of time;
// FishZoneApp calls it once the app is idle, so the first open normally
// finds the code already here and renders it directly, with no Suspense and
// no blank frame. An instance that mounted before the chunk arrived keeps its
// lazy wrapper for life, so the switch can never remount it and drop state.
export function lazyComponent<P extends object>(load: () => Promise<ComponentType<P>>, fallback: ReactNode = null) {
  let loaded: ComponentType<P> | null = null
  let pending: Promise<ComponentType<P>> | null = null

  function preload() {
    pending ??= loadWithRetry(load).then(
      (component) => (loaded = component),
      (error) => {
        // Not cached: the next preload() or open tries again.
        pending = null
        throw error
      },
    )
    return pending
  }

  const Lazy = lazy(() =>
    preload().then(
      (component) => ({ default: component }),
      // React.lazy remembers a rejection forever — resolve to a retry screen
      // instead so a dropped connection doesn't take the whole app down.
      () => ({ default: LoadFailed as ComponentType<P> }),
    ),
  )

  function LazyComponent(props: P) {
    const [Ready] = useState(() => loaded)
    if (Ready) return <Ready {...props} />
    return (
      <Suspense fallback={fallback}>
        <Lazy {...props} />
      </Suspense>
    )
  }

  return Object.assign(LazyComponent, { preload })
}
