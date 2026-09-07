import type { Catch, Territory } from '@/lib/data/types'

export type Achievement = {
  icon: 'first' | 'territory' | 'species' | 'sunrise' | 'record' | 'ten'
  title: string
  desc: string
  unlocked: boolean
  progress?: string
}

// Ported from fishzone-app.html computeAchievements() — real milestones computed
// fresh from current state every time, not stored "unlocked" flags/game points.
export function computeAchievements(myCatches: Catch[], myTerritories: Territory[]): Achievement[] {
  const speciesCount = new Set(myCatches.map((c) => c.species)).size
  const record = personalRecord(myCatches)
  const earlyCatch = myCatches.some((c) => new Date(c.caughtAt).getHours() < 8)

  return [
    { icon: 'first', title: 'Первый улов', desc: 'Зафиксирован первый улов в приложении', unlocked: myCatches.length >= 1 },
    { icon: 'territory', title: 'Три территории', desc: 'Заняты три береговые территории', unlocked: myTerritories.length >= 3, progress: `${myTerritories.length}/3` },
    { icon: 'species', title: 'Коллекционер видов', desc: 'Пойманы все виды рыб Чёрного моря', unlocked: speciesCount >= 3, progress: `${speciesCount}/3` },
    { icon: 'sunrise', title: 'Ранний рыбак', desc: 'Улов зафиксирован до 8 утра', unlocked: earlyCatch },
    { icon: 'record', title: 'Личный рекорд 40 см', desc: 'Поймана рыба длиной от 40 см', unlocked: !!(record && record.lengthCm >= 40) },
    { icon: 'ten', title: 'Десять уловов', desc: 'Зафиксировано десять уловов', unlocked: myCatches.length >= 10, progress: `${Math.min(myCatches.length, 10)}/10` },
  ]
}

export function personalRecord(myCatches: Catch[]): Catch | null {
  if (!myCatches.length) return null
  return myCatches.reduce((a, b) => (b.lengthCm > a.lengthCm ? b : a))
}
