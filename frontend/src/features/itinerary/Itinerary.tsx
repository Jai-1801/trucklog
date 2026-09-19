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
    <section
      aria-labelledby="itinerary-title"
      className="flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface shadow-[var(--shadow-card)]"
    >
      <header className="border-b border-line px-5 py-4">
        <h3 id="itinerary-title" className="text-[15px] font-bold">
          Itinerary
        </h3>
        <p className="mt-0.5 text-[13px] text-muted">
          Every duty change · {plan.summary.timezone.replace('_', ' ')} time
        </p>
      </header>
      <ol className="max-h-[560px] min-h-0 flex-1 overflow-y-auto p-3 xl:max-h-none">
        <li className="flex items-center gap-3 rounded-xl px-3 py-3">
          <Dot color={STOP_META.start.color} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">Depart {plan.places.current.short}</p>
          </div>
          <time className="text-[13px] font-semibold text-muted tabular-nums">{formatTime(plan.summary.start_at, tz)}</time>
        </li>
        {[...groups.entries()].map(([day, items]) => (
          <li key={day}>
            <p className="sticky top-0 z-10 bg-surface/95 px-3 pt-4 pb-2 text-[11px] font-bold tracking-[0.08em] text-subtle uppercase backdrop-blur">
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
                    className={`flex items-start gap-3 rounded-xl px-3 py-3 transition-colors ${
                      active ? 'bg-accent-soft' : stopId ? 'hover:bg-canvas' : ''
                    }`}
                  >
                    <span
                      className="grid size-8 shrink-0 place-items-center rounded-full"
                      style={{ background: `color-mix(in srgb, ${meta.color} 14%, transparent)`, color: meta.color }}
                    >
                      <Icon className="size-4" strokeWidth={2.3} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">
                        {event.kind === 'drive' ? `Drive ${Math.round(event.miles).toLocaleString()} mi` : event.note}
                      </p>
                      <p className="mt-0.5 truncate text-[13px] text-muted">
                        {event.kind === 'drive' ? `from ${event.location}` : event.location} ·{' '}
                        <span style={{ color: STATUS_META[event.status].color }}>{STATUS_META[event.status].short}</span>{' '}
                        {formatHours(event.duration_hrs)}
                      </p>
                    </div>
                    <time className="pt-0.5 text-[13px] font-semibold whitespace-nowrap text-muted tabular-nums">
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
  return <span className="mx-2.5 size-3 shrink-0 rounded-full ring-4 ring-canvas" style={{ background: color }} />
}
