// Relative day label matching fishzone-app.html's demo strings ("Сегодня", "Вчера",
// "N дней назад") plus a time-of-day for same-day entries ("Сегодня · 07:45").
export function formatWhen(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate())
  const diffDays = Math.round((startOfDay(now).getTime() - startOfDay(d).getTime()) / 86_400_000)
  const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })

  if (diffDays <= 0) return `Сегодня · ${time}`
  if (diffDays === 1) return `Вчера · ${time}`
  if (diffDays < 7) return `${diffDays} дн. назад`
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

export function formatWeight(kg: number): string {
  return kg.toFixed(2).replace('.', ',')
}

// Size/weight are optional now (see DECISIONS.md — only species is required
// when logging a catch) — joins whichever of the two were given, or ''.
export function formatCatchMeta(lengthCm: number | null, weightKg: number | null): string {
  return [lengthCm ? `${lengthCm} см` : null, weightKg ? `${formatWeight(weightKg)} кг` : null].filter(Boolean).join(' · ')
}

// "9/2026" — numeric month/year an account was created (see ProfileScreen/
// UserProfileScreen "В RANGE с ..."). No month name, per spec.
export function formatJoinedDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getFullYear()}`
}

// "4:32" — minutes:seconds, no leading zero on minutes. Only used for the
// catch-cooldown modal (see confirm_catch's COOLDOWN: exception).
export function formatCooldown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
