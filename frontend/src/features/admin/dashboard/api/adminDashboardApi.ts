import { listPayments } from '../../../payments/api/paymentApi'
import { loadTransportSource } from '../../../operations/api/operationsApi'
import { listTrips } from '../../../trips/api/tripApi'
import { listUsers } from '../../../users/api/usersApi'
import type { AdminDashboardSource } from '../model/adminDashboardTypes'

export async function loadAdminDashboard(): Promise<AdminDashboardSource> {
  const [users, payments, trips] = await Promise.all([listUsers(), listPayments(), listTrips()])
  const seats = (await Promise.all(trips.map((trip) => loadTransportSource(trip.id)))).flatMap((source) => source.seats)
  return { users: users.map((user) => ({ cpf: user.cpf, name: user.name })), payments: payments.map((payment) => ({ userCpf: payment.userCpf, tripId: payment.tripId, totalInstallments: payment.totalInstallments, paidInstallments: payment.paidInstallments, receipts: Object.values(payment.receipts).map((receipt) => ({ status: receipt.status })) })), seats: seats.map((seat) => ({ id: seat.id, tripId: seat.tripId, busId: seat.busId, userCpf: seat.userCpf })) }
}
