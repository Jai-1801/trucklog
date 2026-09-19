import { ArrowRight, FileText, MapPinned, Route } from 'lucide-react'
import type { Sample } from '../trip-form/samples'
import { SAMPLES } from '../trip-form/samples'

const STEPS = [
  { icon: MapPinned, title: 'Enter the trip', text: 'Current location, pickup, dropoff and the cycle hours already used.' },
  { icon: Route, title: 'We plan every stop', text: 'Fuel, 30-min breaks, 10-hr rests and 34-hr restarts, placed where the rules require.' },
  { icon: FileText, title: 'Get your daily logs', text: 'One filled-in FMCSA log sheet per day, ready to print or save as PDF.' },
]

export function Welcome({ onSample, disabled }: { onSample: (sample: Sample) => void; disabled: boolean }) {
  return (
    <section aria-labelledby="welcome-title" className="rounded-card border border-line bg-surface p-6 shadow-[var(--shadow-card)] sm:p-10">
      <p className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-xs font-bold text-accent-strong">
        FMCSA Hours of Service · 70 hr / 8 days
      </p>
      <h2 id="welcome-title" className="mt-5 max-w-2xl text-3xl leading-tight font-extrabold tracking-tight sm:text-4xl">
        From a dispatch to compliant daily logs in seconds
      </h2>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
        TruckLog routes the trip for a truck, applies every Hours-of-Service limit, and draws the driver’s daily log
        for each day of the trip.
      </p>

      <ol className="mt-10 grid gap-6 sm:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, text }, i) => (
          <li key={title} className="flex gap-4 sm:flex-col">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-canvas text-accent ring-1 ring-line">
              <Icon className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-[15px] font-bold">
                <span className="mr-1.5 text-subtle">{i + 1}.</span>
                {title}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{text}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-12 border-t border-line pt-8">
        <h3 className="text-sm font-bold">Try a sample trip</h3>
        <p className="mt-1 text-sm text-muted">One click fills the form and plans the trip.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {SAMPLES.map((sample) => (
            <button
              key={sample.name}
              type="button"
              disabled={disabled}
              onClick={() => onSample(sample)}
              className="group flex items-center gap-4 rounded-xl border border-line bg-surface p-4 text-left transition hover:border-accent/40 hover:bg-accent-soft/60 hover:shadow-[var(--shadow-card)] disabled:opacity-60"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold">{sample.name}</p>
                <p className="mt-0.5 truncate text-[13px] text-muted">{sample.route}</p>
                <p className="mt-2 text-xs font-semibold text-accent-strong">{sample.shows}</p>
              </div>
              <ArrowRight
                className="size-5 shrink-0 text-subtle transition group-hover:translate-x-0.5 group-hover:text-accent"
                aria-hidden
              />
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
