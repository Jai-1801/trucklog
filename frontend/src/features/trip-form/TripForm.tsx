import { Loader2 } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { nextQuarterHourLocal } from '../../lib/format'
import { displayText } from '../../lib/place'
import type { PlaceInput, PlanRequest } from '../../lib/types'
import { fieldClass } from '../../lib/ui'
import { LocationInput } from './LocationInput'

type FieldErrors = Partial<Record<keyof PlanRequest, string>>

type Props = {
  /** Starting values. The parent remounts the form (new `key`) to load a sample, shared link or edit. */
  initial?: PlanRequest
  onSubmit: (request: PlanRequest) => void
  pending: boolean
  serverErrors?: Record<string, unknown>
}

function firstMessage(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return firstMessage(value[0])
  if (value && typeof value === 'object') return firstMessage(Object.values(value)[0])
  return undefined
}

const fmt = (n: number) => n.toFixed(2).replace(/\.?0+$/, '') || '0'

// Small, quiet stop markers: a ring for the truck, a square for the load, a filled dot for the delivery.
const Marker = {
  current: <span className="size-2.5 rounded-full border-2 border-ink" />,
  pickup: <span className="size-2.5 rounded-[2px] bg-pin-pickup" />,
  dropoff: <span className="size-2.5 rounded-full bg-ink" />,
}

export function TripForm({ initial, onSubmit, pending, serverErrors }: Props) {
  const [current, setCurrent] = useState<PlaceInput>(initial?.current_location ?? {})
  const [pickup, setPickup] = useState<PlaceInput>(initial?.pickup_location ?? {})
  const [dropoff, setDropoff] = useState<PlaceInput>(initial?.dropoff_location ?? {})
  const [cycle, setCycle] = useState(String(initial?.current_cycle_used_hrs ?? 0))
  const [startAt, setStartAt] = useState(() => initial?.start_at ?? nextQuarterHourLocal())
  const [errors, setErrors] = useState<FieldErrors>({})

  const fieldError = (field: keyof PlanRequest) => errors[field] ?? firstMessage(serverErrors?.[field])

  const clear = (field: keyof PlanRequest) =>
    setErrors((prev) => {
      const next = { ...prev }
      delete next[field]
      return next
    })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const next: FieldErrors = {}
    if (!displayText(current).trim()) next.current_location = 'Enter where the truck is now.'
    if (!displayText(pickup).trim()) next.pickup_location = 'Enter the pickup location.'
    if (!displayText(dropoff).trim()) next.dropoff_location = 'Enter the dropoff location.'
    const hours = Number(cycle)
    if (cycle.trim() === '' || !Number.isFinite(hours) || hours < 0 || hours > 70) {
      next.current_cycle_used_hrs = 'Enter a number from 0 to 70.'
    }
    setErrors(next)
    if (Object.keys(next).length > 0) return
    onSubmit({
      current_location: current,
      pickup_location: pickup,
      dropoff_location: dropoff,
      current_cycle_used_hrs: hours,
      start_at: startAt || undefined,
    })
  }

  const cycleNumber = Math.min(70, Math.max(0, Number(cycle) || 0))
  const cycleError = fieldError('current_cycle_used_hrs')

  return (
    <form onSubmit={submit} noValidate>
      <div className="space-y-5">
        <LocationInput
          label="Current location"
          marker={Marker.current}
          placeholder="City, state or address"
          value={current}
          onChange={(v) => {
            setCurrent(v)
            clear('current_location')
          }}
          error={fieldError('current_location')}
        />
        <LocationInput
          label="Pickup"
          hint="1 h loading"
          marker={Marker.pickup}
          placeholder="City, state or address"
          value={pickup}
          onChange={(v) => {
            setPickup(v)
            clear('pickup_location')
          }}
          error={fieldError('pickup_location')}
        />
        <LocationInput
          label="Dropoff"
          hint="1 h unloading"
          marker={Marker.dropoff}
          placeholder="City, state or address"
          value={dropoff}
          onChange={(v) => {
            setDropoff(v)
            clear('dropoff_location')
          }}
          error={fieldError('dropoff_location')}
        />
      </div>

      <div className="mt-8 grid gap-5 border-t border-line pt-8 sm:grid-cols-2">
        <div>
          <label htmlFor="cycle" className="mb-2 block text-sm font-medium">
            Cycle hours used
          </label>
          <div className={`flex items-center pr-3.5 ${fieldClass} ${cycleError ? 'border-status-restart' : 'border-line-strong'}`}>
            <input
              id="cycle"
              type="number"
              inputMode="decimal"
              min={0}
              max={70}
              step={0.25}
              value={cycle}
              onChange={(e) => {
                setCycle(e.target.value)
                clear('current_cycle_used_hrs')
              }}
              aria-describedby="cycle-help"
              className="h-11 w-full min-w-0 bg-transparent pl-3.5 text-[15px] tabular-nums outline-none"
            />
            <span className="shrink-0 text-sm whitespace-nowrap text-subtle">of 70 h</span>
          </div>
          <p id="cycle-help" className={`mt-1.5 text-[13px] ${cycleError ? 'text-status-restart' : 'text-muted'}`}>
            {cycleError ?? `${fmt(70 - cycleNumber)} h left in the 8-day cycle`}
          </p>
        </div>

        <div>
          <label htmlFor="start" className="mb-2 block text-sm font-medium">
            Departure
          </label>
          <div className={`px-3.5 ${fieldClass} border-line-strong`}>
            <input
              id="start"
              type="datetime-local"
              step={900}
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              aria-describedby="start-help"
              className="h-11 w-full min-w-0 bg-transparent text-[15px] tabular-nums outline-none"
            />
          </div>
          <p id="start-help" className="mt-1.5 text-[13px] text-muted">
            {fieldError('start_at') ?? 'Local time where the truck is'}
          </p>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-8 flex h-11 w-full items-center justify-center gap-2 rounded-field bg-accent text-[15px] font-semibold text-white transition-colors hover:bg-accent-strong disabled:cursor-wait disabled:opacity-70"
      >
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {pending ? 'Planning…' : 'Plan trip'}
      </button>
    </form>
  )
}
