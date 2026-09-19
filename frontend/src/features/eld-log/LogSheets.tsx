import { ChevronLeft, ChevronRight } from 'lucide-react'
import { type KeyboardEvent, useState } from 'react'
import { formatDate, formatDecimalHours } from '../../lib/format'
import { STATUS_META } from '../../lib/status'
import type { DutyStatus, TripPlan } from '../../lib/types'
import type { LogDetails } from '../../lib/details'
import { LogSheet } from './LogSheet'

const ORDER: DutyStatus[] = ['OFF', 'SB', 'D', 'ON']

export function LogSheets({ plan, details }: { plan: TripPlan; details: LogDetails }) {
  const [active, setActive] = useState(0)
  const days = plan.days
  const day = days[Math.min(active, days.length - 1)]

  const go = (i: number) => setActive(Math.max(0, Math.min(days.length - 1, i)))
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') go(active + 1)
    if (e.key === 'ArrowLeft') go(active - 1)
  }

  const stepButton =
    'grid size-9 shrink-0 place-items-center rounded-field border border-line-strong text-muted transition-colors hover:bg-canvas hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent'

  return (
    <section aria-labelledby="logs-title" className="print-area min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 print:hidden">
        <div className="min-w-0">
          <h2 id="logs-title" className="text-lg font-semibold tracking-[-0.01em]">
            Day {day.day_number} of {days.length}
            <span className="font-normal text-muted"> · {formatDate(day.date)}</span>
          </h2>
          <p className="mt-1 text-[13px] text-muted tabular-nums">
            {Math.round(day.total_miles_driving).toLocaleString()} mi driven
            {ORDER.map((status) => (
              <span key={status}>
                {' · '}
                {STATUS_META[status].short} {formatDecimalHours(day.totals[status])} h
              </span>
            ))}
            {' · '}
            <span className="text-ink">{formatDecimalHours(day.recap.b_available_tomorrow)} h available tomorrow</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" aria-label="Previous day" disabled={active === 0} onClick={() => go(active - 1)} className={stepButton}>
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <div
            role="tablist"
            aria-label="Log sheet days"
            onKeyDown={onKeyDown}
            className="flex max-w-[60vw] overflow-x-auto rounded-field border border-line-strong"
          >
            {days.map((d, i) => (
              <button
                key={d.date}
                role="tab"
                id={`log-tab-${i}`}
                aria-selected={i === active}
                aria-controls={`log-panel-${i}`}
                tabIndex={i === active ? 0 : -1}
                onClick={() => setActive(i)}
                title={formatDate(d.date)}
                className={`h-9 min-w-9 shrink-0 px-3 text-sm font-medium tabular-nums transition-colors [&:not(:first-child)]:border-l [&:not(:first-child)]:border-line-strong ${
                  i === active ? 'bg-ink text-white' : 'text-muted hover:bg-canvas hover:text-ink'
                }`}
              >
                {d.day_number}
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-label="Next day"
            disabled={active === days.length - 1}
            onClick={() => go(active + 1)}
            className={stepButton}
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      {day.totals.D > 11 && (
        <p className="mt-4 border-l-2 border-accent pl-3 text-[13px] leading-relaxed text-muted print:hidden">
          {formatDecimalHours(day.totals.D)} h of driving on one calendar day is legal here: it spans two duty periods
          with a 10-hour rest between them, and the 11-hour limit applies per duty period.
        </p>
      )}

      <div className="mt-6 overflow-x-auto rounded-card border border-line print:mt-0 print:overflow-visible print:rounded-none print:border-0">
        {days.map((d, i) => (
          <div
            key={d.date}
            role="tabpanel"
            id={`log-panel-${i}`}
            aria-labelledby={`log-tab-${i}`}
            className={`log-page min-w-[720px] print:min-w-0 ${i === active ? '' : 'hidden print:block'}`}
          >
            <LogSheet log={d} meta={details} dayCount={days.length} />
          </div>
        ))}
      </div>
      <p className="mt-3 text-[13px] text-subtle print:hidden">
        Every sheet totals exactly 24 hours. Hover the grid for exact times; use ← → to change day.
      </p>
    </section>
  )
}
