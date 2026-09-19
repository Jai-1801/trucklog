import { useMutation } from '@tanstack/react-query'
import { AlertCircle, FileText, Map as MapIcon, RotateCw, Truck } from 'lucide-react'
import { useRef, useState } from 'react'
import { GithubMark } from './components/GithubMark'
import { LogSheets } from './features/eld-log/LogSheets'
import { Assumptions } from './features/summary/Assumptions'
import { Itinerary } from './features/itinerary/Itinerary'
import { RouteMap } from './features/route-map/RouteMap'
import { TripSummary } from './features/summary/TripSummary'
import { TripForm } from './features/trip-form/TripForm'
import { ApiError, planTrip } from './lib/api'
import type { PlanRequest, TripPlan } from './lib/types'

const LOADING_STEPS = ['Finding locations', 'Routing for trucks', 'Applying HOS rules', 'Drawing log sheets']

export default function App() {
  const [activeStopId, setActiveStopId] = useState<string | null>(null)
  const [lastRequest, setLastRequest] = useState<PlanRequest | null>(null)
  const results = useRef<HTMLDivElement>(null)
  const mutation = useMutation<TripPlan, ApiError, PlanRequest>({
    mutationFn: planTrip,
    onSuccess: () => {
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

  const plan = mutation.data
  const showPlan = plan !== undefined && !mutation.isPending
  const error = mutation.error
  const fieldErrors = error?.code === 'VALIDATION_ERROR' ? error.fields : undefined

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-[1100] border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-3 px-4">
          <span className="grid size-8 place-items-center rounded-lg bg-accent text-white shadow-sm shadow-accent/30">
            <Truck className="size-4" aria-hidden />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-tight">TruckLog</p>
            <p className="hidden text-xs text-muted sm:block">HOS-compliant trip planner · FMCSA daily logs</p>
          </div>
          <a
            href="https://github.com/Jai-1801/trucklog"
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-canvas hover:text-ink"
          >
            <GithubMark className="size-4" />
            <span className="hidden sm:inline">Source</span>
          </a>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1440px] gap-5 px-4 py-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-19 lg:self-start">
          <section className="rounded-card border border-line bg-surface p-4 shadow-sm shadow-ink/[0.03]">
            <h1 className="text-base font-semibold tracking-tight">Plan a trip</h1>
            <p className="mb-4 text-xs text-muted">Route, stops and rests under the 70-hr / 8-day rules.</p>
            <TripForm onSubmit={submit} pending={mutation.isPending} serverErrors={fieldErrors} />
          </section>
        </aside>

        <div ref={results} className="min-w-0 scroll-mt-16 space-y-5">
          {error && error.code !== 'VALIDATION_ERROR' && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-card border border-status-restart/30 bg-status-restart/5 px-4 py-3"
            >
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-status-restart" aria-hidden />
              <div className="flex-1">
                <p className="text-sm font-semibold">Couldn’t plan this trip</p>
                <p className="text-sm text-muted">{error.message}</p>
              </div>
              {lastRequest && (
                <button
                  type="button"
                  onClick={() => submit(lastRequest)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium hover:bg-canvas"
                >
                  <RotateCw className="size-3.5" aria-hidden /> Retry
                </button>
              )}
            </div>
          )}

          {showPlan && <TripSummary plan={plan} />}

          <div className={`grid gap-5 ${showPlan ? 'xl:grid-cols-[minmax(0,1fr)_340px]' : ''}`}>
            <section
              aria-label="Route map"
              className="relative h-[52vh] min-h-[340px] overflow-hidden rounded-card border border-line bg-surface lg:h-[500px]"
            >
              <RouteMap plan={plan} activeStopId={activeStopId} onStopHover={setActiveStopId} />
              {mutation.isPending && <LoadingOverlay />}
              {!plan && !mutation.isPending && <EmptyOverlay />}
            </section>
            {showPlan && (
              <div className="xl:h-[500px]">
                <Itinerary plan={plan} activeStopId={activeStopId} onStopHover={setActiveStopId} />
              </div>
            )}
          </div>

          {showPlan && <LogSheets key={plan.summary.start_at + plan.summary.total_miles} plan={plan} />}
          {showPlan && <Assumptions items={plan.assumptions} />}
        </div>
      </main>
    </div>
  )
}

function EmptyOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[500] grid place-items-center bg-gradient-to-b from-surface/70 to-surface/30 p-6">
      <div className="max-w-md rounded-card border border-line bg-surface/95 p-5 text-center shadow-lg shadow-ink/5">
        <div className="mx-auto mb-3 flex w-fit gap-2 text-accent">
          <MapIcon className="size-5" aria-hidden />
          <FileText className="size-5" aria-hidden />
        </div>
        <p className="font-semibold">Enter a trip to see the plan</p>
        <p className="mt-1 text-sm text-muted">
          You’ll get the truck route with every fuel stop, break and rest, plus a filled-in driver’s daily log for each
          day, following FMCSA Hours of Service.
        </p>
      </div>
    </div>
  )
}

function LoadingOverlay() {
  return (
    <div className="absolute inset-0 z-[500] grid place-items-center bg-surface/70 backdrop-blur-[2px]" aria-live="polite">
      <div className="w-64 rounded-card border border-line bg-surface p-4 shadow-lg shadow-ink/5">
        <p className="mb-3 text-sm font-semibold">Planning your trip…</p>
        <ol className="space-y-2">
          {LOADING_STEPS.map((step, i) => (
            <li key={step} className="flex items-center gap-2 text-sm text-muted">
              <span
                className="size-1.5 animate-pulse rounded-full bg-accent"
                style={{ animationDelay: `${i * 250}ms` }}
                aria-hidden
              />
              {step}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
