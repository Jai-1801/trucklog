import { AlertTriangle, CalendarDays, Clock3, Flag, Gauge } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { formatDayTime, formatHours, formatMiles, timeZoneAbbr } from '../../lib/format'
import type { TripPlan } from '../../lib/types'

function Stat({ icon: Icon, label, value, sub }: { icon: LucideIcon; label: string; value: string; sub: string }) {
  return (
    <div className="min-w-0 rounded-card border border-line bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
      <dt className="flex items-center gap-2 text-[13px] font-semibold text-muted">
        <Icon className="size-4 text-subtle" aria-hidden />
        {label}
      </dt>
      <dd className="mt-3 truncate text-2xl font-extrabold tracking-tight tabular-nums">{value}</dd>
      <dd className="mt-1 text-[13px] leading-snug text-pretty text-muted">{sub}</dd>
    </div>
  )
}

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
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat icon={Gauge} label="Distance" value={formatMiles(s.total_miles)} sub={`${Math.round(plan.route.legs[0].miles)} mi to pickup`} />
        <Stat icon={Clock3} label="Driving time" value={formatHours(s.driving_hrs)} sub={`${formatHours(s.on_duty_hrs)} on duty in total`} />
        <Stat
          icon={Flag}
          label="Arrives"
          value={formatDayTime(s.dropoff_at, tz)}
          sub={`${timeZoneAbbr(s.dropoff_at, tz)} · ${formatHours(s.trip_hrs)} door to door`}
        />
        <Stat
          icon={CalendarDays}
          label="Daily logs"
          value={`${s.days} ${s.days === 1 ? 'day' : 'days'}`}
          sub={restStops.length ? restStops.join(' · ') : 'No stops needed'}
        />
      </dl>
      {plan.warnings.map((warning) => (
        <p
          key={warning}
          role="status"
          className="flex items-start gap-3 rounded-card border border-status-on/30 bg-status-on/8 px-5 py-4 text-sm leading-relaxed font-medium"
        >
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-status-on" aria-hidden />
          {warning}
        </p>
      ))}
    </div>
  )
}
