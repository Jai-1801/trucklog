import { Check, Link2, Printer } from 'lucide-react'
import { useState } from 'react'
import type { TripPlan } from '../../lib/types'

const RESULT_SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'route', label: 'Route & stops' },
  { id: 'logs', label: 'Daily logs' },
  { id: 'assumptions', label: 'Assumptions' },
] as const

export function ResultsHeader({ plan }: { plan: TripPlan }) {
  const [copied, setCopied] = useState(false)
  const { current, pickup, dropoff } = plan.places

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy this link:', window.location.href)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold tracking-[0.08em] text-subtle uppercase">Your trip plan</p>
          <h2 className="mt-1.5 text-2xl leading-snug font-extrabold tracking-tight sm:text-[28px]">
            {current.short} <span className="text-subtle">→</span> {pickup.short}{' '}
            <span className="text-subtle">→</span> {dropoff.short}
          </h2>
        </div>
        <div className="flex gap-2 print:hidden">
          <button
            type="button"
            onClick={share}
            className="inline-flex h-10 items-center gap-2 rounded-field border border-line bg-surface px-4 text-sm font-semibold shadow-[var(--shadow-card)] transition hover:border-line-strong"
          >
            {copied ? <Check className="size-4 text-pin-pickup" aria-hidden /> : <Link2 className="size-4" aria-hidden />}
            {copied ? 'Link copied' : 'Share link'}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex h-10 items-center gap-2 rounded-field border border-line bg-surface px-4 text-sm font-semibold shadow-[var(--shadow-card)] transition hover:border-line-strong"
          >
            <Printer className="size-4" aria-hidden /> Print logs
          </button>
        </div>
      </div>

      <nav
        aria-label="Plan sections"
        className="sticky top-16 z-[1050] -mx-1 flex gap-1 overflow-x-auto rounded-full border border-line bg-surface/90 p-1 shadow-[var(--shadow-card)] backdrop-blur print:hidden"
      >
        {RESULT_SECTIONS.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold text-muted transition hover:bg-canvas hover:text-ink"
          >
            {section.label}
            {section.id === 'logs' && (
              <span className="ml-1.5 rounded-full bg-accent-soft px-1.5 py-0.5 text-[11px] text-accent-strong">
                {plan.days.length}
              </span>
            )}
          </a>
        ))}
      </nav>
    </div>
  )
}
