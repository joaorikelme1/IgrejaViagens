import { stripCpf } from '../../../shared/validation/cpf'
import { busDisplayName } from '../../trips/lib/busDisplayName'
import type { BusConfig } from '../../trips/model/tripTypes'
import type {
  ReceiptSummary,
  SystemUser,
  TripTravelerSource,
} from '../model/userTypes'

export interface TripTravelerRow {
  payment: {
    paidInstallments: number
    percentage: number
    receipts: ReceiptSummary[]
    totalInstallments: number
  } | null
  pendingReceipts: number
  roomLabel: string
  seatLabel: string
  user: SystemUser
}

function roomType(type: string) {
  const value = type.toLowerCase()
  if (value === 'single' || value === 'individual') return 'Individual'
  if (value === 'double' || value === 'duplo') return 'Duplo'
  if (value === 'family' || value === 'familiar') return 'Familiar'
  return type
}

export function buildTripTravelers(
  travelerCpfs: string[],
  source: TripTravelerSource,
  buses: BusConfig[] = [],
): TripTravelerRow[] {
  const memberCpfs = new Set(travelerCpfs.map(stripCpf))

  return source.users
    .filter((user) => memberCpfs.has(user.cpf))
    .map((user) => {
      const paymentSource = source.payments.find(
        (payment) => payment.userCpf === user.cpf,
      )
      const total = Math.max(
        0,
        Math.trunc(paymentSource?.totalInstallments ?? 0),
      )
      const paid = Math.min(
        total,
        Math.max(0, Math.trunc(paymentSource?.paidInstallments ?? 0)),
      )
      const receipts = paymentSource?.receipts ?? []
      const payment = paymentSource
        ? {
            paidInstallments: paid,
            percentage: total > 0 ? Math.round((paid / total) * 100) : 0,
            receipts,
            totalInstallments: total,
          }
        : null

      const seatGroups = new Map<string, number[]>()
      source.seats
        .filter((seat) => seat.userCpf === user.cpf)
        .forEach((seat) => {
          const number = Math.trunc(seat.seatNumber)
          if (!seat.busId || number < 1) return
          const key = `${seat.busId}:${Math.trunc(seat.floor)}`
          const numbers = seatGroups.get(key) ?? []
          if (!numbers.includes(number)) numbers.push(number)
          seatGroups.set(key, numbers)
        })
      const seatLabel = [...seatGroups.entries()]
        .map(([key, numbers]) => {
          const [busId, floor] = key.split(':')
          const busIndex = buses.findIndex((bus) => String(bus.id) === busId)
          const name = busIndex >= 0
            ? busDisplayName(buses[busIndex], busIndex)
            : `Ônibus ${busId}`
          return `${name} · Piso ${floor} · ${numbers.sort((a, b) => a - b).join(', ')}`
        })
        .join('; ')

      const room = source.rooms.find((item) => item.occupants.includes(user.cpf))
      const typeLabel = room ? roomType(room.type) : ''
      const roomName = room ? room.name || `Quarto ${room.id}` : ''

      return {
        payment,
        pendingReceipts: receipts.filter(
          (receipt) => receipt.status.toLowerCase() === 'pending',
        ).length,
        roomLabel: room
          ? [roomName, typeLabel].filter(Boolean).join(' · ')
          : 'Não atribuído',
        seatLabel: seatLabel || 'Não atribuído',
        user,
      }
    })
}
