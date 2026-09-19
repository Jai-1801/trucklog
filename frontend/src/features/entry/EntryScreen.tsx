import { AlertCircle, ArrowRight, RotateCw } from 'lucide-react'
import type { ApiError } from '../../lib/api'
import type { PlanRequest } from '../../lib/types'
import { SAMPLES, type Sample } from '../trip-form/samples'
import { TripForm } from '../trip-form/TripForm'

type Props = {
  formKey: number
  initial?: PlanRequest
  onSubmit: (request: PlanRequest) => void
  onSample: (sample: Sample) => void
  onRetry?: () => void
  pending: boolean
  error: ApiError | null
  editing: boolean
}

export function EntryScreen({ formKey, initial, onSubmit, onSample, onRetry, pending, error, editing }: Props) {
  const fieldErrors = error?.code === 'VALIDATION_ERROR' ? error.fields : undefined
  const banner = error && error.code !== 'VALIDATION_ERROR' ? error : null

  return (
    <div className="mx-auto w-full max-w-[600px] px-4 pt-10 pb-16 sm:px-6 sm:pt-16">
      <div className="text-center">
        <p className="inline-flex items-center rounded-full bg-accent-soft px-3 py-1 text-xs font-bold text-accent-strong">
          FMCSA Hours of Service · 70 hr / 8 day
        </p>
        <h1 className="mt-5 text-[32px] leading-[1.15] font-extrabold tracking-tight sm:text-[40px]">
          {editing ? 'Edit your trip' : 'Plan a compliant trip'}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-muted">
          Enter the trip and get the truck route, every required stop, and a filled-in daily log for each day.
        </p>
      </div>

      {banner && (
        <div
          role="alert"
          className="mt-8 flex items-start gap-3 rounded-2xl border border-status-restart/25 bg-status-restart/5 p-4"
        >
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-status-restart" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">We couldn’t plan this trip</p>
            <p className="mt-0.5 text-sm text-muted">{banner.message}</p>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-[13px] font-semibold hover:border-line-strong"
            >
              <RotateCw className="size-3.5" aria-hidden /> Retry
            </button>
          )}
        </div>
      )}

      <div className="mt-8">
        <TripForm key={formKey} initial={initial} onSubmit={onSubmit} pending={pending} serverErrors={fieldErrors} />
      </div>

      <section aria-labelledby="samples-title" className="mt-12">
        <div className="flex items-center gap-4">
          <span className="h-px flex-1 bg-line" />
          <h2 id="samples-title" className="text-xs font-bold tracking-[0.08em] text-subtle uppercase">
            Or try a sample trip
          </h2>
          <span className="h-px flex-1 bg-line" />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {SAMPLES.map((sample) => (
            <button
              key={sample.name}
              type="button"
              disabled={pending}
              onClick={() => onSample(sample)}
              className="group flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-left transition hover:-translate-y-px hover:border-accent/40 hover:shadow-[var(--shadow-card)] disabled:opacity-60"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold">{sample.name}</p>
                <p className="mt-0.5 truncate text-[13px] text-muted">{sample.route}</p>
                <p className="mt-1.5 text-xs font-semibold text-accent-strong">{sample.shows}</p>
              </div>
              <ArrowRight
                className="size-4 shrink-0 text-subtle transition group-hover:translate-x-0.5 group-hover:text-accent"
                aria-hidden
              />
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
