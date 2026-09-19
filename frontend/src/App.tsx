import { useQuery } from '@tanstack/react-query'
import { Truck } from 'lucide-react'
import { getHealth } from './lib/api'

export default function App() {
  const health = useQuery({ queryKey: ['health'], queryFn: getHealth })

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4">
          <span className="grid size-7 place-items-center rounded-lg bg-accent text-white">
            <Truck className="size-4" aria-hidden />
          </span>
          <span className="font-semibold tracking-tight">TruckLog</span>
          <span className="hidden text-sm text-muted sm:inline">HOS-compliant trip planner</span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10">
        <div className="rounded-card border border-line bg-surface p-6">
          <h1 className="text-lg font-semibold">API status</h1>
          <p className="mt-2 font-mono text-sm text-muted" aria-live="polite">
            {health.isPending && 'Checking…'}
            {health.isError && `Unreachable: ${health.error.message}`}
            {health.data &&
              `ok · version ${health.data.version} · routing ${health.data.routing_configured ? 'configured' : 'missing key'}`}
          </p>
        </div>
      </main>
    </div>
  )
}
