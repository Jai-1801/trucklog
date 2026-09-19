import { Loader2, MapPin } from 'lucide-react'
import { type KeyboardEvent, type ReactNode, useEffect, useId, useState } from 'react'
import { autocomplete } from '../../lib/api'
import { displayText } from '../../lib/place'
import type { Place, PlaceInput } from '../../lib/types'

type Props = {
  label: string
  /** Stop marker drawn in the route rail on the left. */
  marker: ReactNode
  value: PlaceInput
  onChange: (value: PlaceInput) => void
  placeholder: string
  error?: string
}

/** One stop in the grouped route box: marker, small label, big value, suggestions. */
export function LocationInput({ label, marker, value, onChange, placeholder, error }: Props) {
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
      <label
        htmlFor={id}
        className="flex cursor-text items-center gap-4 px-5 py-3.5 transition-colors focus-within:bg-accent-soft/50 hover:bg-canvas/70"
      >
        <span className="relative z-10 grid size-9 shrink-0 place-items-center rounded-full bg-surface ring-1 ring-line">
          {marker}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block text-[11px] font-bold tracking-[0.08em] uppercase ${error ? 'text-status-restart' : 'text-subtle'}`}>
            {label}
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
            className="mt-0.5 h-7 w-full min-w-0 bg-transparent text-[16px] font-semibold outline-none placeholder:font-medium placeholder:text-subtle/80"
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
        </span>
        {loading && <Loader2 className="size-4 shrink-0 animate-spin text-subtle" aria-hidden />}
      </label>
      {error && (
        <p id={`${id}-error`} className="-mt-1.5 pr-5 pb-3 pl-[76px] text-[13px] font-medium text-status-restart">
          {error}
        </p>
      )}
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-3 top-full z-[1000] -mt-1 overflow-hidden rounded-xl border border-line bg-surface p-1.5 shadow-[var(--shadow-float)]"
        >
          {suggestions.map((place, i) => (
            <li
              key={`${place.label}-${place.lat}-${place.lng}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-medium ${
                i === active ? 'bg-accent-soft text-accent-strong' : 'hover:bg-canvas'
              }`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(place)}
              onMouseEnter={() => setActive(i)}
            >
              <MapPin className="size-4 shrink-0 text-subtle" aria-hidden />
              <span className="truncate">{place.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
