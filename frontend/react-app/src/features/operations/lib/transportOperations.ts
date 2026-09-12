import { stripCpf } from '../../../shared/validation/cpf'
import type { BusConfig } from '../../trips/model/tripTypes'
import type { SeatConflict, SeatRecord } from '../model/operationTypes'
import { createUniqueId } from './hotelOperations'

export function busFloorCapacity(bus: BusConfig, floor: number) {
  if (floor === 1) return Math.max(0, Math.trunc(bus.seatsFloor1))
  if (floor === 2 && bus.floors === 2) {
    return Math.max(0, Math.trunc(bus.seatsFloor2))
  }
  return 0
}

export function createBus(buses: BusConfig[]): BusConfig {
  return {
    id: createUniqueId('bus', buses.map((bus) => bus.id)),
    floors: 1,
    seatsFloor1: 44,
    seatsFloor2: 0,
    seats: 44,
  }
}

export function updateBus(
  buses: BusConfig[],
  busId: string | number,
  patch: Pick<BusConfig, 'floors' | 'seatsFloor1' | 'seatsFloor2'>,
) {
  const floors = patch.floors === 2 ? 2 : 1
  const seatsFloor1 = Math.max(1, Math.trunc(patch.seatsFloor1) || 1)
  const seatsFloor2 =
    floors === 2 ? Math.max(1, Math.trunc(patch.seatsFloor2) || 1) : 0
  return buses.map((bus) =>
    String(bus.id) === String(busId)
      ? {
          ...bus,
          floors,
          id: bus.id,
          seats: seatsFloor1 + seatsFloor2,
          seatsFloor1,
          seatsFloor2,
        }
      : bus,
  )
}

export function removeBus(buses: BusConfig[], busId: string | number) {
  return buses.filter((bus) => String(bus.id) !== String(busId))
}

export function assertBusResizeKeepsSeats(
  bus: BusConfig,
  next: Pick<BusConfig, 'floors' | 'seatsFloor1' | 'seatsFloor2'>,
  seats: SeatRecord[],
) {
  const nextBus = updateBus([bus], bus.id, next)[0]
  const invalid = seats.find(
    (seat) =>
      seat.busId === String(bus.id) &&
      (seat.floor > nextBus.floors ||
        seat.seatNumber > busFloorCapacity(nextBus, seat.floor)),
  )
  if (invalid) {
    throw new Error(
      `A nova capacidade removeria o assento ${invalid.seatNumber} do piso ${invalid.floor}. Libere-o antes de editar o ônibus.`,
    )
  }
  return nextBus
}

export function seatAt(
  seats: SeatRecord[],
  busId: string | number,
  floor: number,
  seatNumber: number,
) {
  return seats.find(
    (seat) =>
      seat.busId === String(busId) &&
      seat.floor === floor &&
      seat.seatNumber === seatNumber,
  )
}

export function getSeatConflicts(
  buses: BusConfig[],
  seats: SeatRecord[],
  travelerCpfs: string[],
): SeatConflict[] {
  const conflicts: SeatConflict[] = []
  const allowed = new Set(travelerCpfs.map(stripCpf))
  const positions = new Map<string, SeatRecord[]>()
  seats.forEach((seat) => {
    const bus = buses.find((item) => String(item.id) === seat.busId)
    const position = `${seat.busId}-${seat.floor}-${seat.seatNumber}`
    positions.set(position, [...(positions.get(position) ?? []), seat])
    if (!bus) {
      conflicts.push({
        busId: seat.busId,
        key: `missing-bus-${seat.id}`,
        message: `O assento ${seat.seatNumber} referencia o ônibus inexistente ${seat.busId}.`,
      })
    } else if (
      seat.floor < 1 ||
      seat.floor > bus.floors ||
      seat.seatNumber < 1 ||
      seat.seatNumber > busFloorCapacity(bus, seat.floor)
    ) {
      conflicts.push({
        busId: seat.busId,
        floor: seat.floor,
        key: `outside-capacity-${seat.id}`,
        message: `O assento ${seat.seatNumber} do piso ${seat.floor} está fora da capacidade do ônibus ${seat.busId}.`,
        seatNumber: seat.seatNumber,
      })
    }
    if (seat.floor === 1 && seat.seatNumber === 1) {
      conflicts.push({
        busId: seat.busId,
        floor: seat.floor,
        key: `driver-seat-${seat.id}`,
        message: `O assento reservado ao motorista no ônibus ${seat.busId} possui ocupante.`,
        seatNumber: seat.seatNumber,
      })
    }
    if (!allowed.has(stripCpf(seat.userCpf))) {
      conflicts.push({
        busId: seat.busId,
        floor: seat.floor,
        key: `non-member-${seat.id}`,
        message: `O CPF ${seat.userCpf} ocupa um assento, mas não pertence à viagem.`,
        seatNumber: seat.seatNumber,
      })
    }
  })
  positions.forEach((matches, position) => {
    if (matches.length > 1) {
      conflicts.push({
        busId: matches[0].busId,
        floor: matches[0].floor,
        key: `duplicate-seat-${position}`,
        message: `Há ${matches.length} ocupações para o mesmo assento ${matches[0].seatNumber}.`,
        seatNumber: matches[0].seatNumber,
      })
    }
  })
  return conflicts
}
