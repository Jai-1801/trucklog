import { Loader2 } from 'lucide-react'
import { type KeyboardEvent, type ReactNode, useEffect, useId, useState } from 'react'
import { autocomplete } from '../../lib/api'
import { displayText } from '../../lib/place'
import type { Place, PlaceInput } from '../../lib/types'
import { fieldClass } from '../../lib/ui'

type Props = {
  label: string
  hint?: string
  marker: ReactNode
  value: PlaceInput
  onChange: (value: PlaceInput) => void
  placeholder: string
  error?: string
}

export function LocationInput({ label, hint, marker, value, onChange, placeholder, error }: Props) {
  const id = useId()
  const listId = `${id}-list`
  const [suggestions, setSuggestions] = useState<Place[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [loading, setLoading] = useState(false)
  const text = displayText(value)
  const picked = value.lat !== undefined
  const searchable = !picked && text.trim().length >= 2

  useEffect(() => {
    if (!searchable) return
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading(true)
      try {
        setSuggestions(await autocomplete(text.trim(), controller.signal))
        setActive(-1)
      } catch {
        if (!controller.signal.aborted) setSuggestions([])
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 250)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
      setLoading(false)
    }
  }, [text, searchable])

  const choose = (place: Place) => {
    onChange(place)
    setOpen(false)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault()
      choose(suggestions[active])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const showList = open && searchable && suggestions.length > 0

  return (
    <div className="relative">
      <label htmlFor={id} className="mb-2 flex items-baseline justify-between text-sm font-medium">
        {label}
        {hint && <span className="text-[13px] font-normal text-subtle">{hint}</span>}
      </label>
      <div className={`flex items-center gap-3 px-3.5 ${fieldClass} ${error ? 'border-status-restart' : 'border-line-strong'}`}>
        <span className="flex w-4 shrink-0 justify-center" aria-hidden>
          {marker}
        </span>
        <input
          id={id}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          autoComplete="off"
          spellCheck={false}
          className="h-11 w-full min-w-0 bg-transparent text-[15px] outline-none placeholder:text-subtle"
          placeholder={placeholder}
          value={text}
          onChange={(e) => {
            onChange({ query: e.target.value })
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
        />
        {loading && <Loader2 className="size-4 shrink-0 animate-spin text-subtle" aria-hidden />}
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-[13px] text-status-restart">
          {error}
        </p>
      )}
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-[1000] mt-1 overflow-hidden rounded-field border border-line bg-surface py-1 shadow-[0_6px_20px_rgb(28_25_23/0.1)]"
        >
          {suggestions.map((place, i) => (
            <li
              key={`${place.label}-${place.lat}-${place.lng}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`cursor-pointer truncate px-3.5 py-2 text-[14px] ${i === active ? 'bg-accent-soft text-accent-strong' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(place)}
              onMouseEnter={() => setActive(i)}
            >
              {place.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
