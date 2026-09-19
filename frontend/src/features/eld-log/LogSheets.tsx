import { CheckCircle2, ChevronLeft, ChevronRight, Info, Printer } from 'lucide-react'
import { type KeyboardEvent, useState } from 'react'
import { formatDate, formatDecimalHours } from '../../lib/format'
import { STATUS_META } from '../../lib/status'
import type { DutyStatus, TripPlan } from '../../lib/types'
import { LogSheet, type SheetMeta } from './LogSheet'

function sheetMeta(plan: TripPlan): SheetMeta {
  const { current, pickup } = plan.places
  // Stable, readable shipping number derived from the trip itself.
  const seed = [...`${plan.summary.start_at}${pickup.short}`].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
  return {
    carrier: 'TruckLog Demo Freight LLC',
    mainOffice: current.short,
    homeTerminal: `${current.short} (${plan.summary.timezone.replace('_', ' ')})`,
    vehicle: 'Tractor 101 / Trailer 2201',
    shippingDoc: `BOL-${String(seed % 1_000_000).padStart(6, '0')}`,
    shipper: `Shipper at ${pickup.short} · General freight`,
  }
}

const ORDER: DutyStatus[] = ['OFF', 'SB', 'D', 'ON']

export function LogSheets({ plan }: { plan: TripPlan }) {
  const [active, setActive] = useState(0)
  const days = plan.days
  const day = days[Math.min(active, days.length - 1)]
  const meta = sheetMeta(plan)
  const allBalanced = days.every((d) => Math.abs(Object.values(d.totals).reduce((a, b) => a + b, 0) - 24) < 1e-9)

  const go = (i: number) => setActive(Math.max(0, Math.min(days.length - 1, i)))
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') go(active + 1)
    if (e.key === 'ArrowLeft') go(active - 1)
  }

  return (
    <section
      aria-labelledby="logs-title"
      className="print-area min-w-0 overflow-hidden rounded-card border border-line bg-surface shadow-[var(--shadow-card)]"
    >
      <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line px-6 py-5 print:hidden">
        <div className="mr-auto">
          <h3 id="logs-title" className="text-[15px] font-bold">
            {days.length} log sheet{days.length > 1 ? 's' : ''} for this trip
          </h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted">
            {allBalanced && <CheckCircle2 className="size-4 text-pin-pickup" aria-hidden />}
            Every sheet totals exactly 24 hours · use ← → to switch days
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex h-10 items-center gap-2 rounded-field border border-line px-4 text-sm font-semibold transition hover:border-line-strong hover:bg-canvas"
        >
          <Printer className="size-4" aria-hidden /> Print / Save PDF
        </button>
      </header>

      <div className="flex items-center gap-2 border-b border-line px-3 py-3 print:hidden">
        <button
          type="button"
          aria-label="Previous day"
          disabled={active === 0}
          onClick={() => go(active - 1)}
          className="grid size-10 shrink-0 place-items-center rounded-xl text-muted hover:bg-canvas disabled:opacity-30"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <div role="tablist" aria-label="Log sheet days" onKeyDown={onKeyDown} className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
          {days.map((d, i) => (
            <button
              key={d.date}
              role="tab"
              id={`log-tab-${i}`}
              aria-selected={i === active}
              aria-controls={`log-panel-${i}`}
              tabIndex={i === active ? 0 : -1}
              onClick={() => setActive(i)}
              className={`shrink-0 rounded-xl px-4 py-2.5 text-left transition-colors ${
                i === active ? 'bg-ink text-white' : 'text-muted hover:bg-canvas hover:text-ink'
              }`}
            >
              <span className="block text-[13px] font-bold">Day {d.day_number}</span>
              <span className={`block text-xs ${i === active ? 'text-white/70' : ''}`}>{formatDate(d.date)}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-label="Next day"
          disabled={active === days.length - 1}
          onClick={() => go(active + 1)}
          className="grid size-10 shrink-0 place-items-center rounded-xl text-muted hover:bg-canvas disabled:opacity-30"
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>

      <dl className="flex flex-wrap gap-2 px-6 pt-5 text-[13px] print:hidden">
        <div className="flex gap-1.5 rounded-full bg-canvas px-3 py-1.5 ring-1 ring-line">
          <dt className="text-muted">Miles</dt>
          <dd className="font-bold tabular-nums">{Math.round(day.total_miles_driving).toLocaleString()}</dd>
        </div>
        {ORDER.map((status) => (
          <div key={status} className="flex items-center gap-1.5 rounded-full bg-canvas px-3 py-1.5 ring-1 ring-line">
            <span className="size-2 rounded-full" style={{ background: STATUS_META[status].color }} aria-hidden />
            <dt className="text-muted">{STATUS_META[status].short}</dt>
            <dd className="font-bold tabular-nums">{formatDecimalHours(day.totals[status])} h</dd>
          </div>
        ))}
        <div className="flex gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 ring-1 ring-accent/15">
          <dt className="text-accent-strong/80">Available tomorrow</dt>
          <dd className="font-bold text-accent-strong tabular-nums">{formatDecimalHours(day.recap.b_available_tomorrow)} h</dd>
        </div>
      </dl>
      {day.totals.D > 11 && (
        <p className="mx-6 mt-4 flex items-start gap-2.5 rounded-xl bg-accent-soft px-4 py-3 text-[13px] leading-relaxed print:hidden">
          <Info className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
          <span>
            {formatDecimalHours(day.totals.D)} h of driving on this calendar day is legal: it spans two duty periods with a
            10-hour rest between them. The 11-hour limit applies per duty period, not per calendar day.
          </span>
        </p>
      )}

      <div className="overflow-x-auto p-4 sm:p-6 print:overflow-visible print:p-0">
        {days.map((d, i) => (
          <div
            key={d.date}
            role="tabpanel"
            id={`log-panel-${i}`}
            aria-labelledby={`log-tab-${i}`}
            className={`log-page min-w-[720px] overflow-hidden rounded-xl ring-1 ring-line print:min-w-0 print:rounded-none print:ring-0 ${i === active ? '' : 'hidden print:block'}`}
          >
            <LogSheet log={d} meta={meta} dayCount={days.length} />
          </div>
        ))}
      </div>
    </section>
  )
}
