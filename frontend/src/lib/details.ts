/** Fields printed on every daily log sheet. They come from the driver or carrier, not from the plan. */
export type LogDetails = {
  driver: string
  carrier: string
  mainOffice: string
  homeTerminal: string
  vehicle: string
  shippingDoc: string
  shipper: string
}

export const EMPTY_DETAILS: LogDetails = {
  driver: '',
  carrier: '',
  mainOffice: '',
  homeTerminal: '',
  vehicle: '',
  shippingDoc: '',
  shipper: '',
}

export const DETAIL_FIELDS: { key: keyof LogDetails; label: string; wide?: boolean }[] = [
  { key: 'driver', label: 'Driver name' },
  { key: 'carrier', label: 'Carrier name' },
  { key: 'mainOffice', label: 'Main office address', wide: true },
  { key: 'homeTerminal', label: 'Home terminal address', wide: true },
  { key: 'vehicle', label: 'Truck / trailer numbers' },
  { key: 'shippingDoc', label: 'Manifest or BOL number' },
  { key: 'shipper', label: 'Shipper and commodity', wide: true },
]

// Carrier, truck and driver rarely change between trips, so they are remembered in this browser.
// Shipping documents are per load and are not.
const STORAGE_KEY = 'trucklog.details'
const REMEMBERED: (keyof LogDetails)[] = ['driver', 'carrier', 'mainOffice', 'homeTerminal', 'vehicle']

export function loadDetails(): LogDetails {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<LogDetails>
    const details = { ...EMPTY_DETAILS }
    for (const key of REMEMBERED) if (typeof saved[key] === 'string') details[key] = saved[key]
    return details
  } catch {
    return { ...EMPTY_DETAILS }
  }
}

export function saveDetails(details: LogDetails): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(REMEMBERED.map((k) => [k, details[k]]))))
  } catch {
    // Storage blocked (private mode): the details still apply to this trip.
  }
}
