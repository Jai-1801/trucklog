import { Check } from 'lucide-react'
import { useEffect, useState } from 'react'

// The API doesn't stream progress, so steps advance on typical timings and the bar eases
// toward 95 % until the plan arrives. Honest enough for a 2–6 s wait.
const STEPS = [
  { label: 'Finding your locations', at: 0 },
  { label: 'Routing for a truck', at: 700 },
  { label: 'Applying Hours-of-Service rules', at: 1900 },
  { label: 'Drawing the daily log sheets', at: 3200 },
]

const FACTS = [
  'A driver may drive at most 11 hours after 10 consecutive hours off duty.',
  'A 30-minute break is required after 8 hours of driving.',
  'No driving after the 14th hour of the duty day, even with rest in between.',
  'A 34-hour restart resets the 70-hour / 8-day cycle to zero.',
  'Daily logs use the home terminal’s time zone, wherever the truck is.',
]

function Scene() {
  return (
    <svg viewBox="0 0 320 120" className="mx-auto w-full max-w-[340px]" aria-hidden>
      <defs>
        <linearGradient id="fade" x1="0" x2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.15" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.85" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#fff" />
        </linearGradient>
      </defs>
      {/* Stops passing by: fuel, then a rest */}
      <g className="pass-by" style={{ animationDelay: '-0.4s' }}>
        <circle cx="0" cy="56" r="9" fill="#f59e0b" />
        <rect x="-1" y="64" width="2" height="16" fill="#f59e0b" />
      </g>
      <g className="pass-by" style={{ animationDelay: '-1.6s' }}>
        <circle cx="0" cy="56" r="9" fill="#7c3aed" />
        <rect x="-1" y="64" width="2" height="16" fill="#7c3aed" />
      </g>
      {/* Road */}
      <rect x="0" y="80" width="320" height="22" rx="4" fill="#e6e9ef" />
      <line x1="0" x2="320" y1="91" y2="91" stroke="#fff" strokeWidth="3" strokeDasharray="30 22" className="road-dash" />
      {/* Truck */}
      <g className="truck-bob">
        <rect x="104" y="46" width="72" height="36" rx="4" fill="#2563eb" />
        <rect x="112" y="54" width="56" height="4" rx="2" fill="#fff" opacity="0.35" />
        <path d="M178 58h20l14 14v10h-34z" fill="#1d4ed8" />
        <path d="M184 62h12l8 9h-20z" fill="#dbeafe" />
        <circle cx="124" cy="84" r="7" fill="#0b1324" />
        <circle cx="124" cy="84" r="2.5" fill="#e6e9ef" />
        <circle cx="160" cy="84" r="7" fill="#0b1324" />
        <circle cx="160" cy="84" r="2.5" fill="#e6e9ef" />
        <circle cx="198" cy="84" r="7" fill="#0b1324" />
        <circle cx="198" cy="84" r="2.5" fill="#e6e9ef" />
      </g>
      <rect x="0" y="40" width="320" height="70" fill="url(#fade)" />
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
  const fact = FACTS[Math.floor(elapsed / 3500) % FACTS.length]

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Planning your trip"
      className="fixed inset-0 z-[2000] grid place-items-center bg-canvas/92 p-6 backdrop-blur-sm"
    >
      <div className="fade-up w-full max-w-md rounded-[20px] border border-line bg-surface p-8 text-center shadow-[var(--shadow-float)]">
        <Scene />
        <p className="mt-6 text-lg font-extrabold tracking-tight">Planning your trip</p>
        {route && <p className="mt-1 truncate text-sm text-muted">{route}</p>}

        <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <ol className="mt-6 space-y-2.5 text-left">
          {STEPS.map((step, i) => {
            const state = i < stepIndex ? 'done' : i === stepIndex ? 'active' : 'todo'
            return (
              <li key={step.label} className="flex items-center gap-3 text-sm">
                <span
                  className={`grid size-5 shrink-0 place-items-center rounded-full transition-colors ${
                    state === 'done' ? 'bg-pin-pickup text-white' : state === 'active' ? 'bg-accent-soft' : 'bg-canvas'
                  }`}
                >
                  {state === 'done' && <Check className="size-3" strokeWidth={3} aria-hidden />}
                  {state === 'active' && <span className="size-2 animate-pulse rounded-full bg-accent" />}
                </span>
                <span className={state === 'todo' ? 'text-subtle' : 'font-semibold text-ink'}>{step.label}</span>
              </li>
            )
          })}
        </ol>

        <p key={fact} className="fade-up mt-7 rounded-xl bg-canvas px-4 py-3 text-left text-[13px] leading-relaxed text-muted">
          <span className="font-bold text-ink">HOS rule · </span>
          {fact}
        </p>
      </div>
    </div>
  )
}
