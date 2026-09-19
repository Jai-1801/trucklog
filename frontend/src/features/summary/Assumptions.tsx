import { ChevronDown, ScrollText } from 'lucide-react'

export function Assumptions({ items }: { items: string[] }) {
  return (
    <details open className="group rounded-card border border-line bg-surface shadow-[var(--shadow-card)] print:hidden">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-6 py-5 [&::-webkit-details-marker]:hidden">
        <span className="grid size-9 place-items-center rounded-xl bg-canvas ring-1 ring-line">
          <ScrollText className="size-[18px] text-muted" aria-hidden />
        </span>
        <span>
          <span className="block text-[15px] font-bold">How this plan was built</span>
          <span className="block text-[13px] text-muted">{items.length} rules and assumptions behind every number</span>
        </span>
        <ChevronDown className="ml-auto size-5 text-subtle transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <ul className="grid gap-x-10 gap-y-3 border-t border-line px-6 py-6 text-sm leading-relaxed text-muted md:grid-cols-2">
        {items.map((item) => (
          <li key={item} className="flex gap-3">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent/60" aria-hidden />
            {item}
          </li>
        ))}
      </ul>
    </details>
  )
}
