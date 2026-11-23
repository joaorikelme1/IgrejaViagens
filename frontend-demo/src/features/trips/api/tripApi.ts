import { readDemoState, updateDemoState } from '../../../demo/demoStore'
import type { Trip } from '../model/tripTypes'

const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

export function toTrip(value: unknown): Trip | null {
  if (!value || typeof value !== 'object' || !('id' in value)) return null
  return copy(value as Trip)
}

export async function listTrips() { return copy(readDemoState().trips).sort((a, b) => a.date.localeCompare(b.date)) }

export function tripToApi(trip: Trip) { return copy(trip) }

export async function createTripRecord(trip: Trip) {
  const saved = { ...copy(trip), version: 1, updatedAt: new Date().toISOString() }
  updateDemoState((state) => { state.trips.push(saved) })
  return saved
}

export async function updateTripRecord(trip: Trip) {
  const saved = { ...copy(trip), version: (trip.version ?? 0) + 1, updatedAt: new Date().toISOString() }
  updateDemoState((state) => {
    const index = state.trips.findIndex((item) => item.id === trip.id)
    if (index < 0) throw new Error('Viagem não encontrada.')
    state.trips[index] = saved
  })
  return saved
}
