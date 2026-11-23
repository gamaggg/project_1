import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { partnerStatDays, dayInTz, type PartnerStatDay } from '@/lib/data/partnerPoints'

// The partner point's statistics as an A4 PDF (app/api/partner-stats-pdf): the same numbers and words as the
// statistics screen (components/app-shell/PartnerStatsView.tsx), drawn in the app's look — white paper, the orange
// RANGE logo, Oswald for the name, Manrope for the rest, rounded cards with the same colours. Page 1: the people,
// the way to the shop, all taps, the chart by day. Then the table by day with the totals and how we count.
// Real text (selectable, searchable), not a picture. Server only.

export type PdfStats = {
  people: number
  totals: Record<string, { count: number; people: number } | undefined>
  funnel: { opened: number; copied: number; copied_then_route: number; copied_then_call: number; copied_then_site: number; copied_then_any: number }
  days: PartnerStatDay[]
  tz: string
}

export type PdfPoint = { name: string; cityName: string; address: string | null; promoCode: string | null; promoDiscount: string | null }

export type PdfInput = {
  point: PdfPoint
  stats: PdfStats
  from: string
  to: string
  periodLabel: string
  fonts: { regular: ArrayBuffer; bold: ArrayBuffer; black: ArrayBuffer; display: ArrayBuffer }
  logoPaths: string[]
  logoViewBox: [number, number]
}

const W = 595.28
const H = 841.89
const M = 40
const CW = W - 2 * M

const hex = (h: string): RGB => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255)
const C = {
  ink: hex('#17181B'),
  soft: hex('#6B6D76'),
  faint: hex('#A8A9AE'),
  accent: hex('#FC5200'),
  accent2: hex('#FF6A1F'),
  heroBg: hex('#FFE7D9'),
  heroLine: hex('#FFCDB1'),
  line: hex('#E2DFD8'),
  track: hex('#F1EFEA'),
  paper: hex('#FAF9F6'),
  yellow: hex('#F5B301'),
  green: hex('#2FA84F'),
  red: hex('#E5322D'),
  white: rgb(1, 1, 1),
}

const KINDS: { id: string; label: string; hint: string }[] = [
  { id: 'pin', label: 'Нажали на метку', hint: 'на карте' },
  { id: 'open', label: 'Открыли карточку', hint: 'с карты или из рейтинга' },
  { id: 'copy_promo', label: 'Скопировали промокод', hint: '«Скопировать промокод»' },
  { id: 'route', label: 'Построили маршрут', hint: 'кнопка «Маршрут»' },
  { id: 'call', label: 'Позвонили', hint: 'кнопка «Позвонить»' },
  { id: 'site', label: 'Перешли на сайт', hint: 'кнопка «Сайт»' },
  { id: 'copy_address', label: 'Скопировали адрес', hint: 'кнопка «Скопировать»' },
  { id: 'photo', label: 'Смотрели фото', hint: 'на весь экран' },
]

const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10
  const m100 = n % 100
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? few : many
}
const people = (n: number) => `${n} ${plural(n, 'человек', 'человека', 'человек')}`
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : '—')
const MONTHS = ['янв.', 'февр.', 'марта', 'апр.', 'мая', 'июня', 'июля', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.']
const dayLabel = (d: string, year = false) => `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]}${year ? ` ${d.slice(0, 4)}` : ''}`

// Drawing in top-down coordinates (y from the top of the page), as a layout is thought of.
type Fonts = { regular: PDFFont; bold: PDFFont; black: PDFFont; display: PDFFont }
class Pen {
  page: PDFPage
  private f: Fonts
  constructor(page: PDFPage, f: Fonts) {
    this.page = page
    this.f = f
  }
  font(w: 'regular' | 'bold' | 'black' | 'display') {
    return this.f[w]
  }
  width(t: string, size: number, w: 'regular' | 'bold' | 'black' | 'display' = 'regular', tracking = 0) {
    return this.f[w].widthOfTextAtSize(t, size) + tracking * Math.max(0, [...t].length - 1)
  }
  // `top` is the top of the line box; the baseline sits ~0.8 of the size below it.
  text(t: string, x: number, top: number, size: number, o: { w?: 'regular' | 'bold' | 'black' | 'display'; color?: RGB; align?: 'left' | 'right' | 'center'; tracking?: number } = {}) {
    const w = o.w ?? 'regular'
    const tracking = o.tracking ?? 0
    const tw = this.width(t, size, w, tracking)
    const x0 = o.align === 'right' ? x - tw : o.align === 'center' ? x - tw / 2 : x
    const y = H - top - size * 0.8
    if (!tracking) {
      this.page.drawText(t, { x: x0, y, size, font: this.f[w], color: o.color ?? C.ink })
      return tw
    }
    let cx = x0
    for (const ch of t) {
      this.page.drawText(ch, { x: cx, y, size, font: this.f[w], color: o.color ?? C.ink })
      cx += this.f[w].widthOfTextAtSize(ch, size) + tracking
    }
    return tw
  }
  // Lines of `t` no wider than maxW (breaks at spaces; a non-breaking space keeps its words together).
  wrap(t: string, size: number, maxW: number, w: 'regular' | 'bold' | 'black' | 'display' = 'regular'): string[] {
    const out: string[] = []
    let line = ''
    for (const word of t.split(' ')) {
      const next = line ? `${line} ${word}` : word
      if (line && this.width(next, size, w) > maxW) {
        out.push(line)
        line = word
      } else line = next
    }
    if (line) out.push(line)
    return out
  }
  para(t: string, x: number, top: number, size: number, maxW: number, o: { w?: 'regular' | 'bold' | 'black' | 'display'; color?: RGB; lh?: number } = {}) {
    const lines = this.wrap(t, size, maxW, o.w)
    const lh = size * (o.lh ?? 1.35)
    lines.forEach((l, i) => this.text(l, x, top + i * lh, size, { w: o.w, color: o.color }))
    return lines.length * lh
  }
  rect(x: number, top: number, w: number, h: number, r: number, o: { fill?: RGB; stroke?: RGB; sw?: number; dash?: number[] } = {}) {
    if (w <= 0 || h <= 0) return
    r = Math.min(r, w / 2, h / 2)
    const d = `M${r},0 H${w - r} A${r},${r} 0 0 1 ${w},${r} V${h - r} A${r},${r} 0 0 1 ${w - r},${h} H${r} A${r},${r} 0 0 1 0,${h - r} V${r} A${r},${r} 0 0 1 ${r},0 Z`
    this.page.drawSvgPath(d, {
      x,
      y: H - top,
      color: o.fill,
      borderColor: o.stroke,
      borderWidth: o.stroke ? (o.sw ?? 1) : 0,
      borderDashArray: o.dash,
    })
  }
  line(x1: number, top1: number, x2: number, top2: number, color: RGB, thickness = 0.75, dash?: number[]) {
    this.page.drawLine({ start: { x: x1, y: H - top1 }, end: { x: x2, y: H - top2 }, color, thickness, dashArray: dash })
  }
}

function heading(p: Pen, t: string, top: number) {
  p.text(t.toUpperCase(), M, top, 8.5, { w: 'black', color: C.faint, tracking: 0.9 })
  return top + 18
}

function logo(p: Pen, input: PdfInput, x: number, top: number, width: number) {
  const s = width / input.logoViewBox[0]
  for (const d of input.logoPaths) p.page.drawSvgPath(d, { x, y: H - top, scale: s, color: C.accent2 })
  return input.logoViewBox[1] * s
}

function footer(p: Pen, pageNo: number, pages: number) {
  p.line(M, H - 34, W - M, H - 34, C.line)
  p.text('catchrange.com  ·  Telegram @catchrangebot', M, H - 27, 8, { w: 'bold', color: C.faint })
  p.text(`${pageNo} / ${pages}`, W - M, H - 27, 8, { w: 'bold', color: C.faint, align: 'right' })
}

export async function renderPartnerStatsPdf(input: PdfInput): Promise<Uint8Array> {
  const { point, stats, from, to } = input
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const fonts = {
    regular: await doc.embedFont(input.fonts.regular, { subset: true }),
    bold: await doc.embedFont(input.fonts.bold, { subset: true }),
    black: await doc.embedFont(input.fonts.black, { subset: true }),
    display: await doc.embedFont(input.fonts.display, { subset: true }),
  }
  doc.setTitle(`RANGE — статистика точки «${point.name}»`)
  doc.setAuthor('RANGE · catchrange.com')
  doc.setSubject(`Статистика точки партнёра на карте RANGE, ${input.periodLabel}`)
  doc.setCreator('RANGE')
  doc.setProducer('RANGE')
  doc.setLanguage('ru-RU')

  const days = partnerStatDays(stats.days, stats.tz, from, to)
  // The whole period (the chart and the table show its last 60 days at most).
  const firstDay = dayInTz(stats.tz, Date.parse(from))
  const lastDay = dayInTz(stats.tz, Date.parse(to) - 60_000)
  const range =
    firstDay === lastDay
      ? dayLabel(firstDay, true)
      : `${dayLabel(firstDay, firstDay.slice(0, 4) !== lastDay.slice(0, 4))} — ${dayLabel(lastDay, true)}`
  const created = new Intl.DateTimeFormat('ru-RU', { timeZone: stats.tz, day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date())

  // ── Page 1 ────────────────────────────────────────────────────────────────────────────────────────────
  const p = new Pen(doc.addPage([W, H]), fonts)
  p.page.drawRectangle({ x: 0, y: H - 6, width: W, height: 6, color: C.accent })

  logo(p, input, M, 30, 104)
  p.text('ОТЧЁТ ДЛЯ ПАРТНЁРА', W - M, 32, 8.5, { w: 'black', color: C.accent, align: 'right', tracking: 0.9 })
  p.text(`Создан ${created}`, W - M, 46, 8.5, { w: 'bold', color: C.faint, align: 'right' })

  let y = 86
  const nameLines = p.wrap(point.name.toUpperCase(), 30, CW, 'display').slice(0, 2)
  nameLines.forEach((l, i) => p.text(l, M, y + i * 34, 30, { w: 'display' }))
  y += nameLines.length * 34 + 4
  const sub = [`Статистика точки на карте RANGE`, point.cityName, point.address].filter(Boolean).join('  ·  ')
  y += p.para(sub, M, y, 10.5, CW, { w: 'bold', color: C.soft }) + 8

  // The period, as a pill.
  const periodText = `Период: ${input.periodLabel.toLowerCase()}  ·  ${range}`
  const pw = p.width(periodText, 9.5, 'bold') + 22
  p.rect(M, y, pw, 22, 11, { fill: C.track })
  p.text(periodText, M + 11, y + 6.5, 9.5, { w: 'bold', color: C.ink })
  y += 22 + 16

  // Hero: how many people, and the promo code on a ticket.
  const heroH = 74
  p.rect(M, y, CW, heroH, 16, { fill: C.heroBg, stroke: C.heroLine, sw: 1.2 })
  const big = String(stats.people)
  const bw = p.text(big, M + 20, y + 18, 46, { w: 'black', color: C.accent })
  const hasPromo = !!point.promoCode
  const ticketW = hasPromo ? 168 : 0
  const heroTextW = CW - 20 - bw - 16 - (hasPromo ? ticketW + 24 : 20)
  const heroLines = p.wrap(`${plural(stats.people, 'человек', 'человека', 'человек')} заинтересовались точкой за этот период`, 12.5, heroTextW, 'black')
  const heroTop = y + heroH / 2 - (heroLines.length * 12.5 * 1.3) / 2
  heroLines.forEach((l, i) => p.text(l, M + 20 + bw + 16, heroTop + i * 12.5 * 1.3, 12.5, { w: 'black' }))
  if (hasPromo) {
    const tx = M + CW - 16 - ticketW
    const ty = y + 14
    p.rect(tx, ty, ticketW, heroH - 28, 10, { fill: C.white, stroke: C.accent2, sw: 1, dash: [3, 2.5] })
    p.text('ПРОМОКОД', tx + 14, ty + 10, 7.5, { w: 'black', color: C.faint, tracking: 0.8 })
    const code = point.promoCode!.toUpperCase()
    const codeSize = Math.min(20, (ticketW - 28 - (point.promoDiscount ? p.width(point.promoDiscount, 13, 'black') + 8 : 0)) / Math.max(1, p.width(code, 1, 'display')))
    p.text(code, tx + 14, ty + 24, codeSize, { w: 'display' })
    if (point.promoDiscount) p.text(point.promoDiscount, tx + ticketW - 14, ty + 28, 13, { w: 'black', color: C.red, align: 'right' })
  }
  y += heroH + 20

  if (stats.people === 0) {
    y += p.para('Пока никто не нажимал на метку и карточку в этот период.', M, y, 10, CW, { w: 'bold', color: C.soft }) + 8
  }

  // The way to the shop.
  y = heading(p, 'Путь до магазина', y)
  const f = stats.funnel
  const rows: { label: string; value: number; base: number; color: RGB }[] = [
    { label: 'Открыли карточку или нажали метку', value: f.opened, base: f.opened, color: C.accent },
    { label: 'Скопировали промокод', value: f.copied, base: f.opened, color: C.accent2 },
    { label: 'После промокода нажали «Маршрут», «Позвонить» или «Сайт»', value: f.copied_then_any, base: f.copied, color: C.green },
  ]
  const fh = 14 + rows.length * 35 + 18
  p.rect(M, y, CW, fh, 14, { fill: C.white, stroke: C.line, sw: 1.2 })
  let fy = y + 14
  for (const r of rows) {
    const vt = String(r.value)
    const pt = pct(r.value, r.base)
    const ptW = p.width(pt, 9.5, 'bold')
    p.text(pt, M + CW - 16, fy + 3, 9.5, { w: 'bold', color: C.soft, align: 'right' })
    p.text(vt, M + CW - 16 - ptW - 6, fy, 14, { w: 'black', align: 'right' })
    p.text(r.label, M + 16, fy + 2, 10.5, { w: 'bold' })
    const bw2 = CW - 32
    p.rect(M + 16, fy + 19, bw2, 7, 3.5, { fill: C.track })
    const share = r.base > 0 ? Math.max(r.value > 0 ? 0.03 : 0, r.value / r.base) : 0
    p.rect(M + 16, fy + 19, bw2 * share, 7, 3.5, { fill: r.color })
    fy += 35
  }
  const split = [
    ['маршрут', f.copied_then_route],
    ['звонок', f.copied_then_call],
    ['сайт', f.copied_then_site],
  ] as const
  let sx = M + 16
  for (const [label, n] of split) {
    sx += p.text(`${label} `, sx, fy - 2, 9.5, { w: 'bold', color: C.soft })
    sx += p.text(String(n), sx, fy - 2, 9.5, { w: 'black' }) + 16
  }
  y += fh + 6
  y += p.para('Проценты: «Скопировали промокод» — от открывших карточку; следующая строка — от скопировавших промокод.', M, y, 8.5, CW, { color: C.soft }) + 14

  // All taps: 4 × 2 tiles.
  y = heading(p, 'Все нажатия', y)
  const gap = 8
  const tw = (CW - gap * 3) / 4
  const th = 64
  KINDS.forEach((k, i) => {
    const x = M + (i % 4) * (tw + gap)
    const top = y + Math.floor(i / 4) * (th + gap)
    const t = stats.totals[k.id] ?? { count: 0, people: 0 }
    p.rect(x, top, tw, th, 12, { fill: C.white, stroke: C.line, sw: 1.2 })
    p.para(k.label, x + 10, top + 9, 8.5, tw - 20, { w: 'black', lh: 1.2 })
    p.text(String(t.count), x + 10, top + 25, 19, { w: 'black', color: t.count > 0 ? C.ink : C.faint })
    p.text(people(t.people), x + 10, top + 46, 7.5, { w: 'bold', color: C.soft })
    p.text(k.hint, x + 10, top + 55, 7, { color: C.faint })
  })
  y += 2 * th + gap + 18

  // By day: a column chart — on page 1 when it fits there, otherwise at the top of page 2.
  const series = [
    { key: 'open' as const, label: 'открыли карточку', color: C.accent },
    { key: 'pin' as const, label: 'нажали метку', color: C.yellow },
    { key: 'copy_promo' as const, label: 'скопировали промокод', color: C.green },
  ]
  const drawChart = (pen: Pen, y: number, chartH: number) => {
    y = heading(pen, 'По дням', y)
    pen.rect(M, y, CW, chartH, 14, { fill: C.white, stroke: C.line, sw: 1.2 })
    let lx = M + 14
    for (const s of series) {
      pen.rect(lx, y + 13, 8, 8, 2, { fill: s.color })
      lx += 12 + pen.text(s.label, lx + 12, y + 12.5, 8.5, { w: 'bold', color: C.soft }) + 14
    }
    const max = Math.max(1, ...days.map((d) => Math.max(d.open, d.pin, d.copy_promo)))
    const step = max <= 4 ? 1 : Math.ceil(max / 4)
    const top = step * Math.ceil(max / step)
    const plotL = M + 34
    const plotR = M + CW - 14
    const plotT = y + 34
    const plotB = y + chartH - 26
    for (let v = 0; v <= top; v += step) {
      const gy = plotB - ((plotB - plotT) * v) / top
      pen.line(plotL, gy, plotR, gy, v === 0 ? C.line : C.track, v === 0 ? 1 : 0.75)
      pen.text(String(v), plotL - 6, gy - 4, 7.5, { w: 'bold', color: C.faint, align: 'right' })
    }
    const n = Math.max(1, days.length)
    const slot = (plotR - plotL) / n
    const barW = Math.min(9, (slot * 0.78) / 3)
    const labelEvery = Math.max(1, Math.ceil(n / Math.floor((plotR - plotL) / 44)))
    days.forEach((d, i) => {
      const cx = plotL + slot * (i + 0.5)
      series.forEach((s, j) => {
        const v = d[s.key]
        if (v <= 0) return
        const h = ((plotB - plotT) * v) / top
        pen.rect(cx - (barW * 3) / 2 + j * barW, plotB - h, barW - (barW > 3 ? 0.8 : 0.3), h, Math.min(2, barW / 3), { fill: s.color })
      })
      if (i % labelEvery === 0) pen.text(dayLabel(d.day), cx, plotB + 8, 7.5, { w: 'bold', color: C.soft, align: 'center' })
    })
    return y + chartH
  }
  const room = H - 46 - y - 18
  const chartOnFirst = room >= 130
  if (chartOnFirst) drawChart(p, y, Math.min(230, room))

  // ── Page 2+: the table by day, the totals, how we count ────────────────────────────────────────────────
  const pages: Pen[] = [p]
  const cols = [
    { label: 'Дата', x: M + 14, align: 'left' as const },
    { label: 'Открыли карточку', x: M + CW * 0.52, align: 'right' as const },
    { label: 'Нажали метку', x: M + CW * 0.74, align: 'right' as const },
    { label: 'Скопировали промокод', x: M + CW - 14, align: 'right' as const },
  ]
  const rowH = 17
  let q: Pen | null = null
  let ty = 0
  const newTablePage = (first: boolean) => {
    q = new Pen(doc.addPage([W, H]), fonts)
    pages.push(q)
    q.page.drawRectangle({ x: 0, y: H - 6, width: W, height: 6, color: C.accent })
    logo(q, input, M, 30, 70)
    q.text(point.name, W - M, 33, 9.5, { w: 'black', align: 'right' })
    ty = 74
    if (first && !chartOnFirst) ty = drawChart(q, ty, 220) + 24
    ty = heading(q, first ? 'По дням — таблица' : 'По дням — продолжение', ty)
    q.rect(M, ty, CW, rowH + 6, 8, { fill: C.track })
    cols.forEach((c) => q!.text(c.label, c.x, ty + 7.5, 8.5, { w: 'black', color: C.soft, align: c.align }))
    ty += rowH + 10
  }
  newTablePage(true)
  const sum = { open: 0, pin: 0, copy_promo: 0 }
  for (const d of days) {
    if (ty + rowH > H - 60) newTablePage(false)
    const pen = q as unknown as Pen
    const quiet = d.open + d.pin + d.copy_promo === 0
    const color = quiet ? C.faint : C.ink
    pen.text(dayLabel(d.day, true), cols[0].x, ty + 3, 9.5, { w: 'bold', color: quiet ? C.faint : C.soft })
    pen.text(String(d.open), cols[1].x, ty + 3, 9.5, { w: 'black', color, align: 'right' })
    pen.text(String(d.pin), cols[2].x, ty + 3, 9.5, { w: 'black', color, align: 'right' })
    pen.text(String(d.copy_promo), cols[3].x, ty + 3, 9.5, { w: 'black', color, align: 'right' })
    pen.line(M + 14, ty + rowH, M + CW - 14, ty + rowH, C.track)
    sum.open += d.open
    sum.pin += d.pin
    sum.copy_promo += d.copy_promo
    ty += rowH
  }
  if (ty + 30 > H - 60) newTablePage(false)
  {
    const pen = q as unknown as Pen
    pen.rect(M, ty + 4, CW, rowH + 8, 8, { fill: C.heroBg })
    pen.text('Итого нажатий', cols[0].x, ty + 11, 9.5, { w: 'black' })
    pen.text(String(sum.open), cols[1].x, ty + 11, 9.5, { w: 'black', color: C.accent, align: 'right' })
    pen.text(String(sum.pin), cols[2].x, ty + 11, 9.5, { w: 'black', color: C.accent, align: 'right' })
    pen.text(String(sum.copy_promo), cols[3].x, ty + 11, 9.5, { w: 'black', color: C.accent, align: 'right' })
    ty += rowH + 30
  }

  const notes = [
    'Человек — это аккаунт игрока или телефон гостя без аккаунта. Один человек, открывший карточку пять раз, — это пять открытий, но один человек.',
    'Админы RANGE не считаются. Повторное нажатие той же кнопки чаще раза в 10 секунд не учитывается.',
    'Дни — по местному времени города. В таблице и на графике — последние 60 дней периода, если он длиннее.',
    'Скопированный промокод — ещё не покупка: сколько человек пришли в магазин, видно только на кассе.',
  ]
  const notesH = 30 + notes.reduce((a, t) => a + (q as unknown as Pen).wrap(t, 9, CW - 46).length * 9 * 1.4 + 6, 0)
  if (ty + notesH > H - 60) {
    newTablePage(false)
  }
  {
    const pen = q as unknown as Pen
    ty = heading(pen, 'Как мы считаем', ty)
    for (const t of notes) {
      pen.rect(M + 2, ty + 3.5, 5, 5, 2.5, { fill: C.accent2 })
      ty += pen.para(t, M + 16, ty, 9, CW - 46, { color: C.soft, lh: 1.4 }) + 6
    }
  }

  pages.forEach((pg, i) => footer(pg, i + 1, pages.length))
  return doc.save()
}
