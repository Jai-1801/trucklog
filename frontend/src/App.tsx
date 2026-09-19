import { useMutation } from '@tanstack/react-query'
import { Truck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { GithubMark } from './components/GithubMark'
import { EntryScreen } from './features/entry/EntryScreen'
import { Preloader } from './features/results/Preloader'
import { ResultsView } from './features/results/ResultsView'
import type { Sample } from './features/trip-form/samples'
import { ApiError, planTrip } from './lib/api'
import { nextQuarterHourLocal } from './lib/format'
import { displayText } from './lib/place'
import { fromSearch, toSearch } from './lib/shareUrl'
import type { PlanRequest, TripPlan } from './lib/types'

const sharedRequest = fromSearch(window.location.search)

const routeLabel = (r: PlanRequest) =>
  [r.current_location, r.pickup_location, r.dropoff_location]
    .map((p) => (p.short ?? displayText(p)).replace(/, USA$/, ''))
    .join(' → ')

/**
 * One thing at a time: enter the trip → preloader → results workspace.
 * "Edit trip" returns to the entry screen with the same values.
 */
export default function App() {
  const [editing, setEditing] = useState(false)
  const [lastRequest, setLastRequest] = useState<PlanRequest | null>(sharedRequest)
  // Bumping the key remounts the form with new starting values (sample, shared link, edit).
  const [form, setForm] = useState({ key: 0, initial: sharedRequest ?? undefined })

  const mutation = useMutation<TripPlan, ApiError, PlanRequest>({
    mutationFn: planTrip,
    onSuccess: (_plan, request) => {
      window.history.replaceState(null, '', toSearch(request))
      setEditing(false)
      window.scrollTo({ top: 0 })
    },
  })

  const submit = (request: PlanRequest) => {
    setLastRequest(request)
    setForm((f) => ({ key: f.key, initial: request }))
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
    setLastRequest(request)
    mutation.mutate(request)
  }

  const edit = () => {
    setForm((f) => ({ key: f.key + 1, initial: lastRequest ?? undefined }))
    setEditing(true)
    window.scrollTo({ top: 0 })
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
  const showResults = plan !== undefined && !editing && !mutation.isError

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-[1100] border-b border-line bg-surface/85 backdrop-blur-md print:hidden">
        <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => (plan ? edit() : window.scrollTo({ top: 0 }))}
            className="flex items-center gap-3 rounded-xl"
            aria-label="TruckLog home"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-accent text-white shadow-[0_4px_12px_rgb(37_99_235/0.3)]">
              <Truck className="size-[18px]" aria-hidden />
            </span>
            <span className="text-left leading-tight">
              <span className="block text-[15px] font-extrabold tracking-tight">TruckLog</span>
              <span className="hidden text-xs font-medium text-muted sm:block">Trip planner &amp; FMCSA daily logs</span>
            </span>
          </button>
          <a
            href="https://github.com/Jai-1801/trucklog"
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex h-9 items-center gap-2 rounded-xl px-3 text-[13px] font-semibold text-muted transition hover:bg-canvas hover:text-ink"
          >
            <GithubMark className="size-4" />
            <span className="hidden sm:inline">Source code</span>
          </a>
        </div>
      </header>

      <main className="flex-1">
        {showResults ? (
          <ResultsView key={plan.summary.start_at + plan.summary.total_miles} plan={plan} onEdit={edit} />
        ) : (
          <EntryScreen
            formKey={form.key}
            initial={form.initial}
            onSubmit={submit}
            onSample={runSample}
            onRetry={lastRequest ? () => submit(lastRequest) : undefined}
            pending={mutation.isPending}
            error={mutation.error}
            editing={editing}
          />
        )}
      </main>

      {mutation.isPending && <Preloader route={lastRequest ? routeLabel(lastRequest) : undefined} />}

      <footer className="border-t border-line py-6 text-center text-[13px] text-subtle print:hidden">
        Planning aid based on the FMCSA Interstate Truck Driver’s Guide to Hours of Service · Routing by
        OpenRouteService
      </footer>
    </div>
  )
}
