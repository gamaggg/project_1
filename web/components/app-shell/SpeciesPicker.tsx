'use client'

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

type Option = { key: string; name: string }

function norm(s: string) {
  return s.toLowerCase().replace(/ё/g, 'е').trim()
}

// Sorted and grouped by the first letter, past any opening quote — a few
// names are nicknames written «in quotes».
function bare(name: string) {
  return name.replace(/^[^\p{L}]+/u, '')
}

// The catch form's species field: one list for the whole city (no
// marine/freshwater or predator/peaceful split — players asked to stop
// hunting for a fish in the wrong tab), opened as a sheet with a search box,
// the player's own most-caught fish first, then everything A–Я under letter
// headings.
export function SpeciesPicker({
  options,
  value,
  frequent,
  onChange,
}: {
  options: Option[]
  value: string
  frequent: string[]
  onChange: (key: string) => void
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.key === value)

  return (
    <>
      <button type="button" id="species" className={`species-trigger${selected ? '' : ' empty'}`} onClick={() => setOpen(true)}>
        {selected ? selected.name : 'Выбери вид рыбы'}
      </button>
      {open && (
        <SpeciesSheet
          options={options}
          value={value}
          frequent={frequent}
          onPick={(key) => {
            onChange(key)
            setOpen(false)
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

function SpeciesSheet({
  options,
  value,
  frequent,
  onPick,
  onClose,
}: {
  options: Option[]
  value: string
  frequent: string[]
  onPick: (key: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const sorted = useMemo(() => [...options].sort((a, b) => bare(a.name).localeCompare(bare(b.name), 'ru')), [options])
  const q = norm(query)

  // A word starting with the query ranks first («кар» → Карась before
  // Морской карась), then anywhere in the name.
  const found = q
    ? sorted
        .filter((o) => norm(o.name).includes(q))
        .sort((a, b) => Number(!norm(b.name).split(/[\s-]+/).some((w) => w.startsWith(q))) - Number(!norm(a.name).split(/[\s-]+/).some((w) => w.startsWith(q))))
    : null
  const mine = q ? [] : frequent.map((k) => options.find((o) => o.key === k)).filter((o): o is Option => !!o).slice(0, 4)

  const groups: { letter: string; items: Option[] }[] = []
  for (const o of sorted) {
    const letter = bare(o.name).charAt(0).toUpperCase()
    const g = groups[groups.length - 1]
    if (g && g.letter === letter) g.items.push(o)
    else groups.push({ letter, items: [o] })
  }

  const row = (o: Option) => (
    <button key={o.key} type="button" className={`species-row${o.key === value ? ' active' : ''}`} onClick={() => onPick(o.key)}>
      {o.name}
      {o.key === value && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      )}
    </button>
  )

  return createPortal(
    <div className="move-sheet-overlay" onClick={onClose}>
      <div className="move-sheet species-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Вид рыбы">
        <div className="move-sheet-handle" />
        <div className="move-head">
          <div className="move-title">Вид рыбы</div>
        </div>
        <div className="species-search">
          <input type="search" placeholder="Поиск" value={query} onChange={(e) => setQuery(e.target.value)} enterKeyHint="search" />
        </div>
        <div className="move-body species-list">
          {mine.length > 0 && (
            <>
              <div className="species-letter">Часто ловишь</div>
              <div className="species-chips">
                {mine.map((o) => (
                  <button key={o.key} type="button" className={`filter-chip${o.key === value ? ' active' : ''}`} onClick={() => onPick(o.key)}>
                    {o.name}
                  </button>
                ))}
              </div>
            </>
          )}
          {found ? (
            found.length > 0 ? found.map(row) : <div className="species-empty">Не нашли «{query.trim()}»</div>
          ) : (
            groups.map((g) => (
              <div key={g.letter}>
                <div className="species-letter">{g.letter}</div>
                {g.items.map(row)}
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
