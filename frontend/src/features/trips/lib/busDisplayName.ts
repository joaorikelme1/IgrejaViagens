import type { BusConfig } from '../model/tripTypes'

export function busDisplayName(bus: BusConfig, index: number) {
  const label = bus.label?.trim() ?? ''
  const id = String(bus.id).trim()
  const generatedFromId =
    label.localeCompare(id, undefined, { sensitivity: 'accent' }) === 0 ||
    label.localeCompare(`Ônibus ${id}`, undefined, { sensitivity: 'accent' }) === 0

  return label && !generatedFromId ? label : `Ônibus ${Math.max(0, index) + 1}`
}
