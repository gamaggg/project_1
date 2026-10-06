import type { CityId } from '@/lib/data/city'
import type { SlotSymbol as SymbolId } from '@/lib/supabase/queries'

// Reel art for the «Слоты» tab — the designer's 256px PNGs trimmed to the
// drawing and saved as WebP in public/slots (~12 KB each). The server rolls
// the same six symbols in both cities; Moscow just shows its own river fish
// on the four fish symbols, tier for tier: the two common fish, the 100-coin
// predator and the jackpot giant.
type Fish = Exclude<SymbolId, 'hook' | 'hex'>
const FISH: Record<CityId, Record<Fish, string>> = {
  batumi: { stavrida: 'stavrida', skorpena: 'skorpena', lufar: 'lufar', katran: 'katran' },
  moscow: { stavrida: 'okun', skorpena: 'leshch', lufar: 'shchuka', katran: 'som' },
}

export function slotSymbolSrc(symbol: SymbolId, city: CityId) {
  return `/slots/${symbol === 'hook' || symbol === 'hex' ? symbol : FISH[city][symbol]}.webp`
}

// Every symbol is fitted into the same 3:2 box (`size` is its height): the
// long fish fill its width, the hook and the hex its height — so a fish and
// the hex weigh about the same on a reel instead of the fish looking tiny.
// The solid hex still reads heavier than a fish at full height, so it's
// drawn a little smaller inside the same box.
export function SlotSymbol({ symbol, city, size }: { symbol: SymbolId; city: CityId; size: number }) {
  const width = Math.round(size * 1.5)
  return (
    // eslint-disable-next-line @next/next/no-img-element -- dozens of copies spin in the reels; next/image's wrapper and srcset would only slow them
    <img
      className={`slot-symbol${symbol === 'hex' ? ' slot-symbol-hex' : ''}`}
      src={slotSymbolSrc(symbol, city)}
      width={width}
      height={size}
      style={{ width, height: size }}
      alt=""
      draggable={false}
    />
  )
}
