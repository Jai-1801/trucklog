// A plan's inputs live in the URL (?from=…&pickup=…&to=…&cycle=…&start=…), so a link
// reproduces the exact trip, start time included. Places are "lat,lng,label".
import { EMPTY_DETAILS, type LogDetails } from './details'
import type { PlaceInput, PlanRequest } from './types'

const PARAMS = { current_location: 'from', pickup_location: 'pickup', dropoff_location: 'to' } as const
const DETAIL_PARAMS: Record<keyof LogDetails, string> = {
  driver: 'driver',
  carrier: 'carrier',
  mainOffice: 'office',
  homeTerminal: 'terminal',
  vehicle: 'vehicle',
  shippingDoc: 'doc',
  shipper: 'shipper',
}

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

export function toSearch(request: PlanRequest, details: LogDetails = EMPTY_DETAILS): string {
  const params = new URLSearchParams()
  for (const [field, key] of Object.entries(PARAMS) as [keyof typeof PARAMS, string][]) {
    params.set(key, encodePlace(request[field]))
  }
  params.set('cycle', String(request.current_cycle_used_hrs))
  if (request.start_at) params.set('start', request.start_at)
  for (const [field, key] of Object.entries(DETAIL_PARAMS) as [keyof LogDetails, string][]) {
    if (details[field].trim()) params.set(key, details[field].trim())
  }
  return `?${params.toString()}`
}

/** Details carried in a shared link, or null when the link has none. */
export function detailsFromSearch(search: string): LogDetails | null {
  const params = new URLSearchParams(search)
  const details = { ...EMPTY_DETAILS }
  let found = false
  for (const [field, key] of Object.entries(DETAIL_PARAMS) as [keyof LogDetails, string][]) {
    const value = params.get(key)
    if (value) {
      details[field] = value.slice(0, 120)
      found = true
    }
  }
  return found ? details : null
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
