import type { BusConfig, Trip, TripMutation } from '../model/tripTypes'

export interface TripFormValues {
  name: string
  destination: string
  departurePlace: string
  departureTime: string
  date: string
  maxPeople: string
  price: string
  arrecadationGoal: string
  rules: string
  buses: BusConfig[]
}

function createDefaultBus(): BusConfig {
  return {
    id: 1,
    floors: 1,
    seatsFloor1: 44,
    seatsFloor2: 0,
    seats: 44,
  }
}

export function createEmptyTripForm(): TripFormValues {
  return {
    name: '',
    destination: '',
    departurePlace: '',
    departureTime: '',
    date: '',
    maxPeople: '44',
    price: '0',
    arrecadationGoal: '0',
    rules: '',
    buses: [createDefaultBus()],
  }
}

export function tripToForm(trip: Trip): TripFormValues {
  return {
    name: trip.name,
    destination: trip.destination,
    departurePlace: trip.departurePlace,
    departureTime: trip.departureTime,
    date: trip.date,
    maxPeople: String(trip.maxPeople),
    price: String(trip.price),
    arrecadationGoal: String(trip.arrecadationGoal),
    rules: trip.rules,
    buses: trip.buses.map((bus) => ({ ...bus })),
  }
}

function parseNonNegative(value: string, label: string) {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`${label} deve ser um número válido.`)
  }
  return number
}

export function tripFormToMutation(values: TripFormValues): TripMutation {
  if (!values.name.trim()) throw new Error('Informe o nome da viagem.')
  if (!values.departurePlace.trim()) throw new Error('Informe a origem.')
  if (!values.destination.trim()) throw new Error('Informe o destino.')
  if (!values.date) throw new Error('Informe a data da viagem.')
  if (!values.departureTime) throw new Error('Informe o horário da viagem.')

  const maxPeople = parseNonNegative(values.maxPeople, 'O limite de pessoas')
  if (!Number.isInteger(maxPeople) || maxPeople < 1) {
    throw new Error('O limite de pessoas deve ser um inteiro maior que zero.')
  }

  const buses = values.buses.map((bus, index) => {
    const seatsFloor1 = Number(bus.seatsFloor1)
    const seatsFloor2 = bus.floors === 2 ? Number(bus.seatsFloor2) : 0
    if (
      !Number.isInteger(seatsFloor1) ||
      seatsFloor1 < 1 ||
      !Number.isInteger(seatsFloor2) ||
      seatsFloor2 < 0
    ) {
      throw new Error(`Revise a quantidade de assentos do ônibus ${index + 1}.`)
    }

    return {
      ...bus,
      floors: bus.floors === 2 ? 2 : 1,
      seatsFloor1,
      seatsFloor2,
      seats: seatsFloor1 + seatsFloor2,
    }
  })

  if (buses.length === 0) throw new Error('Configure ao menos um ônibus.')

  return {
    name: values.name.trim(),
    destination: values.destination.trim(),
    departurePlace: values.departurePlace.trim(),
    departureTime: values.departureTime,
    date: values.date,
    maxPeople,
    price: parseNonNegative(values.price, 'O preço'),
    arrecadationGoal: parseNonNegative(
      values.arrecadationGoal,
      'A meta de arrecadação',
    ),
    rules: values.rules.trim(),
    buses,
  }
}

export function suggestArrecadationGoal(values: TripFormValues) {
  const price = Number(values.price)
  const maxPeople = Number(values.maxPeople)
  if (!Number.isFinite(price) || !Number.isFinite(maxPeople)) return 0
  return Math.max(0, price) * Math.max(0, maxPeople)
}
