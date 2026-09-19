import { Loader2 } from 'lucide-react'

const STEPS = ['Finding the locations', 'Routing for a truck', 'Applying Hours-of-Service rules', 'Drawing the daily logs']

export function PlanningState() {
  return (
    <section aria-live="polite" aria-busy="true" className="space-y-8">
      <div className="flex items-center gap-4 rounded-card border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
        <Loader2 className="size-6 shrink-0 animate-spin text-accent" aria-hidden />
        <div>
          <p className="text-[15px] font-bold">Planning your trip…</p>
          <ol className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
            {STEPS.map((step, i) => (
              <li key={step} className="animate-pulse" style={{ animationDelay: `${i * 200}ms` }}>
                {step}
              </li>
            ))}
          </ol>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {STEPS.map((step) => (
          <div key={step} className="h-24 animate-pulse rounded-card bg-line/60" />
        ))}
      </div>
      <div className="h-[420px] animate-pulse rounded-card bg-line/60" />
    </section>
  )
}
