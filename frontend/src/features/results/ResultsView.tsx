import { ArrowLeft, Check, Link2, Printer } from 'lucide-react'
import { type KeyboardEvent, useState } from 'react'
import type { LogDetails } from '../../lib/details'
import type { TripPlan } from '../../lib/types'
import { LogSheets } from '../eld-log/LogSheets'
import { Itinerary } from '../itinerary/Itinerary'
import { DetailsFields } from '../trip-form/DetailsFields'
import { RouteMap } from '../route-map/RouteMap'
import { Assumptions } from '../summary/Assumptions'
import { TripSummary } from '../summary/TripSummary'

type Tab = 'route' | 'logs' | 'rules'

const secondaryButton =
  'inline-flex h-9 items-center gap-2 rounded-field border border-line-strong px-3.5 text-sm font-medium transition-colors hover:bg-canvas'

type Props = {
  plan: TripPlan
  details: LogDetails
  onDetailsChange: (details: LogDetails) => void
  onEdit: () => void
}

export function ResultsView({ plan, details, onDetailsChange, onEdit }: Props) {
  const [tab, setTab] = useState<Tab>('route')
  const [activeStopId, setActiveStopId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const { current, pickup, dropoff } = plan.places
  const sheets = plan.days.length

  const tabs: { id: Tab; label: string }[] = [
    { id: 'route', label: 'Route and stops' },
    { id: 'logs', label: `Daily logs (${sheets})` },
    { id: 'rules', label: 'How it’s planned' },
  ]

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy this link:', window.location.href)
    }
  }

  const onTabKey = (e: KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.id === tab)
    if (e.key === 'ArrowRight') setTab(tabs[(i + 1) % tabs.length].id)
    if (e.key === 'ArrowLeft') setTab(tabs[(i - 1 + tabs.length) % tabs.length].id)
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 py-8 lg:px-10 lg:py-12 print:p-0">
      <div className="print:hidden">
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="size-4" aria-hidden /> Edit trip
        </button>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
          <h1 className="min-w-0 text-[26px] leading-tight font-semibold tracking-[-0.02em] sm:text-[30px]">
            {current.short} <span className="text-subtle">→</span> {pickup.short} <span className="text-subtle">→</span>{' '}
            {dropoff.short}
          </h1>
          <div className="flex gap-2">
            <button type="button" onClick={share} className={secondaryButton}>
              {copied ? <Check className="size-4 text-pin-pickup" aria-hidden /> : <Link2 className="size-4" aria-hidden />}
              {copied ? 'Link copied' : 'Share link'}
            </button>
            <button type="button" onClick={() => window.print()} className={secondaryButton}>
              <Printer className="size-4" aria-hidden /> Print logs
            </button>
          </div>
        </div>

        <div className="mt-8">
          <TripSummary plan={plan} />
        </div>

        {plan.warnings.map((warning) => (
          <p key={warning} role="status" className="mt-4 border-l-2 border-accent bg-accent-soft px-4 py-3 text-sm">
            {warning}
          </p>
        ))}

        <div role="tablist" aria-label="Trip plan" onKeyDown={onTabKey} className="mt-10 flex gap-8 overflow-x-auto border-b border-line">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              tabIndex={tab === t.id ? 0 : -1}
              onClick={() => setTab(t.id)}
              className={`-mb-px shrink-0 border-b-2 pb-3 text-[15px] font-medium transition-colors ${
                tab === t.id ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Panels stay mounted: the map keeps its view, and printing works from any tab. */}
      <div
        role="tabpanel"
        id="panel-route"
        aria-labelledby="tab-route"
        className={`mt-8 print:hidden ${tab === 'route' ? '' : 'hidden'}`}
      >
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section
            aria-label="Route map"
            className="relative h-[56vh] min-h-[360px] overflow-hidden rounded-card border border-line lg:h-[560px]"
          >
            <RouteMap plan={plan} activeStopId={activeStopId} onStopHover={setActiveStopId} />
          </section>
          <div className="lg:h-[560px]">
            <Itinerary plan={plan} activeStopId={activeStopId} onStopHover={setActiveStopId} />
          </div>
        </div>
        <p className="mt-6 text-sm text-muted">
          {sheets} daily log sheet{sheets === 1 ? ' is' : 's are'} filled in from this plan.{' '}
          <button
            type="button"
            onClick={() => {
              setTab('logs')
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            className="font-semibold text-accent-strong hover:underline"
          >
            View daily logs
          </button>
        </p>
      </div>

      <div
        role="tabpanel"
        id="panel-logs"
        aria-labelledby="tab-logs"
        className={`mt-8 print:mt-0 print:block ${tab === 'logs' ? '' : 'hidden'}`}
      >
        <details
          className="group mb-8 rounded-card border border-line print:hidden"
          open={!Object.values(details).some((v) => v.trim())}
        >
          <summary className="flex cursor-pointer list-none items-baseline justify-between gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
            <span>
              <span className="block text-[15px] font-semibold">Sheet details</span>
              <span className="mt-0.5 block text-[13px] text-muted">
                Driver, carrier, truck and shipping info. Changes appear on every sheet as you type.
              </span>
            </span>
            <span className="shrink-0 text-[13px] font-semibold text-accent-strong group-open:hidden">Edit</span>
            <span className="hidden shrink-0 text-[13px] font-semibold text-muted group-open:inline">Done</span>
          </summary>
          <div className="border-t border-line px-5 py-5">
            <DetailsFields value={details} onChange={onDetailsChange} />
          </div>
        </details>
        <LogSheets plan={plan} details={details} />
      </div>

      <div
        role="tabpanel"
        id="panel-rules"
        aria-labelledby="tab-rules"
        className={`mt-8 print:hidden ${tab === 'rules' ? '' : 'hidden'}`}
      >
        <Assumptions items={plan.assumptions} />
      </div>
    </div>
  )
}
