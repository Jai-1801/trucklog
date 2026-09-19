// Mirrors the API contract in docs/BUILD.md §6 and backend/trips/services/planner.py.

export type DutyStatus = 'OFF' | 'SB' | 'D' | 'ON'
export type EventKind = 'drive' | 'pickup' | 'dropoff' | 'fuel' | 'break' | 'rest' | 'restart'
export type StopType = Exclude<EventKind, 'drive'> | 'start'
export type RemarkKind = EventKind | 'off'

export type Place = { label: string; short: string; lat: number; lng: number }
export type PlaceInput = Partial<Place> & { query?: string }

export type PlanRequest = {
  current_location: PlaceInput
  pickup_location: PlaceInput
  dropoff_location: PlaceInput
  current_cycle_used_hrs: number
  start_at?: string // YYYY-MM-DDTHH:MM, home-terminal wall clock
}

export type Stop = {
  id: string
  type: StopType
  label: string
  lat: number
  lng: number
  arrive_at: string
  depart_at: string
  duration_hrs: number
  odometer_mi: number
}

export type DutyEvent = {
  status: DutyStatus
  kind: EventKind
  start_at: string
  end_at: string
  duration_hrs: number
  miles: number
  odometer_mi: number
  location: string
  note: string
}

export type Segment = { status: DutyStatus; start_min: number; end_min: number }
export type Remark = {
  time_min: number
  location: string
  kind: RemarkKind
  note: string
  duration_min: number
}

export type DailyLog = {
  day_number: number
  date: string // YYYY-MM-DD
  from: string
  to: string
  total_miles_driving: number
  segments: Segment[]
  totals: Record<DutyStatus, number>
  remarks: Remark[]
  recap: {
    on_duty_today: number
    a_cycle_total: number
    b_available_tomorrow: number
    c_last_5_days: number | null
  }
}

export type TripPlan = {
  summary: {
    total_miles: number
    driving_hrs: number
    on_duty_hrs: number
    trip_hrs: number
    start_at: string
    pickup_at: string
    dropoff_at: string
    end_at: string
    days: number
    cycle_used_start_hrs: number
    cycle_used_end_hrs: number
    timezone: string
    stop_counts: Record<Exclude<EventKind, 'drive'>, number>
    routing_provider: string
  }
  route: {
    geometry: { type: 'LineString'; coordinates: [number, number][] }
    legs: { from: string; to: string; miles: number; drive_hrs: number }[]
    provider: string
  }
  places: Record<'current' | 'pickup' | 'dropoff', Place>
  stops: Stop[]
  events: DutyEvent[]
  days: DailyLog[]
  assumptions: string[]
  warnings: string[]
}
