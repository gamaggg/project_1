'use client'

import { useState } from 'react'
import { InsufficientCoinsModal } from '@/components/app-shell/InsufficientCoinsModal'
import { PurchaseConfirmModal } from '@/components/app-shell/PurchaseConfirmModal'

type Pending = { name: string; price: number; buy: () => void }

// Single place for the "can I afford it? / are you sure?" gate every buy
// button in the app needs (Shop, Challenges swap/extra-slot, sector shield).
// Replaces the old per-screen `buyOrWarn`, which skipped straight from tap
// to mutation with no confirmation step at all.
export function usePurchaseFlow(coins: number) {
  const [insufficientPrice, setInsufficientPrice] = useState<number | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)

  function request(price: number, name: string, buy: () => void) {
    if (coins < price) setInsufficientPrice(price)
    else setPending({ name, price, buy })
  }

  function confirm() {
    if (!pending) return
    pending.buy()
    setPending(null)
  }

  const modal = (
    <>
      {insufficientPrice !== null && (
        <InsufficientCoinsModal price={insufficientPrice} coins={coins} onClose={() => setInsufficientPrice(null)} />
      )}
      {pending && (
        <PurchaseConfirmModal name={pending.name} price={pending.price} coins={coins} onConfirm={confirm} onClose={() => setPending(null)} />
      )}
    </>
  )

  return { request, modal }
}
