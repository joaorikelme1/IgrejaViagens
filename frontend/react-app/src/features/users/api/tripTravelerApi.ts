import { httpRequest } from '../../../lib/http'
import { stripCpf } from '../../../shared/validation/cpf'
import type {
  ReceiptSummary,
  TravelerPaymentSummary,
  TravelerRoomSummary,
  TravelerSeatSummary,
  TripTravelerSource,
} from '../model/userTypes'
import { listUsers } from './usersApi'

function records(value: unknown, label: string) {
  if (!Array.isArray(value)) throw new Error(`Resposta de ${label} inválida.`)
  return value.filter(
    (item): item is Record<string, unknown> =>
      typeof item === 'object' && item !== null && !Array.isArray(item),
  )
}

function readString(value: unknown, fallback = '') {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : fallback
}

function readNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function recordCpf(record: Record<string, unknown>) {
  return stripCpf(
    typeof record.userCpf === 'string'
      ? record.userCpf
      : typeof record.cpf === 'string'
        ? record.cpf
        : '',
  )
}

function parseReceipts(value: unknown): ReceiptSummary[] {
  if (typeof value !== 'string' || !value.trim()) return []

  try {
    const parsed: unknown = JSON.parse(value)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return []
    }

    return Object.entries(parsed).flatMap(([installment, receipt]) => {
      if (
        typeof receipt !== 'object' ||
        receipt === null ||
        Array.isArray(receipt)
      ) {
        return []
      }
      const source = receipt as Record<string, unknown>
      return [
        {
          installment,
          status: readString(source.status, 'enviado'),
          fileName: readString(
            source.fileName,
            readString(source.name, 'Comprovante enviado'),
          ),
        },
      ]
    })
  } catch {
    return []
  }
}

function parsePayments(value: unknown, tripId: string) {
  return records(value, 'pagamentos').flatMap((payment) => {
    if (payment.tripId !== tripId) return []
    const userCpf = recordCpf(payment)
    if (!userCpf) return []

    const summary: TravelerPaymentSummary = {
      paidInstallments: Math.max(0, readNumber(payment.paidInstallments)),
      receipts: parseReceipts(payment.receiptsJson),
      totalInstallments: Math.max(0, readNumber(payment.totalInstallments)),
      userCpf,
    }
    return [summary]
  })
}

function parseSeats(value: unknown, tripId: string) {
  return records(value, 'assentos').flatMap((seat) => {
    if (seat.tripId !== tripId) return []
    const userCpf = recordCpf(seat)
    if (!userCpf) return []

    const summary: TravelerSeatSummary = {
      busId: readString(seat.busId),
      floor: readNumber(seat.floor),
      seatNumber: readNumber(seat.seatNumber),
      userCpf,
    }
    return [summary]
  })
}

function parseRooms(value: unknown, tripId: string) {
  return records(value, 'quartos').flatMap((room) => {
    if (room.tripId !== tripId) return []
    const occupants = Array.isArray(room.occupants)
      ? room.occupants
          .filter((cpf): cpf is string => typeof cpf === 'string')
          .map(stripCpf)
          .filter(Boolean)
      : []

    const summary: TravelerRoomSummary = {
      id: readString(room.id),
      name: readString(room.name),
      occupants,
      type: readString(room.type),
    }
    return [summary]
  })
}

export async function loadTripTravelerSource(
  tripId: string,
): Promise<TripTravelerSource> {
  const [users, payments, seats, rooms] = await Promise.all([
    listUsers(),
    httpRequest<unknown>('/payments'),
    httpRequest<unknown>('/seats'),
    httpRequest<unknown>('/rooms'),
  ])

  return {
    users,
    payments: parsePayments(payments, tripId),
    seats: parseSeats(seats, tripId),
    rooms: parseRooms(rooms, tripId),
  }
}
