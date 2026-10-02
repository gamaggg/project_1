'use client'

import { useRef, useState } from 'react'
import { EMOJI_CATEGORIES } from '@/lib/data/emoji'

const RECENT_KEY = 'range:emoji-recent'
const RECENT_MAX = 24

function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    const list = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(list) ? list.filter((e): e is string => typeof e === 'string').slice(0, RECENT_MAX) : []
  } catch {
    return []
  }
}

function writeRecent(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list))
  } catch {
    // Private mode / storage off — the panel still works, just forgets.
  }
}

// The emoji keyboard of the clan chat: shown in place of the phone's own
// keyboard, like Telegram's. «Недавние» first (kept on this device), then
// the categories; the tab bar at the bottom jumps between them and follows
// the scroll. Mounted only while open, so it costs nothing otherwise.
export function EmojiPanel({ onPick }: { onPick: (emoji: string) => void }) {
  // Read once per opening: re-sorting «Недавние» while the panel is open
  // would shift the grid under the finger; new picks show up next time.
  const [recent] = useState<string[]>(readRecent)
  const [active, setActive] = useState(() => (readRecent().length ? 'recent' : EMOJI_CATEGORIES[0].id))
  const scrollRef = useRef<HTMLDivElement>(null)

  const sections = [
    ...(recent.length ? [{ id: 'recent', label: 'Недавние', icon: '🕘', emoji: recent }] : []),
    ...EMOJI_CATEGORIES,
  ]

  function pick(emoji: string) {
    onPick(emoji)
    writeRecent([emoji, ...readRecent().filter((e) => e !== emoji)].slice(0, RECENT_MAX))
  }

  function jumpTo(id: string) {
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-section="${id}"]`)
    if (!el || !scrollRef.current) return
    scrollRef.current.scrollTo({ top: el.offsetTop - 4, behavior: 'smooth' })
    setActive(id)
  }

  function onScroll() {
    const box = scrollRef.current
    if (!box) return
    let current = sections[0]?.id
    for (const s of sections) {
      const el = box.querySelector<HTMLElement>(`[data-section="${s.id}"]`)
      if (el && el.offsetTop - box.scrollTop <= 24) current = s.id
    }
    if (current && current !== active) setActive(current)
  }

  return (
    <div className="emoji-panel" onMouseDown={(e) => e.preventDefault()}>
      <div className="emoji-panel-scroll" ref={scrollRef} onScroll={onScroll}>
        {sections.map((s) => (
          <section key={s.id} data-section={s.id} className="emoji-section">
            <div className="emoji-section-title">{s.label}</div>
            <div className="emoji-grid">
              {s.emoji.map((e, i) => (
                <button key={`${s.id}-${i}`} className="emoji-cell" onClick={() => pick(e)} aria-label={e}>
                  {e}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className="emoji-tabs" role="tablist" aria-label="Категории эмодзи">
        {sections.map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={active === s.id}
            aria-label={s.label}
            className={`emoji-tab${active === s.id ? ' on' : ''}`}
            onClick={() => jumpTo(s.id)}
          >
            {s.icon}
          </button>
        ))}
      </div>
    </div>
  )
}
