import { ArrowRight, CircleDot, Clock, Flag, Loader2, Package } from 'lucide-react'
import { type FormEvent, type ReactNode, useState } from 'react'
import { nextQuarterHourLocal } from '../../lib/format'
import { displayText } from '../../lib/place'
import type { PlaceInput, PlanRequest } from '../../lib/types'
import { LocationInput } from './LocationInput'
import { SAMPLES, type Sample } from './samples'

type FieldErrors = Partial<Record<keyof PlanRequest, string>>

type Props = {
  /** Starting values. The parent remounts the form (new `key`) to load a sample or shared link. */
  initial?: PlanRequest
  onSubmit: (request: PlanRequest) => void
  onSample: (sample: Sample) => void
  pending: boolean
  serverErrors?: Record<string, unknown>
}

function firstMessage(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return firstMessage(value[0])
  if (value && typeof value === 'object') return firstMessage(Object.values(value)[0])
  return undefined
}

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-5">
      <legend className="mb-5">
        <span className="block text-xs font-bold tracking-[0.08em] text-subtle uppercase">{title}</span>
        <span className="mt-1 block text-[13px] text-muted">{description}</span>
      </legend>
      {children}
    </fieldset>
  )
}

export function TripForm({ initial, onSubmit, onSample, pending, serverErrors }: Props) {
  const [current, setCurrent] = useState<PlaceInput>(initial?.current_location ?? {})
  const [pickup, setPickup] = useState<PlaceInput>(initial?.pickup_location ?? {})
  const [dropoff, setDropoff] = useState<PlaceInput>(initial?.dropoff_location ?? {})
  const [cycle, setCycle] = useState(String(initial?.current_cycle_used_hrs ?? 0))
  const [startAt, setStartAt] = useState(() => initial?.start_at ?? nextQuarterHourLocal())
  const [errors, setErrors] = useState<FieldErrors>({})

  const fieldError = (field: keyof PlanRequest) => errors[field] ?? firstMessage(serverErrors?.[field])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const next: FieldErrors = {}
    if (!displayText(current).trim()) next.current_location = 'Where is the truck right now?'
    if (!displayText(pickup).trim()) next.pickup_location = 'Where do you load?'
    if (!displayText(dropoff).trim()) next.dropoff_location = 'Where do you unload?'
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

  const clear = (field: keyof PlanRequest) =>
    setErrors((prev) => {
      const next = { ...prev }
      delete next[field]
      return next
    })

  const cycleNumber = Math.min(70, Math.max(0, Number(cycle) || 0))
  const hoursLeft = (70 - cycleNumber).toFixed(2).replace(/\.?0+$/, '')

  return (
    <form onSubmit={submit} noValidate className="space-y-8">
      <Section title="Route" description="Where the truck is, and where it loads and unloads.">
        <LocationInput
          label="Current location"
          icon={<CircleDot className="size-[18px] text-ink" />}
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
          hint="1 h on duty"
          icon={<Package className="size-[18px] text-pin-pickup" />}
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
          hint="1 h on duty"
          icon={<Flag className="size-[18px] text-ink" />}
          placeholder="Where you unload"
          value={dropoff}
          onChange={(v) => {
            setDropoff(v)
            clear('dropoff_location')
          }}
          error={fieldError('dropoff_location')}
        />
      </Section>

      <div className="h-px bg-line" aria-hidden />

      <Section title="Driver status" description="On-duty hours already used in the current 70-hour / 8-day cycle.">
        <div>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <label htmlFor="cycle" className="text-sm font-semibold">
              Cycle hours used
            </label>
            <span className="text-[13px] text-muted">
              <span className="font-semibold text-ink tabular-nums">{hoursLeft} h</span> left in cycle
            </span>
          </div>
          <div className="flex items-center gap-4">
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
              className="h-2 flex-1 cursor-pointer accent-accent"
            />
            <div
              className={`flex w-28 items-center rounded-field border bg-surface pr-3.5 transition-[border-color,box-shadow] focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/12 ${
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
                className="h-12 w-full min-w-0 bg-transparent pl-4 text-[15px] font-semibold tabular-nums outline-none"
              />
              <span className="text-[13px] text-subtle">hrs</span>
            </div>
          </div>
          {fieldError('current_cycle_used_hrs') && (
            <p className="mt-2 text-[13px] font-medium text-status-restart">{fieldError('current_cycle_used_hrs')}</p>
          )}
        </div>

        <div>
          <label htmlFor="start" className="mb-2 flex items-baseline justify-between gap-2 text-sm font-semibold">
            Departure
            <span className="text-xs font-medium text-subtle">local time at current location</span>
          </label>
          <div className="flex items-center gap-3 rounded-field border border-line bg-surface px-4 transition-[border-color,box-shadow] hover:border-line-strong focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/12">
            <Clock className="size-[18px] shrink-0 text-muted" aria-hidden />
            <input
              id="start"
              type="datetime-local"
              step={900}
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="h-12 w-full min-w-0 bg-transparent text-[15px] font-medium tabular-nums outline-none"
            />
          </div>
          {fieldError('start_at') && (
            <p className="mt-2 text-[13px] font-medium text-status-restart">{fieldError('start_at')}</p>
          )}
        </div>
      </Section>

      <button
        type="submit"
        disabled={pending}
        className="group flex h-13 w-full items-center justify-center gap-2 rounded-field bg-accent text-[15px] font-bold text-white shadow-[0_6px_20px_rgb(37_99_235/0.28)] transition hover:bg-accent-strong active:translate-y-px disabled:cursor-wait disabled:opacity-80"
      >
        {pending ? (
          <>
            <Loader2 className="size-5 animate-spin" aria-hidden /> Planning your trip…
          </>
        ) : (
          <>
            Plan trip &amp; draw logs
            <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </>
        )}
      </button>

      <div>
        <p className="mb-3 text-xs font-bold tracking-[0.08em] text-subtle uppercase">Or load a sample</p>
        <div className="flex flex-wrap gap-2">
          {SAMPLES.map((sample) => (
            <button
              key={sample.name}
              type="button"
              disabled={pending}
              onClick={() => onSample(sample)}
              title={`${sample.route}: ${sample.shows}`}
              className="rounded-full border border-line bg-surface px-3.5 py-2 text-[13px] font-semibold text-muted transition hover:border-accent/40 hover:bg-accent-soft hover:text-accent-strong disabled:opacity-50"
            >
              {sample.name}
            </button>
          ))}
        </div>
      </div>
    </form>
  )
}
