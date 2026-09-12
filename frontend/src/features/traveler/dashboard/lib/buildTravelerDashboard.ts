import type { Trip } from '../../../trips/model/tripTypes'
import type {
  TravelerDashboardSource,
  TravelerDashboardView,
  TravelerPaymentView,
  TravelerRoomRecord,
  TravelerRoomView,
  TravelerSeatGroup,
} from '../model/travelerDashboardTypes'

function maskCompanionCpf(cpf: string) {
  return `Viajante · CPF final ${cpf.slice(-4).padStart(4, '•')}`
}

function roomTypeLabel(type: string) {
  const normalized = type.trim().toLowerCase()
  if (normalized === 'single' || normalized === 'individual') return 'Individual'
  if (normalized === 'double' || normalized === 'duplo') return 'Duplo'
  if (normalized === 'family' || normalized === 'familiar') return 'Familiar'
  return type.trim()
}

function buildRoom(
  room: TravelerRoomRecord | undefined,
  travelerCpf: string,
): TravelerRoomView | null {
  if (!room) return null
  const type = roomTypeLabel(room.type)
  const roomName = room.name || `Quarto ${room.id}`

  return {
    id: room.id,
    hotelId: room.hotelId,
    label: type ? `${roomName} · ${type}` : roomName,
    companions: room.occupants
      .filter((cpf) => cpf !== travelerCpf)
      .map(maskCompanionCpf),
  }
}

function buildPayment(
  source: TravelerDashboardSource,
  warnings: string[],
): TravelerPaymentView {
  if (source.payments.length === 0) {
    return {
      paidInstallments: 0,
      percentage: 0,
      status: 'unconfigured',
      totalInstallments: 0,
    }
  }

  if (source.payments.length > 1) {
    warnings.push(
      'Há mais de um pagamento associado ao seu CPF nesta viagem. Exibindo o primeiro registro.',
    )
  }

  const payment = source.payments[0]
  const total = Math.max(0, Math.trunc(payment.totalInstallments))
  if (total === 0) {
    warnings.push('O plano de pagamento possui uma quantidade de parcelas inválida.')
    return {
      paidInstallments: 0,
      percentage: 0,
      status: 'pending',
      totalInstallments: 0,
    }
  }

  const paid = Math.min(Math.max(0, Math.trunc(payment.paidInstallments)), total)
  const percentage = Math.round((paid / total) * 100)

  return {
    paidInstallments: paid,
    percentage,
    status:
      percentage === 100
        ? 'confirmed'
        : percentage > 0
          ? 'partial'
          : 'pending',
    totalInstallments: total,
  }
}

function buildSeats(
  trip: Trip,
  source: TravelerDashboardSource,
  warnings: string[],
): TravelerSeatGroup[] {
  const configuredBuses = new Map(
    trip.buses.map((bus) => [String(bus.id), bus] as const),
  )
  const groups = new Map<string, TravelerSeatGroup>()
  let ignoredInvalidSeat = false

  for (const seat of source.seats) {
    const seatNumber = Math.trunc(seat.seatNumber)
    const floor = Math.trunc(seat.floor)
    if (!seat.busId || seatNumber < 1 || (floor !== 1 && floor !== 2)) {
      ignoredInvalidSeat = true
      continue
    }

    const bus = configuredBuses.get(seat.busId)
    if (!bus) {
      warnings.push(`O assento ${seatNumber} referencia um ônibus não configurado.`)
    } else {
      const capacity = floor === 2 ? bus.seatsFloor2 : bus.seatsFloor1
      if (floor > bus.floors || seatNumber > capacity) {
        warnings.push(
          `O assento ${seatNumber} do ônibus ${seat.busId} está fora da configuração atual.`,
        )
      }
    }

    const key = `${seat.busId}:${floor}`
    const group = groups.get(key) ?? {
      busId: seat.busId,
      floor,
      seatNumbers: [],
    }
    if (!group.seatNumbers.includes(seatNumber)) group.seatNumbers.push(seatNumber)
    groups.set(key, group)
  }

  if (ignoredInvalidSeat) {
    warnings.push('Um registro de assento inválido foi ignorado.')
  }

  const busCount = new Set([...groups.values()].map((seat) => seat.busId)).size
  if (busCount > 1) {
    warnings.push('Foram encontrados assentos em mais de um ônibus para o seu CPF.')
  }

  return [...groups.values()].map((group) => ({
    ...group,
    seatNumbers: [...group.seatNumbers].sort((a, b) => a - b),
  }))
}

export function buildTravelerDashboard(
  travelerCpf: string,
  trip: Trip,
  source: TravelerDashboardSource,
): TravelerDashboardView {
  const warnings: string[] = []

  if (source.rooms.length > 1) {
    warnings.push(
      'Há mais de um quarto associado ao seu CPF nesta viagem. Exibindo o primeiro registro.',
    )
  }

  return {
    payment: buildPayment(source, warnings),
    room: buildRoom(source.rooms[0], travelerCpf),
    seats: buildSeats(trip, source, warnings),
    warnings: [...new Set(warnings)],
  }
}
