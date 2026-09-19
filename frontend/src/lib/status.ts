import {
  BedDouble,
  Coffee,
  Flag,
  Fuel,
  type LucideIcon,
  Navigation,
  Package,
  RotateCcw,
  Truck,
} from 'lucide-react'
import type { DutyStatus, EventKind, StopType } from './types'

// Colors are the design tokens from index.css, so SVG, Leaflet and Tailwind agree.
export const STATUS_META: Record<DutyStatus, { label: string; short: string; color: string }> = {
  OFF: { label: 'Off duty', short: 'Off', color: 'var(--color-status-off)' },
  SB: { label: 'Sleeper berth', short: 'Sleeper', color: 'var(--color-status-sleeper)' },
  D: { label: 'Driving', short: 'Driving', color: 'var(--color-status-driving)' },
  ON: { label: 'On duty (not driving)', short: 'On duty', color: 'var(--color-status-on)' },
}

export const STOP_META: Record<StopType | 'drive', { label: string; color: string; icon: LucideIcon }> = {
  start: { label: 'Start', color: 'var(--color-ink)', icon: Navigation },
  pickup: { label: 'Pickup', color: 'var(--color-pin-pickup)', icon: Package },
  dropoff: { label: 'Dropoff', color: 'var(--color-pin-dropoff)', icon: Flag },
  fuel: { label: 'Fuel stop', color: 'var(--color-status-on)', icon: Fuel },
  break: { label: '30-min break', color: 'var(--color-status-off)', icon: Coffee },
  rest: { label: '10-hr rest', color: 'var(--color-status-sleeper)', icon: BedDouble },
  restart: { label: '34-hr restart', color: 'var(--color-status-restart)', icon: RotateCcw },
  drive: { label: 'Driving', color: 'var(--color-status-driving)', icon: Truck },
}

export const kindMeta = (kind: EventKind | StopType) => STOP_META[kind]
