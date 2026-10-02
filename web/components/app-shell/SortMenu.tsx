'use client'

import { useEffect, useRef, useState } from 'react'

// «Свежие ⌄» — a pill that opens a short list of orders. The order is a
// secondary choice next to the filter chips, so it stays a single pill at
// the end of their row (`shortLabels` keep it that small) until it's needed,
// instead of a row of tabs.
export function SortMenu<T extends string>({
  value,
  options,
  shortLabels,
  onChange,
  label,
}: {
  value: T
  options: Record<T, string>
  shortLabels?: Record<T, string>
  onChange: (value: T) => void
  label: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="sort-menu" ref={rootRef}>
      <button
        type="button"
        className="sort-menu-btn tap-scale"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${options[value]}`}
        onClick={() => setOpen((o) => !o)}
      >
        {shortLabels?.[value] ?? options[value]}
        <svg className="sort-menu-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="sort-menu-list" role="listbox" aria-label={label}>
          {(Object.keys(options) as T[]).map((key) => (
            <button
              key={key}
              type="button"
              role="option"
              aria-selected={key === value}
              className={`sort-menu-opt${key === value ? ' on' : ''}`}
              onClick={() => {
                onChange(key)
                setOpen(false)
              }}
            >
              {options[key]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
