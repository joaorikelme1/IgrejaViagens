import { httpRequest } from '../../../../lib/http'
import { stripCpf } from '../../../../shared/validation/cpf'
import type {
  AdminDashboardSource,
  DashboardPayment,
  DashboardReceipt,
  DashboardSeat,
  DashboardUser,
} from '../model/adminDashboardTypes'

function records(value: unknown, label: string) {
  if (!Array.isArray(value)) throw new Error(`Resposta de ${label} inválida.`)
  return value.filter(
    (item): item is Record<string, unknown> =>
      typeof item === 'object' && item !== null && !Array.isArray(item),
  )
}

function number(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function receipts(value: unknown): DashboardReceipt[] {
  if (typeof value !== 'string' || !value.trim()) return []
  try {
    const parsed: unknown = JSON.parse(value)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return []
    }
    return Object.values(parsed).flatMap((receipt) => {
      if (typeof receipt !== 'object' || receipt === null) return []
      const status = (receipt as Record<string, unknown>).status
      return [{ status: typeof status === 'string' ? status : '' }]
    })
  } catch {
    return []
  }
}

function parseUsers(value: unknown): DashboardUser[] {
  return records(value, 'usuários').flatMap((user) => {
    const cpf = stripCpf(typeof user.cpf === 'string' ? user.cpf : '')
    if (!cpf) return []
    return [{ cpf, name: typeof user.name === 'string' ? user.name : 'Sem nome' }]
  })
}

function parsePayments(value: unknown): DashboardPayment[] {
  return records(value, 'pagamentos').flatMap((payment) => {
    const userCpf = stripCpf(
      typeof payment.userCpf === 'string'
        ? payment.userCpf
        : typeof payment.cpf === 'string'
          ? payment.cpf
          : '',
    )
    const tripId = typeof payment.tripId === 'string' ? payment.tripId : ''
    if (!userCpf || !tripId) return []
    return [
      {
        userCpf,
        tripId,
        totalInstallments: Math.max(0, number(payment.totalInstallments)),
        paidInstallments: Math.max(0, number(payment.paidInstallments)),
        receipts: receipts(payment.receiptsJson),
      },
    ]
  })
}

function parseSeats(value: unknown): DashboardSeat[] {
  return records(value, 'assentos').flatMap((seat, index) => {
    const tripId = typeof seat.tripId === 'string' ? seat.tripId : ''
    if (!tripId) return []
    return [
      {
        id: typeof seat.id === 'string' ? seat.id : `seat-${index}`,
        tripId,
        busId:
          typeof seat.busId === 'string' || typeof seat.busId === 'number'
            ? String(seat.busId)
            : '',
        userCpf: stripCpf(typeof seat.userCpf === 'string' ? seat.userCpf : ''),
      },
    ]
  })
}

export async function loadAdminDashboard(): Promise<AdminDashboardSource> {
  const [users, payments, seats] = await Promise.all([
    httpRequest<unknown>('/users'),
    httpRequest<unknown>('/payments'),
    httpRequest<unknown>('/seats'),
  ])

  return {
    users: parseUsers(users),
    payments: parsePayments(payments),
    seats: parseSeats(seats),
  }
}
