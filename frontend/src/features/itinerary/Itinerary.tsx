import { formatDate, formatHours, formatTime } from '../../lib/format'
import { STATUS_META, STOP_META } from '../../lib/status'
import type { DutyEvent, TripPlan } from '../../lib/types'

type Props = {
  plan: TripPlan
  activeStopId: string | null
  onStopHover: (id: string | null) => void
}

const dayKey = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))

export function Itinerary({ plan, activeStopId, onStopHover }: Props) {
  const tz = plan.summary.timezone
  const groups = new Map<string, { event: DutyEvent; index: number }[]>()
  plan.events.forEach((event, index) => {
    const key = dayKey(event.start_at, tz)
    groups.set(key, [...(groups.get(key) ?? []), { event, index }])
  })

  return (
    <section aria-labelledby="itinerary-title" className="rounded-card border border-line bg-surface">
      <header className="border-b border-line px-4 py-3">
        <h2 id="itinerary-title" className="text-sm font-semibold">
          Itinerary
        </h2>
        <p className="text-xs text-muted">Every duty change, in {plan.summary.timezone.replace('_', ' ')} time</p>
      </header>
      <ol className="max-h-[560px] overflow-y-auto px-2 py-2">
        <li className="flex items-center gap-3 rounded-lg px-2 py-2">
          <Dot color={STOP_META.start.color} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Depart {plan.places.current.short}</p>
          </div>
          <time className="font-mono text-xs text-muted tabular-nums">{formatTime(plan.summary.start_at, tz)}</time>
        </li>
        {[...groups.entries()].map(([day, items]) => (
          <li key={day}>
            <p className="sticky top-0 z-10 bg-surface/95 px-2 pt-3 pb-1 text-[11px] font-semibold tracking-wide text-muted uppercase backdrop-blur">
              {formatDate(day)}
            </p>
            <ol>
              {items.map(({ event, index }) => {
                const stopId = event.kind === 'drive' ? null : `s${index}`
                const meta = STOP_META[event.kind]
                const Icon = meta.icon
                const active = stopId !== null && stopId === activeStopId
                return (
                  <li
                    key={index}
                    onMouseEnter={() => stopId && onStopHover(stopId)}
                    onMouseLeave={() => stopId && onStopHover(null)}
                    className={`flex items-start gap-3 rounded-lg px-2 py-2 transition-colors ${
                      active ? 'bg-accent/8' : stopId ? 'hover:bg-canvas' : ''
                    }`}
                  >
                    <span
                      className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full"
                      style={{ background: `color-mix(in srgb, ${meta.color} 14%, transparent)`, color: meta.color }}
                    >
                      <Icon className="size-3.5" strokeWidth={2.4} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {event.kind === 'drive' ? `Drive ${Math.round(event.miles).toLocaleString()} mi` : event.note}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {event.kind === 'drive' ? `from ${event.location}` : event.location} ·{' '}
                        <span style={{ color: STATUS_META[event.status].color }}>{STATUS_META[event.status].short}</span>{' '}
                        {formatHours(event.duration_hrs)}
                      </p>
                    </div>
                    <time className="font-mono text-xs whitespace-nowrap text-muted tabular-nums">
                      {formatTime(event.start_at, tz)}
                    </time>
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

function Dot({ color }: { color: string }) {
  return <span className="mx-1.5 size-3 shrink-0 rounded-full ring-4 ring-white" style={{ background: color }} />
}
