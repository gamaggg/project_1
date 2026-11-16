'use client'

import { useEffect, useState } from 'react'

export type PreviewItem = {
  id: string
  title: string
  html: string
  zipped: number
  chatData: string
  // The bot's answer to the widget's request (JSON string or 'null').
  answer: string
  caption: string
  button: string
}

// A stand-in for Telegram's TelegramWidget, set before the widget's own script.
function frameDoc(item: PreviewItem): string {
  const stub = `window.TelegramWidget={profile:1,isProfileAtLeast:function(n){return n<=1},chatData:${JSON.stringify(item.chatData)},publicData:null,
HapticFeedback:{impactOccurred:function(){},notificationOccurred:function(){},selectionChanged:function(){}},onEvent:function(){},offEvent:function(){},ready:function(){},
request:function(){return new Promise(function(r){setTimeout(function(){r({result:${JSON.stringify(item.answer)}})},600)})}};`
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script>${stub.replace(/<\//g, '<\\/')}</script></head><body>${item.html}</body></html>`
}

const WIDTHS = [320, 375, 430]

export function WidgetPreview({ items }: { items: PreviewItem[] }) {
  const [width, setWidth] = useState(375)
  const [runs, setRuns] = useState<Record<string, number>>({})
  const [heights, setHeights] = useState<Record<string, number>>({})

  // A frame loads before React is there to hear it (the page is rendered on the
  // server), so its height is read on a timer: the widgets draw themselves and
  // redraw on the bot's answer.
  useEffect(() => {
    const read = () => {
      const next: Record<string, number> = {}
      document.querySelectorAll<HTMLIFrameElement>('iframe[data-widget]').forEach((el) => {
        try {
          const h = (el.contentDocument?.getElementById('r') as HTMLElement | null)?.offsetHeight
          if (h) next[el.dataset.widget as string] = Math.min(600, h)
        } catch {}
      })
      setHeights((s) => (JSON.stringify(s) === JSON.stringify({ ...s, ...next }) ? s : { ...s, ...next }))
    }
    const id = window.setInterval(read, 400)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div style={{ minHeight: '100dvh', background: '#DCE7E3', padding: '24px 16px 48px', fontFamily: 'system-ui, sans-serif', color: '#17181B' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Виджеты в чате бота — предпросмотр</h1>
        <p style={{ margin: '6px 0 14px', fontSize: 14, color: '#4B5A55' }}>
          Так виджет нарисуется в сообщении бота. Данные выдуманные, кроме прогноза. Через 0,6 с «бот» отвечает на запрос виджета. Сцену сектора можно запустить снова нажатием на неё, по шкале прогноза можно вести пальцем.
        </p>
        <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
          {WIDTHS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWidth(w)}
              style={{ padding: '6px 12px', borderRadius: 999, border: 0, fontWeight: 700, cursor: 'pointer', background: w === width ? '#17181B' : '#fff', color: w === width ? '#fff' : '#17181B' }}
            >
              {w} px
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
          {items.map((item) => (
            <section key={item.id} style={{ width }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6, gap: 8 }}>
                <b style={{ fontSize: 14 }}>{item.title}</b>
                <span style={{ fontSize: 12, color: item.zipped > 4096 ? '#B42323' : '#4B5A55' }}>{(item.zipped / 1024).toFixed(2)} из 4 КБ</span>
              </div>
              <div style={{ background: '#fff', borderRadius: '16px 16px 16px 6px', padding: 4, boxShadow: '0 1px 1px rgba(0,0,0,.08)' }}>
                <iframe
                  key={`${item.id}-${runs[item.id] ?? 0}-${width}`}
                  title={item.title}
                  srcDoc={frameDoc(item)}
                  sandbox="allow-scripts allow-same-origin"
                  data-widget={item.id}
                  style={{ display: 'block', width: '100%', height: heights[item.id] ?? 420, border: 0, borderRadius: 12 }}
                />
                <div style={{ padding: '7px 8px 4px', fontSize: 14, lineHeight: 1.38 }}>{item.caption}</div>
              </div>
              <div style={{ marginTop: 4, padding: '10px 8px', borderRadius: 10, background: 'rgba(255,255,255,.8)', textAlign: 'center', fontWeight: 800, fontSize: 14, color: '#1F6F5C' }}>{item.button}</div>
              <button type="button" onClick={() => setRuns((r) => ({ ...r, [item.id]: (r[item.id] ?? 0) + 1 }))} style={{ marginTop: 8, padding: '6px 12px', borderRadius: 999, border: 0, background: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                ↻ Сначала
              </button>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
