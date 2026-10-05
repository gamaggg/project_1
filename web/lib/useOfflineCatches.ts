'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { listOfflineCatches, onOfflineCatchesChanged, syncOfflineCatches, type SyncResult } from '@/lib/offlineCatches'

// Whether the phone thinks it's online (navigator.onLine + its events).
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

// The waiting offline catches: how many, and sending them — at launch, the
// moment the phone comes back online, and every minute while any wait.
export function useOfflineCatchQueue(userId: string | null, onResult: (r: SyncResult) => void) {
  const [count, setCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const online = useOnline()
  const resultRef = useRef(onResult)
  useEffect(() => {
    resultRef.current = onResult
  }, [onResult])

  const refresh = useCallback(() => {
    void listOfflineCatches().then((items) => setCount(items.length))
  }, [])

  const sync = useCallback(async () => {
    if (!userId) return
    setSyncing(true)
    try {
      await syncOfflineCatches(userId, (r) => resultRef.current(r))
    } finally {
      setSyncing(false)
      refresh()
    }
  }, [userId, refresh])

  useEffect(() => {
    refresh()
    return onOfflineCatchesChanged(refresh)
  }, [refresh])

  useEffect(() => {
    if (!online || !userId) return
    // Next tick, not inside the effect itself: sync() sets state.
    const id = window.setTimeout(() => void sync(), 0)
    return () => window.clearTimeout(id)
  }, [online, userId, sync])

  useEffect(() => {
    if (!count || !userId) return
    const id = window.setInterval(() => void sync(), 60_000)
    return () => window.clearInterval(id)
  }, [count, userId, sync])

  return { count, syncing: syncing && count > 0 }
}
