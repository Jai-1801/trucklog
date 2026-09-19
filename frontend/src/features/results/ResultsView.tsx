import { AlertTriangle, ArrowLeft, ArrowRight, Check, FileText, Link2, Printer } from 'lucide-react'
import { type KeyboardEvent, useState } from 'react'
import type { TripPlan } from '../../lib/types'
import { LogSheets } from '../eld-log/LogSheets'
import { Itinerary } from '../itinerary/Itinerary'
import { RouteMap } from '../route-map/RouteMap'
import { Assumptions } from '../summary/Assumptions'
import { TripSummary } from '../summary/TripSummary'

type Tab = 'route' | 'logs' | 'rules'

export function ResultsView({ plan, onEdit }: { plan: TripPlan; onEdit: () => void }) {
  const [tab, setTab] = useState<Tab>('route')
  const [activeStopId, setActiveStopId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const { current, pickup, dropoff } = plan.places
  const sheets = plan.days.length

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'route', label: 'Route & stops' },
    { id: 'logs', label: 'Daily logs', badge: sheets },
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
    <div className="mx-auto w-full max-w-[1400px] px-4 pt-6 pb-16 sm:px-6 lg:px-8 lg:pt-8 print:p-0">
      {/* Trip header */}
      <div className="print:hidden">
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1.5 rounded-lg py-1 text-sm font-semibold text-muted transition hover:text-accent"
        >
          <ArrowLeft className="size-4" aria-hidden /> Edit trip
        </button>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <h1 className="min-w-0 text-2xl leading-tight font-extrabold tracking-tight sm:text-[30px]">
            {current.short} <span className="font-semibold text-subtle">→</span> {pickup.short}{' '}
            <span className="font-semibold text-subtle">→</span> {dropoff.short}
          </h1>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={share}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-semibold transition hover:border-line-strong"
            >
              {copied ? <Check className="size-4 text-pin-pickup" aria-hidden /> : <Link2 className="size-4" aria-hidden />}
              {copied ? 'Copied' : 'Share'}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-semibold text-white transition hover:bg-ink/90"
            >
              <Printer className="size-4" aria-hidden /> Print logs
            </button>
          </div>
        </div>

        <div className="mt-6">
          <TripSummary plan={plan} />
        </div>
        {plan.warnings.map((warning) => (
          <p
            key={warning}
            role="status"
            className="mt-3 flex items-start gap-3 rounded-2xl border border-status-on/30 bg-status-on/8 px-5 py-3.5 text-sm font-medium"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-status-on" aria-hidden />
            {warning}
          </p>
        ))}

        {/* Tabs */}
        <div
          role="tablist"
          aria-label="Trip plan"
          onKeyDown={onTabKey}
          className="mt-8 flex gap-6 overflow-x-auto border-b border-line"
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              tabIndex={tab === t.id ? 0 : -1}
              onClick={() => setTab(t.id)}
              className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 pt-1 pb-3.5 text-[15px] font-bold transition-colors ${
                tab === t.id ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {t.label}
              {t.badge !== undefined && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${tab === t.id ? 'bg-accent text-white' : 'bg-canvas text-muted ring-1 ring-line'}`}
                >
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Panels stay mounted: the map keeps its view, and printing works from any tab. */}
      <div
        role="tabpanel"
        id="panel-route"
        aria-labelledby="tab-route"
        className={`mt-6 space-y-6 print:hidden ${tab === 'route' ? '' : 'hidden'}`}
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section
            aria-label="Route map"
            className="relative h-[58vh] min-h-[380px] overflow-hidden rounded-2xl border border-line bg-surface lg:h-[600px]"
          >
            <RouteMap plan={plan} activeStopId={activeStopId} onStopHover={setActiveStopId} />
          </section>
          <div className="lg:h-[600px]">
            <Itinerary plan={plan} activeStopId={activeStopId} onStopHover={setActiveStopId} />
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setTab('logs')
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
          className="group flex w-full items-center gap-4 rounded-2xl border border-accent/20 bg-accent-soft p-5 text-left transition hover:border-accent/40"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-white">
            <FileText className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold">
              {sheets} daily log sheet{sheets === 1 ? ' is' : 's are'} ready
            </span>
            <span className="block text-sm text-muted">Filled in from this plan, one per calendar day.</span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-bold text-accent-strong">
            View logs <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </span>
        </button>
      </div>

      <div
        role="tabpanel"
        id="panel-logs"
        aria-labelledby="tab-logs"
        className={`mt-6 print:mt-0 print:block ${tab === 'logs' ? '' : 'hidden'}`}
      >
        <LogSheets plan={plan} />
      </div>

      <div
        role="tabpanel"
        id="panel-rules"
        aria-labelledby="tab-rules"
        className={`mt-6 print:hidden ${tab === 'rules' ? '' : 'hidden'}`}
      >
        <Assumptions items={plan.assumptions} />
      </div>
    </div>
  )
}
