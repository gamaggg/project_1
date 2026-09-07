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
