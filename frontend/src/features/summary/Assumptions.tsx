import { ChevronDown, ScrollText } from 'lucide-react'

export function Assumptions({ items }: { items: string[] }) {
  return (
    <details className="group rounded-card border border-line bg-surface print:hidden">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        <ScrollText className="size-4 text-muted" aria-hidden />
        How this plan was built
        <span className="font-normal text-muted">· {items.length} assumptions</span>
        <ChevronDown className="ml-auto size-4 text-muted transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <ul className="grid gap-x-8 gap-y-2 border-t border-line px-4 py-3 text-sm text-muted md:grid-cols-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-2 size-1 shrink-0 rounded-full bg-muted" aria-hidden />
            {item}
          </li>
        ))}
      </ul>
    </details>
  )
}
