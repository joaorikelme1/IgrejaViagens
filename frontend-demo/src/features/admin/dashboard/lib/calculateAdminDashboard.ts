import type { Trip } from '../../../trips/model/tripTypes'
import type {
  AdminDashboardIndicators,
  AdminDashboardSource,
} from '../model/adminDashboardTypes'

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function calculateAdminDashboard(
  trip: Trip,
  source: AdminDashboardSource,
): AdminDashboardIndicators {
  const travelerCpfs = new Set(trip.travelerCpfs)
  const tripPayments = source.payments.filter(
    (payment) => payment.tripId === trip.id && travelerCpfs.has(payment.userCpf),
  )
  const tripUsers = trip.travelerCpfs.flatMap((cpf) => {
    const user = source.users.find((candidate) => candidate.cpf === cpf)
    return user ? [user] : []
  })
  const busIds = new Set(trip.buses.map((bus) => String(bus.id)))
  const occupiedSeats = new Set(
    source.seats
      .filter(
        (seat) =>
          seat.tripId === trip.id &&
          seat.userCpf &&
          (busIds.size === 0 || busIds.has(seat.busId)),
      )
      .map((seat) => seat.id),
  ).size
  const totalSeats = trip.buses.reduce(
    (total, bus) => total + Math.max(0, Number(bus.seats) || 0),
    0,
  )

  let paidInstallments = 0
  let pendingInstallments = 0
  let collectedAmount = 0
  let pendingReceipts = 0

  for (const payment of tripPayments) {
    const total = Math.max(0, payment.totalInstallments)
    const paid = clamp(payment.paidInstallments, 0, total)
    paidInstallments += paid
    pendingInstallments += Math.max(0, total - paid)
    pendingReceipts += payment.receipts.filter(
      (receipt) => receipt.status === 'pending',
    ).length
    if (total > 0) collectedAmount += (trip.price / total) * paid
  }

  const arrecadationGoal =
    trip.arrecadationGoal > 0
      ? trip.arrecadationGoal
      : trip.price * trip.travelerCpfs.length

  return {
    arrecadationGoal,
    arrecadationPercentage:
      arrecadationGoal > 0
        ? clamp((collectedAmount / arrecadationGoal) * 100, 0, 100)
        : 0,
    collectedAmount,
    installmentRows: tripUsers.map((user) => {
      const payment = tripPayments.find((item) => item.userCpf === user.cpf)
      return {
        name: user.name.split(' ')[0] || user.name,
        paid: payment
          ? clamp(payment.paidInstallments, 0, payment.totalInstallments)
          : 0,
        total: payment?.totalInstallments ?? 0,
      }
    }),
    occupiedSeats,
    paidInstallments,
    pendingInstallments,
    pendingReceipts,
    // A API atual não fornece createdAt; a ordem de travelersJson é a aproximação.
    recentTravelers: tripUsers.slice(-5).reverse(),
    totalSeats,
    totalTravelers: trip.travelerCpfs.length,
  }
}
