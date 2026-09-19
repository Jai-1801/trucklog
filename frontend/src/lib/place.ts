import type { PlaceInput } from './types'

/** Text is free until a suggestion is picked; a picked place carries its coordinates. */
export function displayText(value: PlaceInput): string {
  return value.label ?? value.query ?? ''
}
