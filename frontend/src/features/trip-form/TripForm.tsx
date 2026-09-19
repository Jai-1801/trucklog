import { CircleDot, Clock, Flag, Loader2, Package, Route } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { nextQuarterHourLocal } from '../../lib/format'
import type { PlaceInput, PlanRequest } from '../../lib/types'
import { displayText } from '../../lib/place'
import { LocationInput } from './LocationInput'
import { SAMPLES, type Sample } from './samples'

type FieldErrors = Partial<Record<keyof PlanRequest, string>>

type Props = {
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

export function TripForm({ onSubmit, pending, serverErrors }: Props) {
  const [current, setCurrent] = useState<PlaceInput>({})
  const [pickup, setPickup] = useState<PlaceInput>({})
  const [dropoff, setDropoff] = useState<PlaceInput>({})
  const [cycle, setCycle] = useState('0')
  const [startAt, setStartAt] = useState(nextQuarterHourLocal)
  const [errors, setErrors] = useState<FieldErrors>({})

  const fieldError = (field: keyof PlanRequest) => errors[field] ?? firstMessage(serverErrors?.[field])

  const build = (c: PlaceInput, p: PlaceInput, d: PlaceInput, cyc: string): PlanRequest | null => {
    const next: FieldErrors = {}
    if (!displayText(c).trim()) next.current_location = 'Where is the truck now?'
    if (!displayText(p).trim()) next.pickup_location = 'Where is the pickup?'
    if (!displayText(d).trim()) next.dropoff_location = 'Where is the dropoff?'
    const hours = Number(cyc)
    if (cyc.trim() === '' || !Number.isFinite(hours) || hours < 0 || hours > 70) {
      next.current_cycle_used_hrs = 'Enter 0 to 70 hours.'
    }
    setErrors(next)
    if (Object.keys(next).length > 0) return null
    return {
      current_location: c,
      pickup_location: p,
      dropoff_location: d,
      current_cycle_used_hrs: hours,
      start_at: startAt || undefined,
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const request = build(current, pickup, dropoff, cycle)
    if (request) onSubmit(request)
  }

  const runSample = (sample: Sample) => {
    setCurrent(sample.current)
    setPickup(sample.pickup)
    setDropoff(sample.dropoff)
    setCycle(String(sample.cycle))
    const request = build(sample.current, sample.pickup, sample.dropoff, String(sample.cycle))
    if (request) onSubmit(request)
  }

  const clear = (field: keyof PlanRequest) =>
    setErrors((prev) => {
      const next = { ...prev }
      delete next[field]
      return next
    })
  const cycleNumber = Math.min(70, Math.max(0, Number(cycle) || 0))

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="relative space-y-3">
        <LocationInput
          label="Current location"
          icon={<CircleDot className="size-4" />}
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
          icon={<Package className="size-4" />}
          placeholder="Where you load"
          value={pickup}
          onChange={(v) => {
            setPickup(v)
            clear('pickup_location')
          }}
          error={fieldError('pickup_location')}
        />
        <LocationInput
          label="Dropoff"
          icon={<Flag className="size-4" />}
          placeholder="Where you unload"
          value={dropoff}
          onChange={(v) => {
            setDropoff(v)
            clear('dropoff_location')
          }}
          error={fieldError('dropoff_location')}
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <label htmlFor="cycle" className="text-xs font-medium text-muted">
            Current cycle used
          </label>
          <span className="text-xs text-muted">
            <span className="font-mono tabular-nums text-ink">{(70 - cycleNumber).toFixed(2).replace(/\.00$/, '')}</span> h
            left of 70
          </span>
        </div>
        <div className="flex items-center gap-3">
          <input
            aria-label="Cycle hours used (slider)"
            type="range"
            min={0}
            max={70}
            step={0.25}
            value={cycleNumber}
            onChange={(e) => {
              setCycle(e.target.value)
              clear('current_cycle_used_hrs')
            }}
            className="h-1.5 flex-1 cursor-pointer accent-accent"
          />
          <div
            className={`flex w-24 items-center rounded-lg border bg-surface pr-2.5 focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/15 ${
              fieldError('current_cycle_used_hrs') ? 'border-status-restart' : 'border-line'
            }`}
          >
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
              className="h-10 w-full min-w-0 bg-transparent pl-3 font-mono text-sm tabular-nums outline-none"
            />
            <span className="text-xs text-muted">hrs</span>
          </div>
        </div>
        {fieldError('current_cycle_used_hrs') && (
          <p className="mt-1 text-xs text-status-restart">{fieldError('current_cycle_used_hrs')}</p>
        )}
      </div>

      <div>
        <label htmlFor="start" className="mb-1.5 block text-xs font-medium text-muted">
          Trip start <span className="font-normal">(local time at current location)</span>
        </label>
        <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/15">
          <Clock className="size-4 shrink-0 text-muted" aria-hidden />
          <input
            id="start"
            type="datetime-local"
            step={900}
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
            className="h-10 w-full min-w-0 bg-transparent text-sm tabular-nums outline-none"
          />
        </div>
        {fieldError('start_at') && <p className="mt-1 text-xs text-status-restart">{fieldError('start_at')}</p>}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent text-sm font-semibold text-white shadow-sm shadow-accent/30 transition hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-80"
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Route className="size-4" aria-hidden />}
        {pending ? 'Planning trip…' : 'Plan trip'}
      </button>

      <div>
        <p className="mb-2 text-xs font-medium text-muted">Or try a sample trip</p>
        <div className="grid grid-cols-2 gap-2">
          {SAMPLES.map((sample) => (
            <button
              key={sample.name}
              type="button"
              disabled={pending}
              onClick={() => runSample(sample)}
              title={sample.hint}
              className="rounded-lg border border-line bg-surface px-3 py-2 text-left transition hover:border-accent/50 hover:bg-accent/5 focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60"
            >
              <span className="block text-xs font-semibold">{sample.name}</span>
              <span className="block truncate text-[11px] text-muted">{sample.hint}</span>
            </button>
          ))}
        </div>
      </div>
    </form>
  )
}
