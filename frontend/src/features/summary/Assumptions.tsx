const RULES: [string, string][] = [
  ['11-hour driving limit', 'After 11 hours of driving, a 10-hour sleeper-berth rest before driving again.'],
  ['14-hour window', 'No driving after the 14th hour since coming on duty. On-duty work may finish past it.'],
  ['30-minute break', 'Required after 8 hours of driving. A fuel stop, pickup or rest of 30+ minutes also counts.'],
  ['70 hours / 8 days', 'Once the cycle is used up, a 34-hour restart resets it to zero.'],
  ['Fuel', 'A 30-minute on-duty stop at least every 1,000 miles.'],
  ['Pickup and dropoff', 'One hour on duty each.'],
]

/** Plain reference page: the rules the engine enforces, then every modeling assumption. */
export function Assumptions({ items }: { items: string[] }) {
  return (
    <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
      <section aria-labelledby="rules-heading">
        <h2 id="rules-heading" className="text-lg font-semibold tracking-[-0.01em]">
          Rules applied
        </h2>
        <p className="mt-1 text-sm text-muted">
          FMCSA Hours of Service for a property-carrying driver on the 70-hour / 8-day cycle.
        </p>
        <dl className="mt-5 border-t border-line">
          {RULES.map(([rule, text]) => (
            <div key={rule} className="border-b border-line py-3.5">
              <dt className="text-sm font-semibold">{rule}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted">{text}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="assumptions-heading">
        <h2 id="assumptions-heading" className="text-lg font-semibold tracking-[-0.01em]">
          Assumptions
        </h2>
        <p className="mt-1 text-sm text-muted">Every modeling choice behind the numbers.</p>
        <ol className="mt-5 border-t border-line">
          {items.map((item, i) => (
            <li key={item} className="grid grid-cols-[28px_1fr] border-b border-line py-3.5 text-sm leading-relaxed">
              <span className="text-subtle tabular-nums">{i + 1}.</span>
              <span className="text-muted">{item}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
