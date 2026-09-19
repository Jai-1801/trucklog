import { AlertTriangle } from 'lucide-react'
import { formatDayTime, formatHours, formatMiles, timeZoneAbbr } from '../../lib/format'
import type { TripPlan } from '../../lib/types'

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0 bg-surface px-4 py-3">
      <dt className="text-[11px] font-medium tracking-wide text-muted uppercase">{label}</dt>
      <dd className="mt-0.5 truncate font-mono text-lg font-semibold tabular-nums">{value}</dd>
      {sub && <dd className="truncate text-xs text-muted">{sub}</dd>}
    </div>
  )
}

export function TripSummary({ plan }: { plan: TripPlan }) {
  const s = plan.summary
  const tz = s.timezone
  const stops = s.stop_counts
  const restStops = [
    stops.fuel && `${stops.fuel} fuel`,
    stops.break && `${stops.break} break${stops.break > 1 ? 's' : ''}`,
    stops.rest && `${stops.rest} rest${stops.rest > 1 ? 's' : ''}`,
    stops.restart && `${stops.restart} restart`,
  ].filter(Boolean)

  return (
    <section aria-label="Trip summary" className="space-y-3">
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-4">
        <Stat label="Distance" value={formatMiles(s.total_miles)} sub={`${plan.route.legs[0].miles.toFixed(0)} mi to pickup`} />
        <Stat label="Driving" value={formatHours(s.driving_hrs)} sub={`${formatHours(s.on_duty_hrs)} on duty`} />
        <Stat
          label="Arrive"
          value={formatDayTime(s.dropoff_at, tz)}
          sub={`${timeZoneAbbr(s.dropoff_at, tz)} · ${formatHours(s.trip_hrs)} total`}
        />
        <Stat
          label="Log sheets"
          value={`${s.days} day${s.days > 1 ? 's' : ''}`}
          sub={restStops.length ? restStops.join(' · ') : 'No stops needed'}
        />
      </dl>
      {plan.warnings.map((warning) => (
        <p
          key={warning}
          role="status"
          className="flex items-start gap-2 rounded-lg border border-status-on/30 bg-status-on/8 px-3 py-2 text-sm text-ink"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-status-on" aria-hidden />
          {warning}
        </p>
      ))}
    </section>
  )
}
