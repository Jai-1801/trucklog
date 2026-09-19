import type { Place } from '../../lib/types'

const place = (label: string, short: string, lat: number, lng: number): Place => ({ label, short, lat, lng })

const CHICAGO = place('Chicago, IL, USA', 'Chicago, IL', 41.8781, -87.6298)
const ST_LOUIS = place('St. Louis, MO, USA', 'St. Louis, MO', 38.627, -90.1994)
const DALLAS = place('Dallas, TX, USA', 'Dallas, TX', 32.7767, -96.797)
const FORT_WORTH = place('Fort Worth, TX, USA', 'Fort Worth, TX', 32.7555, -97.3308)
const AUSTIN = place('Austin, TX, USA', 'Austin, TX', 30.2672, -97.7431)
const NEW_YORK = place('New York, NY, USA', 'New York, NY', 40.7128, -74.006)
const LOS_ANGELES = place('Los Angeles, CA, USA', 'Los Angeles, CA', 34.0522, -118.2437)
const ATLANTA = place('Atlanta, GA, USA', 'Atlanta, GA', 33.749, -84.388)
const NASHVILLE = place('Nashville, TN, USA', 'Nashville, TN', 36.1627, -86.7816)
const DENVER = place('Denver, CO, USA', 'Denver, CO', 39.7392, -104.9903)

export type Sample = {
  name: string
  hint: string
  current: Place
  pickup: Place
  dropoff: Place
  cycle: number
}

export const SAMPLES: Sample[] = [
  { name: 'Regional run', hint: 'Chicago → St. Louis → Dallas', current: CHICAGO, pickup: ST_LOUIS, dropoff: DALLAS, cycle: 12.5 },
  { name: 'Short haul', hint: 'Dallas → Fort Worth → Austin', current: DALLAS, pickup: FORT_WORTH, dropoff: AUSTIN, cycle: 0 },
  { name: 'Coast to coast', hint: 'New York → Chicago → Los Angeles', current: NEW_YORK, pickup: CHICAGO, dropoff: LOS_ANGELES, cycle: 30 },
  { name: 'Cycle nearly used', hint: 'Atlanta → Nashville → Denver, 62 h used', current: ATLANTA, pickup: NASHVILLE, dropoff: DENVER, cycle: 62 },
]
