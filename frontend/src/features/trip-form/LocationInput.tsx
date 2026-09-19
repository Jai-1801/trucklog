import { Loader2, MapPin } from 'lucide-react'
import { type KeyboardEvent, type ReactNode, useEffect, useId, useState } from 'react'
import { autocomplete } from '../../lib/api'
import { displayText } from '../../lib/place'
import type { Place, PlaceInput } from '../../lib/types'

type Props = {
  label: string
  icon: ReactNode
  value: PlaceInput
  onChange: (value: PlaceInput) => void
  placeholder: string
  error?: string
}

export function LocationInput({ label, icon, value, onChange, placeholder, error }: Props) {
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
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-muted">
        {label}
      </label>
      <div
        className={`flex items-center gap-2 rounded-lg border bg-surface px-3 transition-colors focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/15 ${
          error ? 'border-status-restart' : 'border-line'
        }`}
      >
        <span className="shrink-0 text-muted" aria-hidden>
          {icon}
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
          className="h-10 w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted/70"
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
        {loading && <Loader2 className="size-4 shrink-0 animate-spin text-muted" aria-hidden />}
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-status-restart">
          {error}
        </p>
      )}
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-[1000] mt-1 w-full overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-lg shadow-ink/5"
        >
          {suggestions.map((place, i) => (
            <li
              key={`${place.label}-${place.lat}-${place.lng}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm ${i === active ? 'bg-accent/8' : 'hover:bg-canvas'}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(place)}
              onMouseEnter={() => setActive(i)}
            >
              <MapPin className="size-3.5 shrink-0 text-muted" aria-hidden />
              <span className="truncate">{place.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
