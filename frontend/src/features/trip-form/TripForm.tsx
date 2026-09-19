import { ArrowRight, Clock, Flag, Loader2, Minus, Package, Plus } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { nextQuarterHourLocal } from '../../lib/format'
import { displayText } from '../../lib/place'
import type { PlaceInput, PlanRequest } from '../../lib/types'
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

const clamp = (n: number) => Math.min(70, Math.max(0, n))
const fmt = (n: number) => n.toFixed(2).replace(/\.?0+$/, '') || '0'

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
    if (!displayText(current).trim()) next.current_location = 'Where is the truck right now?'
    if (!displayText(pickup).trim()) next.pickup_location = 'Where do you load?'
    if (!displayText(dropoff).trim()) next.dropoff_location = 'Where do you unload?'
    const hours = Number(cycle)
    if (cycle.trim() === '' || !Number.isFinite(hours) || hours < 0 || hours > 70) {
      next.current_cycle_used_hrs = 'Enter 0 to 70 hours.'
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

  const cycleNumber = clamp(Number(cycle) || 0)
  const step = (delta: number) => {
    setCycle(fmt(clamp(Math.round((cycleNumber + delta) * 4) / 4)))
    clear('current_cycle_used_hrs')
  }
  const cycleError = fieldError('current_cycle_used_hrs')

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {/* Route: three stops on a rail */}
      <div className="relative rounded-2xl border border-line bg-surface">
        <span aria-hidden className="absolute top-8 bottom-8 left-[37px] border-l-2 border-dashed border-line-strong" />
        <div className="divide-y divide-line">
          <LocationInput
            label="Current location"
            marker={<span className="size-3 rounded-full border-[3px] border-ink" />}
            placeholder="Where is the truck now?"
            value={current}
            onChange={(v) => {
              setCurrent(v)
              clear('current_location')
            }}
            error={fieldError('current_location')}
          />
          <LocationInput
            label="Pickup · 1 h loading"
            marker={<Package className="size-4 text-pin-pickup" aria-hidden />}
            placeholder="Where do you load?"
            value={pickup}
            onChange={(v) => {
              setPickup(v)
              clear('pickup_location')
            }}
            error={fieldError('pickup_location')}
          />
          <LocationInput
            label="Dropoff · 1 h unloading"
            marker={<Flag className="size-4 text-ink" aria-hidden />}
            placeholder="Where do you unload?"
            value={dropoff}
            onChange={(v) => {
              setDropoff(v)
              clear('dropoff_location')
            }}
            error={fieldError('dropoff_location')}
          />
        </div>
      </div>

      {/* Driver: cycle + departure */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className={`rounded-2xl border bg-surface px-5 py-4 ${cycleError ? 'border-status-restart' : 'border-line'}`}>
          <label htmlFor="cycle" className="block text-[11px] font-bold tracking-[0.08em] text-subtle uppercase">
            Cycle hours used
          </label>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              aria-label="Decrease by half an hour"
              onClick={() => step(-0.5)}
              className="grid size-9 shrink-0 place-items-center rounded-full bg-canvas text-muted ring-1 ring-line transition hover:text-ink"
            >
              <Minus className="size-4" aria-hidden />
            </button>
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
              className="h-9 w-full min-w-0 bg-transparent text-center text-xl font-extrabold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              type="button"
              aria-label="Increase by half an hour"
              onClick={() => step(0.5)}
              className="grid size-9 shrink-0 place-items-center rounded-full bg-canvas text-muted ring-1 ring-line transition hover:text-ink"
            >
              <Plus className="size-4" aria-hidden />
            </button>
          </div>
          <p className={`mt-2 text-center text-xs ${cycleError ? 'font-medium text-status-restart' : 'text-muted'}`}>
            {cycleError ?? (
              <>
                <span className="font-bold text-ink">{fmt(70 - cycleNumber)} h</span> left of 70
              </>
            )}
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-surface px-5 py-4 focus-within:border-accent">
          <label htmlFor="start" className="block text-[11px] font-bold tracking-[0.08em] text-subtle uppercase">
            Departure
          </label>
          <div className="mt-2 flex h-9 items-center gap-2">
            <Clock className="size-4 shrink-0 text-subtle" aria-hidden />
            <input
              id="start"
              type="datetime-local"
              step={900}
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="w-full min-w-0 bg-transparent text-[15px] font-semibold tabular-nums outline-none"
            />
          </div>
          <p className="mt-2 text-xs text-muted">{fieldError('start_at') ?? 'Local time where the truck is'}</p>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="group flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-accent text-base font-bold text-white shadow-[0_8px_24px_rgb(37_99_235/0.3)] transition hover:bg-accent-strong active:translate-y-px disabled:cursor-wait disabled:opacity-80"
      >
        {pending ? (
          <>
            <Loader2 className="size-5 animate-spin" aria-hidden /> Planning…
          </>
        ) : (
          <>
            Plan trip
            <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </>
        )}
      </button>
    </form>
  )
}
