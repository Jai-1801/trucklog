import { useMutation } from '@tanstack/react-query'
import { AlertCircle, RotateCw, Truck } from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { GithubMark } from './components/GithubMark'
import { LogSheets } from './features/eld-log/LogSheets'
import { Itinerary } from './features/itinerary/Itinerary'
import { PlanningState } from './features/results/PlanningState'
import { ResultsHeader } from './features/results/ResultsHeader'
import { Welcome } from './features/results/Welcome'
import { RouteMap } from './features/route-map/RouteMap'
import { Assumptions } from './features/summary/Assumptions'
import { TripSummary } from './features/summary/TripSummary'
import type { Sample } from './features/trip-form/samples'
import { TripForm } from './features/trip-form/TripForm'
import { ApiError, planTrip } from './lib/api'
import { nextQuarterHourLocal } from './lib/format'
import { fromSearch, toSearch } from './lib/shareUrl'
import type { PlanRequest, TripPlan } from './lib/types'

const sharedRequest = fromSearch(window.location.search)

export default function App() {
  const [activeStopId, setActiveStopId] = useState<string | null>(null)
  const [lastRequest, setLastRequest] = useState<PlanRequest | null>(sharedRequest)
  // Bumping the key remounts the form with new starting values (sample or shared link).
  const [form, setForm] = useState({ key: 0, initial: sharedRequest ?? undefined })
  const results = useRef<HTMLDivElement>(null)
  const mutation = useMutation<TripPlan, ApiError, PlanRequest>({
    mutationFn: planTrip,
    onSuccess: (_plan, request) => {
      window.history.replaceState(null, '', toSearch(request))
      // On narrow screens the form sits above the results: bring them into view.
      if (window.matchMedia('(max-width: 1023px)').matches) {
        requestAnimationFrame(() => results.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
      }
    },
  })

  const submit = (request: PlanRequest) => {
    setLastRequest(request)
    setActiveStopId(null)
    mutation.mutate(request)
  }

  const runSample = (sample: Sample) => {
    const request: PlanRequest = {
      current_location: sample.current,
      pickup_location: sample.pickup,
      dropoff_location: sample.dropoff,
      current_cycle_used_hrs: sample.cycle,
      start_at: nextQuarterHourLocal(),
    }
    setForm((f) => ({ key: f.key + 1, initial: request }))
    submit(request)
  }

  // A shared link plans its trip straight away (once, even under StrictMode).
  const started = useRef(false)
  const { mutate } = mutation
  useEffect(() => {
    if (sharedRequest && !started.current) {
      started.current = true
      mutate(sharedRequest)
    }
  }, [mutate])

  const plan = mutation.data
  const showPlan = plan !== undefined && !mutation.isPending
  const error = mutation.error
  const fieldErrors = error?.code === 'VALIDATION_ERROR' ? error.fields : undefined

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-[1100] border-b border-line bg-surface/85 backdrop-blur-md print:hidden">
        <div className="mx-auto flex h-16 max-w-[1480px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <span className="grid size-9 place-items-center rounded-xl bg-accent text-white shadow-[0_4px_12px_rgb(37_99_235/0.3)]">
            <Truck className="size-[18px]" aria-hidden />
          </span>
          <div className="leading-tight">
            <p className="text-[15px] font-extrabold tracking-tight">TruckLog</p>
            <p className="hidden text-xs font-medium text-muted sm:block">Trip planner &amp; FMCSA daily logs</p>
          </div>
          <a
            href="https://github.com/Jai-1801/trucklog"
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex h-9 items-center gap-2 rounded-field px-3 text-[13px] font-semibold text-muted transition hover:bg-canvas hover:text-ink"
          >
            <GithubMark className="size-4" />
            <span className="hidden sm:inline">Source code</span>
          </a>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1480px] gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[400px_minmax(0,1fr)] lg:gap-10 lg:px-8 lg:py-10">
        <aside className="lg:self-start print:hidden">
          <section className="rounded-card border border-line bg-surface p-6 shadow-[var(--shadow-card)] sm:p-7">
            <div className="mb-8">
              <h1 className="text-xl font-extrabold tracking-tight">Plan a trip</h1>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                Get the route, every required stop and the daily log sheets.
              </p>
            </div>
            <TripForm
              key={form.key}
              initial={form.initial}
              onSubmit={submit}
              onSample={runSample}
              pending={mutation.isPending}
              serverErrors={fieldErrors}
            />
          </section>
        </aside>

        <div ref={results} className="min-w-0 scroll-mt-20 space-y-10 print:space-y-0">
          {error && error.code !== 'VALIDATION_ERROR' && (
            <div
              role="alert"
              className="flex flex-wrap items-start gap-4 rounded-card border border-status-restart/25 bg-status-restart/5 p-5 print:hidden"
            >
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-status-restart" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold">We couldn’t plan this trip</p>
                <p className="mt-1 text-sm text-muted">{error.message}</p>
              </div>
              {lastRequest && (
                <button
                  type="button"
                  onClick={() => submit(lastRequest)}
                  className="inline-flex h-10 items-center gap-2 rounded-field border border-line bg-surface px-4 text-sm font-semibold hover:border-line-strong"
                >
                  <RotateCw className="size-4" aria-hidden /> Try again
                </button>
              )}
            </div>
          )}

          {mutation.isPending && <PlanningState />}
          {!plan && !mutation.isPending && <Welcome onSample={runSample} disabled={mutation.isPending} />}

          {showPlan && (
            <>
              <div className="print:hidden">
                <ResultsHeader plan={plan} />
              </div>

              <Block id="overview">
                <TripSummary plan={plan} />
              </Block>

              <Block id="route" title="Route & stops" description="Hover a stop in the itinerary to find it on the map.">
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                  <section
                    aria-label="Route map"
                    className="relative h-[56vh] min-h-[360px] overflow-hidden rounded-card border border-line bg-surface shadow-[var(--shadow-card)] xl:h-[560px]"
                  >
                    <RouteMap plan={plan} activeStopId={activeStopId} onStopHover={setActiveStopId} />
                  </section>
                  <div className="xl:h-[560px]">
                    <Itinerary plan={plan} activeStopId={activeStopId} onStopHover={setActiveStopId} />
                  </div>
                </div>
              </Block>

              <Block
                id="logs"
                title="Daily logs"
                description="One FMCSA record of duty status per calendar day, in home-terminal time."
              >
                <LogSheets key={plan.summary.start_at + plan.summary.total_miles} plan={plan} />
              </Block>

              <Block id="assumptions">
                <Assumptions items={plan.assumptions} />
              </Block>
            </>
          )}
        </div>
      </main>

      <footer className="mx-auto max-w-[1480px] px-4 pb-10 text-[13px] text-subtle sm:px-6 lg:px-8 print:hidden">
        Planning aid based on the FMCSA Interstate Truck Driver’s Guide to Hours of Service. Routing by OpenRouteService.
      </footer>
    </div>
  )
}

function Block({
  id,
  title,
  description,
  children,
}: {
  id: string
  title?: string
  description?: string
  children: ReactNode
}) {
  return (
    <section id={id} className={`scroll-mt-36 ${id === 'logs' ? '' : 'print:hidden'}`}>
      {title && (
        <header className="mb-5 print:hidden">
          <h2 className="text-lg font-extrabold tracking-tight">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </header>
      )}
      {children}
    </section>
  )
}
