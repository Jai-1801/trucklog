import { useEffect, useState } from 'react'

// The API doesn't stream progress, so steps advance on typical timings and the bar eases
// toward 95 % until the plan arrives. Honest enough for a 2–6 s wait.
const STEPS = [
  { label: 'Finding the locations', at: 0 },
  { label: 'Routing for a truck', at: 700 },
  { label: 'Applying Hours-of-Service rules', at: 1900 },
  { label: 'Drawing the daily logs', at: 3200 },
]

function Truck() {
  return (
    <svg viewBox="0 0 240 64" className="w-60" aria-hidden>
      {/* road */}
      <line x1="0" x2="240" y1="58" y2="58" stroke="#e7e5e4" strokeWidth="2" />
      <line x1="0" x2="240" y1="58" y2="58" stroke="#a8a29e" strokeWidth="2" strokeDasharray="10 16" className="road-dash" />
      {/* truck */}
      <g className="truck-bob">
        <rect x="68" y="16" width="64" height="30" rx="2" fill="#ea580c" />
        <path d="M134 24h18l12 12v10h-30z" fill="#1c1917" />
        <path d="M139 28h10l8 8h-18z" fill="#fafaf9" />
        <circle cx="86" cy="48" r="5.5" fill="#1c1917" />
        <circle cx="116" cy="48" r="5.5" fill="#1c1917" />
        <circle cx="152" cy="48" r="5.5" fill="#1c1917" />
      </g>
    </svg>
  )
}

export function Preloader({ route }: { route?: string }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const started = performance.now()
    const timer = window.setInterval(() => setElapsed(performance.now() - started), 100)
    return () => window.clearInterval(timer)
  }, [])

  const stepIndex = STEPS.reduce((current, step, i) => (elapsed >= step.at ? i : current), 0)
  const progress = 95 * (1 - Math.exp(-elapsed / 2200))

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Planning your trip"
      className="fixed inset-0 z-[2000] grid place-items-center bg-surface/95 px-6"
    >
      <div className="fade-up w-full max-w-[320px]">
        <Truck />
        <p className="mt-8 text-lg font-semibold tracking-[-0.01em]">Planning your trip</p>
        {route && <p className="mt-1 truncate text-sm text-muted">{route}</p>}
        <div className="mt-6 h-0.5 bg-line">
          <div className="h-full bg-accent transition-[width] duration-300 ease-out" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-3 flex justify-between gap-4 text-[13px]">
          <span key={stepIndex} className="fade-up text-ink">
            {STEPS[stepIndex].label}…
          </span>
          <span className="shrink-0 text-subtle tabular-nums">
            {stepIndex + 1} of {STEPS.length}
          </span>
        </p>
      </div>
    </div>
  )
}
