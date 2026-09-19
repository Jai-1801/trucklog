import { useMutation } from '@tanstack/react-query'
import { Truck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { GithubMark } from './components/GithubMark'
import { EntryScreen } from './features/entry/EntryScreen'
import { Preloader } from './features/results/Preloader'
import { ResultsView } from './features/results/ResultsView'
import { ApiError, planTrip } from './lib/api'
import { displayText } from './lib/place'
import { type LogDetails, loadDetails, saveDetails } from './lib/details'
import { detailsFromSearch, fromSearch, toSearch } from './lib/shareUrl'
import type { PlanRequest, TripPlan } from './lib/types'

const sharedRequest = fromSearch(window.location.search)
const initialDetails = detailsFromSearch(window.location.search) ?? loadDetails()

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
  // Bumping the key remounts the form with new starting values (shared link, edit).
  const [form, setForm] = useState({ key: 0, initial: sharedRequest ?? undefined })
  const [details, setDetails] = useState<LogDetails>(initialDetails)
  const detailsRef = useRef(details)

  const mutation = useMutation<TripPlan, ApiError, PlanRequest>({
    mutationFn: planTrip,
    onSuccess: (_plan, request) => {
      window.history.replaceState(null, '', toSearch(request, detailsRef.current))
      setEditing(false)
      window.scrollTo({ top: 0 })
    },
  })

  const updateDetails = (next: LogDetails) => {
    detailsRef.current = next
    setDetails(next)
    saveDetails(next)
    if (lastRequest && mutation.isSuccess) window.history.replaceState(null, '', toSearch(lastRequest, next))
  }

  const submit = (request: PlanRequest, nextDetails: LogDetails = detailsRef.current) => {
    updateDetails(nextDetails)
    setLastRequest(request)
    setForm((f) => ({ key: f.key, initial: request }))
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
      <header className="border-b border-line print:hidden">
        <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center px-6 lg:px-10">
          <button
            type="button"
            onClick={() => (plan ? edit() : window.scrollTo({ top: 0 }))}
            className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em]"
          >
            <Truck className="size-[18px] text-accent" strokeWidth={2.2} aria-hidden />
            TruckLog
          </button>
          <a
            href="https://github.com/Jai-1801/trucklog"
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-ink"
          >
            <GithubMark className="size-4" />
            <span className="hidden sm:inline">GitHub</span>
          </a>
        </div>
      </header>

      <main className="flex-1">
        {showResults ? (
          <ResultsView
            key={plan.summary.start_at + plan.summary.total_miles}
            plan={plan}
            details={details}
            onDetailsChange={updateDetails}
            onEdit={edit}
          />
        ) : (
          <EntryScreen
            formKey={form.key}
            initial={form.initial}
            initialDetails={details}
            onSubmit={submit}
            onRetry={lastRequest ? () => submit(lastRequest) : undefined}
            pending={mutation.isPending}
            error={mutation.error}
            editing={editing}
          />
        )}
      </main>

      {mutation.isPending && <Preloader route={lastRequest ? routeLabel(lastRequest) : undefined} />}

      <footer className="border-t border-line print:hidden">
        <p className="mx-auto max-w-[1200px] px-6 py-6 text-[13px] text-subtle lg:px-10">
          Planning aid based on the FMCSA Interstate Truck Driver’s Guide to Hours of Service. Routing by
          OpenRouteService.
        </p>
      </footer>
    </div>
  )
}
