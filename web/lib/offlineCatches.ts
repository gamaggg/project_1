'use client'

import { createClient } from '@/lib/supabase/client'
import { uploadCatchPhoto } from '@/lib/supabase/storage'

// «Улов без сети»: a catch made with no connection waits on the phone —
// photo, place, the moment the photo was taken — and goes out by itself
// once there's a connection again, within a day. The server counts it at
// the photo's time; the sector only changes hands if nobody else has caught
// there since (confirm_catch's p_caught_at).

export type OfflineCatch = {
  id: string
  territoryId: string
  species: string
  lengthCm: number | null
  weightKg: number | null
  method: string | null
  bait: string | null
  caughtAt: string
  photo?: Blob
  photoUrl?: string
}

export type SyncResult =
  | { kind: 'sent'; item: OfflineCatch; late: boolean }
  | { kind: 'expired'; item: OfflineCatch }
  | { kind: 'rejected'; item: OfflineCatch; reason: string }

const DB = 'range-offline'
const STORE = 'catches'
const CHANGED = 'range:offline-catches'
const MAX_AGE_MS = 24 * 60 * 60 * 1000

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const req = run(t.objectStore(STORE))
    t.oncomplete = () => {
      db.close()
      resolve(req.result)
    }
    t.onerror = () => {
      db.close()
      reject(t.error)
    }
  })
}

function changed() {
  window.dispatchEvent(new Event(CHANGED))
}

export function onOfflineCatchesChanged(cb: () => void): () => void {
  window.addEventListener(CHANGED, cb)
  return () => window.removeEventListener(CHANGED, cb)
}

export async function addOfflineCatch(item: Omit<OfflineCatch, 'id'>): Promise<void> {
  await tx('readwrite', (s) => s.put({ ...item, id: crypto.randomUUID() }))
  changed()
}

export async function listOfflineCatches(): Promise<OfflineCatch[]> {
  try {
    const all = await tx<OfflineCatch[]>('readonly', (s) => s.getAll() as IDBRequest<OfflineCatch[]>)
    return all.sort((a, b) => (a.caughtAt < b.caughtAt ? -1 : 1))
  } catch {
    return []
  }
}

async function save(item: OfflineCatch) {
  await tx('readwrite', (s) => s.put(item))
}

async function remove(id: string) {
  await tx('readwrite', (s) => s.delete(id))
  changed()
}

// A request that never reached the server (no connection) — as opposed to
// the server saying no.
function isNetworkError(err: unknown): boolean {
  const msg = typeof err === 'object' && err !== null && 'message' in err ? String((err as { message: unknown }).message) : String(err)
  return /failed to fetch|networkerror|load failed|network request failed/i.test(msg)
}

let running = false

// Sends whatever is waiting, oldest first; stops at the first sign the
// connection is gone (the rest wait for the next try).
export async function syncOfflineCatches(userId: string, onResult: (r: SyncResult) => void): Promise<void> {
  if (running || typeof navigator === 'undefined' || !navigator.onLine) return
  running = true
  try {
    const supabase = createClient()
    for (const item of await listOfflineCatches()) {
      if (Date.now() - new Date(item.caughtAt).getTime() > MAX_AGE_MS) {
        await remove(item.id)
        onResult({ kind: 'expired', item })
        continue
      }
      if (!item.photoUrl) {
        if (!item.photo) {
          await remove(item.id)
          continue
        }
        try {
          item.photoUrl = await uploadCatchPhoto(userId, item.photo)
          delete item.photo
          await save(item)
        } catch {
          return
        }
      }
      const { data, error } = await supabase
        .rpc('confirm_catch', {
          p_territory_id: item.territoryId,
          p_species: item.species,
          p_photo_url: item.photoUrl,
          p_length_cm: item.lengthCm ?? undefined,
          p_weight_kg: item.weightKg ?? undefined,
          p_method: item.method ?? undefined,
          p_bait: item.bait ?? undefined,
          p_caught_at: item.caughtAt,
        })
        .single()
      if (error) {
        if (isNetworkError(error)) return
        // A server that doesn't know the photo-time parameter yet: keep it.
        if (/p_caught_at|function .* does not exist|schema cache/i.test(error.message)) return
        await remove(item.id)
        onResult({ kind: 'rejected', item, reason: error.message })
        continue
      }
      await remove(item.id)
      onResult({ kind: 'sent', item, late: !!(data as { late?: boolean } | null)?.late })
    }
  } finally {
    running = false
  }
}
