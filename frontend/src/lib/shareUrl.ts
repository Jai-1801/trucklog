// A plan's inputs live in the URL (?from=…&pickup=…&to=…&cycle=…&start=…), so a link
// reproduces the exact trip, start time included. Places are "lat,lng,label".
import type { PlaceInput, PlanRequest } from './types'

const PARAMS = { current_location: 'from', pickup_location: 'pickup', dropoff_location: 'to' } as const

function encodePlace(place: PlaceInput): string {
  if (place.lat !== undefined && place.lng !== undefined) {
    return `${place.lat.toFixed(5)},${place.lng.toFixed(5)},${place.label ?? ''}`
  }
  return place.query ?? place.label ?? ''
}

function decodePlace(value: string): PlaceInput {
  const match = value.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(.*)$/)
  if (!match) return { query: value }
  const label = match[3] || `${match[1]}, ${match[2]}`
  return { label, short: label.replace(/, USA$/, ''), lat: Number(match[1]), lng: Number(match[2]) }
}

export function toSearch(request: PlanRequest): string {
  const params = new URLSearchParams()
  for (const [field, key] of Object.entries(PARAMS) as [keyof typeof PARAMS, string][]) {
    params.set(key, encodePlace(request[field]))
  }
  params.set('cycle', String(request.current_cycle_used_hrs))
  if (request.start_at) params.set('start', request.start_at)
  return `?${params.toString()}`
}

export function fromSearch(search: string): PlanRequest | null {
  const params = new URLSearchParams(search)
  const [from, pickup, to] = [params.get('from'), params.get('pickup'), params.get('to')]
  const cycle = Number(params.get('cycle'))
  if (!from || !pickup || !to || !Number.isFinite(cycle) || cycle < 0 || cycle > 70) return null
  const start = params.get('start')
  return {
    current_location: decodePlace(from),
    pickup_location: decodePlace(pickup),
    dropoff_location: decodePlace(to),
    current_cycle_used_hrs: cycle,
    start_at: start && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(start) ? start : undefined,
  }
}
