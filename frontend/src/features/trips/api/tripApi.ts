import { httpRequest } from '../../../lib/http'
import { stripCpf } from '../../../shared/validation/cpf'
import type { BusConfig, Trip } from '../model/tripTypes'

function readString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function readNumber(value: unknown, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function preserveJsonArray(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return '[]'

  try {
    return Array.isArray(JSON.parse(value) as unknown) ? value : '[]'
  } catch {
    return '[]'
  }
}

function normalizeBus(value: unknown, index: number): BusConfig | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }

  const source = value as Record<string, unknown>
  const floors = readNumber(source.floors, 1) === 2 ? 2 : 1
  const seatsFloor1 = Math.max(
    0,
    readNumber(source.seatsFloor1, readNumber(source.seats, 44)),
  )
  const seatsFloor2 =
    floors === 2 ? Math.max(0, readNumber(source.seatsFloor2)) : 0

  return {
    ...source,
    id:
      typeof source.id === 'string' || typeof source.id === 'number'
        ? source.id
        : index + 1,
    floors,
    seatsFloor1,
    seatsFloor2,
    seats: seatsFloor1 + seatsFloor2,
  }
}

function parseBuses(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return []

  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed)
      ? parsed
          .map(normalizeBus)
          .filter((bus): bus is BusConfig => bus !== null)
      : []
  } catch {
    return []
  }
}

function parseTravelerCpfs(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return []

  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter((cpf): cpf is string => typeof cpf === 'string')
      .map(stripCpf)
      .filter(Boolean)
  } catch {
    return []
  }
}

export function toTrip(value: unknown): Trip | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }

  const trip = value as Record<string, unknown>
  if (typeof trip.id !== 'string' || !trip.id.trim()) return null

  return {
    id: trip.id,
    name:
      typeof trip.name === 'string' && trip.name.trim()
        ? trip.name
        : 'Viagem sem nome',
    destination:
      typeof trip.destination === 'string' ? trip.destination : '',
    departurePlace: readString(trip.departurePlace),
    departureTime: readString(trip.departureTime),
    date: readString(trip.date),
    maxPeople: Math.max(1, readNumber(trip.maxPeople, 44)),
    price: Math.max(0, readNumber(trip.price)),
    arrecadationGoal: Math.max(0, readNumber(trip.arrecadationGoal)),
    rules: readString(trip.rules),
    buses: parseBuses(trip.busesJson),
    hotelsJson: preserveJsonArray(trip.hotelsJson),
    travelersJson: preserveJsonArray(trip.travelersJson),
    travelerCpfs: parseTravelerCpfs(trip.travelersJson),
  }
}

function parseTripList(value: unknown) {
  if (!Array.isArray(value)) {
    throw new Error('Resposta de viagens inválida.')
  }

  return value.map(toTrip).filter((trip): trip is Trip => trip !== null)
}

export function tripToApi(trip: Trip) {
  return {
    id: trip.id,
    name: trip.name,
    destination: trip.destination,
    departurePlace: trip.departurePlace,
    departureTime: trip.departureTime,
    date: trip.date || null,
    maxPeople: trip.maxPeople,
    price: trip.price,
    arrecadationGoal: trip.arrecadationGoal,
    rules: trip.rules,
    busesJson: JSON.stringify(trip.buses),
    hotelsJson: trip.hotelsJson,
    travelersJson: trip.travelersJson,
  }
}

export async function listTrips() {
  const response = await httpRequest<unknown>('/trips')
  return parseTripList(response)
}

async function persistTrip(path: string, method: 'POST' | 'PUT', trip: Trip) {
  const response = await httpRequest<unknown>(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tripToApi(trip)),
  })
  const persisted = toTrip(response)
  if (!persisted) throw new Error('Resposta de viagem inválida.')
  return persisted
}

export function createTripRecord(trip: Trip) {
  return persistTrip('/trips', 'POST', trip)
}

export function updateTripRecord(trip: Trip) {
  return persistTrip(
    `/trips/${encodeURIComponent(trip.id)}`,
    'PUT',
    trip,
  )
}
