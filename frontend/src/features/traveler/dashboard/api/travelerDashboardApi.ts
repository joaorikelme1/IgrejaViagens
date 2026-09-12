import { httpRequest } from '../../../../lib/http'
import { stripCpf } from '../../../../shared/validation/cpf'
import type {
  TravelerDashboardSource,
  TravelerPaymentRecord,
  TravelerRoomRecord,
  TravelerSeatRecord,
} from '../model/travelerDashboardTypes'

function records(value: unknown, label: string) {
  if (!Array.isArray(value)) throw new Error(`Resposta de ${label} inválida.`)
  return value.filter(
    (item): item is Record<string, unknown> =>
      typeof item === 'object' && item !== null && !Array.isArray(item),
  )
}

function readNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function readId(value: unknown, fallback = '') {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : fallback
}

function belongsToTraveler(
  record: Record<string, unknown>,
  cpf: string,
  tripId: string,
) {
  const recordCpf = stripCpf(
    typeof record.userCpf === 'string'
      ? record.userCpf
      : typeof record.cpf === 'string'
        ? record.cpf
        : '',
  )
  return record.tripId === tripId && recordCpf === cpf
}

function parsePayments(
  value: unknown,
  cpf: string,
  tripId: string,
): TravelerPaymentRecord[] {
  return records(value, 'pagamentos')
    .filter((payment) => belongsToTraveler(payment, cpf, tripId))
    .map((payment, index) => ({
      id: readId(payment.id, `payment-${index}`),
      paidInstallments: readNumber(payment.paidInstallments),
      totalInstallments: readNumber(payment.totalInstallments),
    }))
}

function parseSeats(
  value: unknown,
  cpf: string,
  tripId: string,
): TravelerSeatRecord[] {
  return records(value, 'assentos')
    .filter((seat) => belongsToTraveler(seat, cpf, tripId))
    .map((seat, index) => ({
      id: readId(seat.id, `seat-${index}`),
      busId: readId(seat.busId),
      floor: readNumber(seat.floor),
      seatNumber: readNumber(seat.seatNumber),
    }))
}

function parseOccupants(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .filter((occupant): occupant is string => typeof occupant === 'string')
    .map(stripCpf)
    .filter(Boolean)
}

function parseRooms(
  value: unknown,
  cpf: string,
  tripId: string,
): TravelerRoomRecord[] {
  return records(value, 'quartos').flatMap((room, index) => {
    if (room.tripId !== tripId) return []
    const occupants = parseOccupants(room.occupants)
    if (!occupants.includes(cpf)) return []

    return [
      {
        id: readId(room.id, `room-${index}`),
        name: typeof room.name === 'string' ? room.name.trim() : '',
        type: typeof room.type === 'string' ? room.type.trim() : '',
        capacity: Math.max(0, readNumber(room.capacity)),
        hotelId: readId(room.hotelId),
        occupants,
      },
    ]
  })
}

export async function loadTravelerDashboard(
  cpfValue: string,
  tripId: string,
): Promise<TravelerDashboardSource> {
  const cpf = stripCpf(cpfValue)
  const [payments, seats, rooms] = await Promise.all([
    httpRequest<unknown>('/payments'),
    httpRequest<unknown>('/seats'),
    httpRequest<unknown>('/rooms'),
  ])

  return {
    payments: parsePayments(payments, cpf, tripId),
    seats: parseSeats(seats, cpf, tripId),
    rooms: parseRooms(rooms, cpf, tripId),
  }
}
