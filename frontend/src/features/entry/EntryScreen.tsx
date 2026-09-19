import type { ApiError } from '../../lib/api'
import type { PlanRequest } from '../../lib/types'
import type { LogDetails } from '../../lib/details'
import { TripForm } from '../trip-form/TripForm'

type Props = {
  formKey: number
  initial?: PlanRequest
  initialDetails: LogDetails
  onSubmit: (request: PlanRequest, details: LogDetails) => void
  onRetry?: () => void
  pending: boolean
  error: ApiError | null
  editing: boolean
}

const RULES: [string, string][] = [
  ['Driving', '11 h per duty period'],
  ['Duty window', '14 h from coming on duty'],
  ['Break', '30 min after 8 h of driving'],
  ['Daily rest', '10 h in the sleeper berth'],
  ['Cycle', '70 h in 8 days, 34 h restart'],
  ['Fuel', 'At least every 1,000 mi'],
  ['Pickup, dropoff', '1 h on duty each'],
]

export function EntryScreen({ formKey, initial, initialDetails, onSubmit, onRetry, pending, error, editing }: Props) {
  const fieldErrors = error?.code === 'VALIDATION_ERROR' ? error.fields : undefined
  const banner = error && error.code !== 'VALIDATION_ERROR' ? error : null

  return (
    <div className="mx-auto grid max-w-[1200px] gap-x-20 gap-y-12 px-6 py-12 lg:grid-cols-[minmax(0,1fr)_520px] lg:grid-rows-[auto_1fr] lg:px-10 lg:py-20">
      <div className="lg:col-start-1 lg:row-start-1">
        <h1 className="text-[32px] leading-[1.15] font-semibold tracking-[-0.025em] sm:text-[40px]">
          {editing ? 'Edit trip' : 'Plan a trip'}
        </h1>
        <p className="mt-4 max-w-[440px] text-base leading-relaxed text-muted">
          Enter where the truck is, the load, and the hours already used this cycle. TruckLog routes it for a truck,
          schedules every stop the Hours-of-Service rules require, and fills in a driver’s daily log for each day.
        </p>
      </div>

      <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
        {banner && (
          <div role="alert" className="mb-6 border-l-2 border-status-restart bg-status-restart/5 px-4 py-3">
            <p className="text-sm font-semibold">We couldn’t plan this trip</p>
            <p className="mt-1 text-sm text-muted">{banner.message}</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="mt-2 text-sm font-semibold text-accent-strong hover:underline"
              >
                Try again
              </button>
            )}
          </div>
        )}

        <div className="rounded-card border border-line p-6 sm:p-8">
          <TripForm
            key={formKey}
            initial={initial}
            initialDetails={initialDetails}
            onSubmit={onSubmit}
            pending={pending}
            serverErrors={fieldErrors}
          />
        </div>

      </div>

      <section aria-labelledby="rules-title" className="lg:col-start-1 lg:row-start-2 lg:self-start">
        <h2 id="rules-title" className="text-sm font-semibold">
          Rules applied
        </h2>
        <p className="mt-1 text-[13px] text-muted">Property-carrying driver, 70-hour / 8-day cycle.</p>
        <dl className="mt-4 max-w-[440px] border-t border-line text-sm">
          {RULES.map(([rule, value]) => (
            <div key={rule} className="grid grid-cols-[140px_1fr] gap-4 border-b border-line py-2.5">
              <dt className="text-muted">{rule}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}
