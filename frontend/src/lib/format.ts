// Display formatting. Trip times are shown in the trip's home-terminal time zone.

export function formatHours(hours: number): string {
  const totalMin = Math.round(hours * 60)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export function formatMiles(miles: number): string {
  return `${Math.round(miles).toLocaleString('en-US')} mi`
}

export function formatDecimalHours(hours: number): string {
  return hours.toFixed(2).replace(/\.?0+$/, '') || '0'
}

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatter(timeZone: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${timeZone}|${JSON.stringify(options)}`
  let f = formatters.get(key)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone, ...options })
    formatters.set(key, f)
  }
  return f
}

export function formatTime(iso: string, timeZone: string): string {
  return formatter(timeZone, { hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
}

export function formatDayTime(iso: string, timeZone: string): string {
  return formatter(timeZone, { weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
}

export function formatDate(isoDate: string): string {
  // A calendar date (YYYY-MM-DD) with no time zone: format it as-is.
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, d)),
  )
}

export function formatClock(minuteOfDay: number): string {
  const h = Math.floor(minuteOfDay / 60) % 24
  const m = minuteOfDay % 60
  const suffix = h < 12 ? 'am' : 'pm'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, '0')}${suffix}`
}

export function timeZoneAbbr(iso: string, timeZone: string): string {
  const part = formatter(timeZone, { timeZoneName: 'short' })
    .formatToParts(new Date(iso))
    .find((p) => p.type === 'timeZoneName')
  return part?.value ?? timeZone
}

/** Next quarter hour in the browser's local time, as a datetime-local value. */
export function nextQuarterHourLocal(now = new Date()): string {
  const d = new Date(now)
  d.setSeconds(0, 0)
  d.setMinutes(Math.ceil((d.getMinutes() + 1) / 15) * 15)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
