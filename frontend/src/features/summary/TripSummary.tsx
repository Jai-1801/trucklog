import { formatDayTime, formatHours, formatMiles, timeZoneAbbr } from '../../lib/format'
import type { TripPlan } from '../../lib/types'

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="min-w-0 bg-surface px-5 py-4">
      <dt className="text-[11px] font-bold tracking-[0.08em] text-subtle uppercase">{label}</dt>
      <dd className="mt-1.5 truncate text-xl font-extrabold tracking-tight tabular-nums">{value}</dd>
      <dd className="mt-0.5 text-[13px] leading-snug text-pretty text-muted">{sub}</dd>
    </div>
  )
}

/** The trip's headline numbers, in one compact strip. */
export function TripSummary({ plan }: { plan: TripPlan }) {
  const s = plan.summary
  const tz = s.timezone
  const stops = s.stop_counts
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
  const restStops = [
    stops.fuel && plural(stops.fuel, 'fuel stop'),
    stops.break && plural(stops.break, 'break'),
    stops.rest && plural(stops.rest, 'rest'),
    stops.restart && plural(stops.restart, 'restart'),
  ].filter(Boolean)

  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
      <Stat label="Distance" value={formatMiles(s.total_miles)} sub={`${Math.round(plan.route.legs[0].miles)} mi to pickup`} />
      <Stat label="Driving" value={formatHours(s.driving_hrs)} sub={`${formatHours(s.on_duty_hrs)} on duty in total`} />
      <Stat
        label="Arrives"
        value={formatDayTime(s.dropoff_at, tz)}
        sub={`${timeZoneAbbr(s.dropoff_at, tz)} · ${formatHours(s.trip_hrs)} door to door`}
      />
      <Stat
        label="Duration"
        value={`${s.days} ${s.days === 1 ? 'day' : 'days'}`}
        sub={restStops.length ? restStops.join(' · ') : 'No rests needed'}
      />
    </dl>
  )
}
