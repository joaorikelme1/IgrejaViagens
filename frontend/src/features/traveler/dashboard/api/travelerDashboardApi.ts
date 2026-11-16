import { listPayments } from '../../../payments/api/paymentApi'
import { loadHotelSource, loadTransportSource } from '../../../operations/api/operationsApi'
import { stripCpf } from '../../../../shared/validation/cpf'
import type { TravelerDashboardSource } from '../model/travelerDashboardTypes'

export async function loadTravelerDashboard(cpfValue: string, tripId: string): Promise<TravelerDashboardSource> {
  const cpf = stripCpf(cpfValue)
  const [payments, rooms, seats] = await Promise.all([listPayments(), loadHotelSource(tripId), loadTransportSource(tripId)])
  return { payments: payments.filter((item) => item.tripId === tripId && item.userCpf === cpf).map((item) => ({ id: item.id, paidInstallments: item.paidInstallments, totalInstallments: item.totalInstallments })), rooms: rooms.rooms.filter((room) => room.occupants.includes(cpf)), seats: seats.seats.filter((seat) => seat.userCpf === cpf) }
}
