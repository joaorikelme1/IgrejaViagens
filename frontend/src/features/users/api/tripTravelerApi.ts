import { listPayments } from '../../payments/api/paymentApi'
import { loadHotelSource, loadTransportSource } from '../../operations/api/operationsApi'
import type { TripTravelerSource } from '../model/userTypes'
import { listUsers } from './usersApi'

export async function loadTripTravelerSource(tripId: string): Promise<TripTravelerSource> {
  const [users, payments, rooms, seats] = await Promise.all([listUsers(), listPayments(), loadHotelSource(tripId), loadTransportSource(tripId)])
  return { users, payments: payments.filter((item) => item.tripId === tripId).map((item) => ({ userCpf: item.userCpf, totalInstallments: item.totalInstallments, paidInstallments: item.paidInstallments, receipts: Object.entries(item.receipts).map(([installment, receipt]) => ({ installment, status: receipt.status, fileName: receipt.filename })) })), rooms: rooms.rooms.map((room) => ({ id: room.id, name: room.name, type: room.type, occupants: room.occupants })), seats: seats.seats.map((seat) => ({ userCpf: seat.userCpf, busId: seat.busId, floor: seat.floor, seatNumber: seat.seatNumber })) }
}
