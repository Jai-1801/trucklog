import { formatDayTime, formatHours, formatMiles, timeZoneAbbr } from '../../lib/format'
import type { TripPlan } from '../../lib/types'

function Figure({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="min-w-0 py-5 lg:px-6 lg:first:pl-0 lg:[&:not(:first-child)]:border-l lg:[&:not(:first-child)]:border-line">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="mt-1 text-[22px] leading-tight font-semibold tracking-[-0.02em] tabular-nums">{value}</dd>
      <dd className="mt-1 text-[13px] leading-snug text-muted">{sub}</dd>
    </div>
  )
}

/** The trip's headline numbers, in one row between rules. */
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
    <dl className="grid grid-cols-2 gap-x-6 border-y border-line lg:grid-cols-4 lg:gap-x-0">
      <Figure label="Distance" value={formatMiles(s.total_miles)} sub={`${Math.round(plan.route.legs[0].miles)} mi to pickup`} />
      <Figure label="Driving" value={formatHours(s.driving_hrs)} sub={`${formatHours(s.on_duty_hrs)} on duty in total`} />
      <Figure
        label="Arrives"
        value={formatDayTime(s.dropoff_at, tz)}
        sub={`${timeZoneAbbr(s.dropoff_at, tz)}, ${formatHours(s.trip_hrs)} door to door`}
      />
      <Figure
        label="Duration"
        value={`${s.days} ${s.days === 1 ? 'day' : 'days'}`}
        sub={restStops.length ? restStops.join(', ') : 'No rests needed'}
      />
    </dl>
  )
}
