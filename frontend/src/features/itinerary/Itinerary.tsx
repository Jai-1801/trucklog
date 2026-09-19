import { formatDate, formatHours, formatTime } from '../../lib/format'
import { STATUS_META } from '../../lib/status'
import type { DutyEvent, TripPlan } from '../../lib/types'

type Props = {
  plan: TripPlan
  activeStopId: string | null
  onStopHover: (id: string | null) => void
}

const dayKey = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))

function title(event: DutyEvent): string {
  return event.kind === 'drive' ? `Drive ${Math.round(event.miles).toLocaleString()} mi` : event.note
}

/** Every duty change as a timetable: time, status, what and where. */
export function Itinerary({ plan, activeStopId, onStopHover }: Props) {
  const tz = plan.summary.timezone
  const groups = new Map<string, { event: DutyEvent; index: number }[]>()
  plan.events.forEach((event, index) => {
    const key = dayKey(event.start_at, tz)
    groups.set(key, [...(groups.get(key) ?? []), { event, index }])
  })

  return (
    <section aria-labelledby="itinerary-title" className="flex h-full flex-col overflow-hidden rounded-card border border-line">
      <header className="border-b border-line px-5 py-4">
        <h2 id="itinerary-title" className="text-[15px] font-semibold">
          Itinerary
        </h2>
        <p className="mt-0.5 text-[13px] text-muted">Times in {tz.replace('_', ' ')} (home terminal)</p>
      </header>
      <ol className="max-h-[520px] min-h-0 flex-1 overflow-y-auto pb-3 lg:max-h-none">
        <li className="grid grid-cols-[64px_10px_minmax(0,1fr)] items-baseline gap-3 px-5 pt-4 pb-2">
          <time className="text-[13px] text-muted tabular-nums">{formatTime(plan.summary.start_at, tz)}</time>
          <span className="size-2.5 translate-y-px rounded-full border-2 border-ink" aria-hidden />
          <span className="text-sm font-medium">Depart {plan.places.current.short}</span>
        </li>
        {[...groups.entries()].map(([day, items]) => (
          <li key={day}>
            <p className="sticky top-0 z-10 border-b border-line bg-surface px-5 pt-4 pb-2 text-[13px] font-semibold">
              {formatDate(day)}
            </p>
            <ol>
              {items.map(({ event, index }) => {
                const stopId = event.kind === 'drive' ? null : `s${index}`
                const active = stopId !== null && stopId === activeStopId
                const status = STATUS_META[event.status]
                return (
                  <li
                    key={index}
                    onMouseEnter={() => stopId && onStopHover(stopId)}
                    onMouseLeave={() => stopId && onStopHover(null)}
                    className={`grid grid-cols-[64px_10px_minmax(0,1fr)] items-baseline gap-3 px-5 py-2.5 transition-colors ${
                      active ? 'bg-accent-soft' : stopId ? 'hover:bg-canvas' : ''
                    }`}
                  >
                    <time className="text-[13px] text-muted tabular-nums">{formatTime(event.start_at, tz)}</time>
                    <span
                      className="size-2.5 translate-y-px rounded-[2px]"
                      style={{ background: status.color }}
                      title={status.label}
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{title(event)}</span>
                      <span className="mt-0.5 block truncate text-[13px] text-muted">
                        {event.kind === 'drive' ? `From ${event.location}` : event.location} · {status.short}{' '}
                        {formatHours(event.duration_hrs)}
                      </span>
                    </span>
                  </li>
                )
              })}
            </ol>
          </li>
        ))}
      </ol>
    </section>
  )
}
