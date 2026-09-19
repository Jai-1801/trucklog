import { useId } from 'react'
import { DETAIL_FIELDS, type LogDetails } from '../../lib/details'
import { fieldClass } from '../../lib/ui'

type Props = {
  value: LogDetails
  onChange: (value: LogDetails) => void
}

/** Carrier, truck, driver and shipping fields for the top and bottom of each log sheet. */
export function DetailsFields({ value, onChange }: Props) {
  const id = useId()
  return (
    <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
      {DETAIL_FIELDS.map(({ key, label, wide }) => (
        <div key={key} className={wide ? 'sm:col-span-2' : undefined}>
          <label htmlFor={`${id}-${key}`} className="mb-1.5 block text-sm font-medium">
            {label}
          </label>
          <div className={`px-3.5 ${fieldClass} border-line-strong`}>
            <input
              id={`${id}-${key}`}
              value={value[key]}
              maxLength={120}
              autoComplete="off"
              onChange={(e) => onChange({ ...value, [key]: e.target.value })}
              className="h-10 w-full min-w-0 bg-transparent text-[15px] outline-none"
            />
          </div>
        </div>
      ))}
    </div>
  )
}
