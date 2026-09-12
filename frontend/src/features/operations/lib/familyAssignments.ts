import { stripCpf } from '../../../shared/validation/cpf'
import type { BusConfig } from '../../trips/model/tripTypes'
import type { SystemUser } from '../../users/model/userTypes'
import type {
  HotelConfig,
  RoomRecord,
  SeatRecord,
} from '../model/operationTypes'
import { busFloorCapacity } from './transportOperations'

export interface FamilyAssignmentResult<T> {
  assignedCount: number
  records: T[]
  warnings: string[]
}

function normalizedName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-BR')
}

export function buildFamilyGroups(users: SystemUser[], travelerCpfs: string[]) {
  const order = [...new Set(travelerCpfs.map(stripCpf).filter(Boolean))]
  const allowed = new Set(order)
  const usersByCpf = new Map(users.map((user) => [stripCpf(user.cpf), user]))
  const adjacency = new Map(order.map((cpf) => [cpf, new Set<string>()]))
  const names = new Map<string, string[]>()

  for (const cpf of order) {
    const user = usersByCpf.get(cpf)
    if (!user) continue
    const key = normalizedName(user.name)
    names.set(key, [...(names.get(key) ?? []), cpf])
  }

  const link = (leftValue: string, rightValue: string) => {
    const left = stripCpf(leftValue)
    const right = stripCpf(rightValue)
    if (!left || !right || left === right || !allowed.has(left) || !allowed.has(right)) return
    adjacency.get(left)?.add(right)
    adjacency.get(right)?.add(left)
  }
  const linkUniqueName = (cpf: string, name: string) => {
    const matches = names.get(normalizedName(name))?.filter((value) => value !== cpf) ?? []
    if (matches.length === 1) link(cpf, matches[0])
  }

  for (const cpf of order) {
    const user = usersByCpf.get(cpf)
    if (!user) continue
    link(cpf, user.spouseCpf)
    for (const childCpf of user.childCpfs) link(cpf, childCpf)
    if (!user.spouseCpf && user.spouseName) linkUniqueName(cpf, user.spouseName)
    if (user.childCpfs.length === 0) {
      for (const childName of user.kids) linkUniqueName(cpf, childName)
    }
  }

  const visited = new Set<string>()
  const groups: string[][] = []
  for (const cpf of order) {
    if (visited.has(cpf)) continue
    const group: string[] = []
    const queue = [cpf]
    visited.add(cpf)
    while (queue.length) {
      const current = queue.shift()!
      group.push(current)
      for (const relative of adjacency.get(current) ?? []) {
        if (!visited.has(relative)) {
          visited.add(relative)
          queue.push(relative)
        }
      }
    }
    groups.push(group)
  }
  return groups.sort((left, right) => right.length - left.length)
}

export function assignFamiliesToRooms(
  hotels: HotelConfig[],
  currentRooms: RoomRecord[],
  users: SystemUser[],
  travelerCpfs: string[],
  tripId: string,
): FamilyAssignmentResult<RoomRecord> {
  const definitions = hotels.flatMap((hotel) =>
    hotel.rooms.map((room) => ({ hotel, room })),
  )
  const currentById = new Map(currentRooms.map((room) => [room.id, room]))
  const records = definitions.map(({ hotel, room }) => {
    const existing = currentById.get(String(room.id))
    return {
      capacity: room.capacity,
      hotelId: String(hotel.id),
      id: String(room.id),
      name: room.name,
      occupants: [...(existing?.occupants ?? [])],
      tripId,
      type: room.type,
    }
  })
  const occupied = new Set(records.flatMap((room) => room.occupants.map(stripCpf)))
  const warnings: string[] = []
  let assignedCount = 0

  for (const group of buildFamilyGroups(users, travelerCpfs)) {
    const pending = group.filter((cpf) => !occupied.has(cpf))
    if (!pending.length) continue
    const familyRooms = new Set(
      records.filter((room) => room.occupants.some((cpf) => group.includes(cpf))).map((room) => room.id),
    )
    const usedRooms = new Set(familyRooms)

    while (pending.length) {
      const candidates = records
        .map((room) => ({ room, free: room.capacity - room.occupants.length }))
        .filter(({ free }) => free > 0)
        .sort((left, right) => {
          const leftFamily = familyRooms.has(left.room.id) ? 1 : 0
          const rightFamily = familyRooms.has(right.room.id) ? 1 : 0
          if (leftFamily !== rightFamily) return rightFamily - leftFamily
          const leftFits = left.free >= pending.length ? 1 : 0
          const rightFits = right.free >= pending.length ? 1 : 0
          if (leftFits !== rightFits) return rightFits - leftFits
          const leftEmpty = left.room.occupants.length === 0 ? 1 : 0
          const rightEmpty = right.room.occupants.length === 0 ? 1 : 0
          if (leftEmpty !== rightEmpty) return rightEmpty - leftEmpty
          return leftFits ? left.free - right.free : right.free - left.free
        })
      const target = candidates[0]
      if (!target) break
      const occupants = pending.splice(0, target.free)
      target.room.occupants.push(...occupants)
      occupants.forEach((cpf) => occupied.add(cpf))
      assignedCount += occupants.length
      usedRooms.add(target.room.id)
    }

    if (pending.length) {
      warnings.push(`${pending.length} integrante(s) de uma família ficaram sem quarto por falta de vagas.`)
    } else if (group.length > 1 && usedRooms.size > 1) {
      warnings.push('Uma família precisou ser dividida entre quartos porque não havia capacidade conjunta.')
    }
  }

  return { assignedCount, records, warnings: [...new Set(warnings)] }
}

interface SeatPosition {
  busId: string
  floor: number
  seatNumber: number
}

function positionKey(position: SeatPosition) {
  return `${position.busId}\n${position.floor}\n${position.seatNumber}`
}

function seatId(tripId: string, position: SeatPosition, cpf: string) {
  return `auto_${tripId}_${position.busId}_${position.floor}_${position.seatNumber}_${cpf}`
    .replace(/[^a-zA-Z0-9_-]/g, '_')
}

export function assignFamiliesToSeats(
  buses: BusConfig[],
  currentSeats: SeatRecord[],
  users: SystemUser[],
  travelerCpfs: string[],
  tripId: string,
): FamilyAssignmentResult<SeatRecord> {
  const positions: SeatPosition[] = buses.flatMap((bus) =>
    Array.from({ length: bus.floors }, (_, index) => index + 1).flatMap((floor) =>
      Array.from({ length: busFloorCapacity(bus, floor) }, (_, index) => ({
        busId: String(bus.id),
        floor,
        seatNumber: index + 1,
      })),
    ),
  )
  const occupiedPositions = new Set(currentSeats.map(positionKey))
  const seated = new Set(currentSeats.map((seat) => stripCpf(seat.userCpf)))
  const records = currentSeats.map((seat) => ({ ...seat }))
  const warnings: string[] = []
  let assignedCount = 0

  for (const group of buildFamilyGroups(users, travelerCpfs)) {
    const pending = group.filter((cpf) => !seated.has(cpf))
    if (!pending.length) continue
    const anchors = records.filter((seat) => group.includes(stripCpf(seat.userCpf)))
    const usedFloors = new Set(anchors.map((seat) => `${seat.busId}\n${seat.floor}`))

    while (pending.length) {
      const freeByFloor = new Map<string, SeatPosition[]>()
      for (const position of positions) {
        if (occupiedPositions.has(positionKey(position))) continue
        const key = `${position.busId}\n${position.floor}`
        freeByFloor.set(key, [...(freeByFloor.get(key) ?? []), position])
      }
      const floorOptions = [...freeByFloor.entries()].sort(([leftKey, left], [rightKey, right]) => {
        const leftAnchor = usedFloors.has(leftKey) ? 1 : 0
        const rightAnchor = usedFloors.has(rightKey) ? 1 : 0
        if (leftAnchor !== rightAnchor) return rightAnchor - leftAnchor
        const leftFits = left.length >= pending.length ? 1 : 0
        const rightFits = right.length >= pending.length ? 1 : 0
        if (leftFits !== rightFits) return rightFits - leftFits
        return right.length - left.length
      })
      const selectedFloor = floorOptions[0]
      if (!selectedFloor) break
      const [floorKey, free] = selectedFloor
      const floorAnchors = anchors.filter((seat) => `${seat.busId}\n${seat.floor}` === floorKey)
      free.sort((left, right) => {
        if (floorAnchors.length) {
          const leftDistance = Math.min(...floorAnchors.map((seat) => Math.abs(seat.seatNumber - left.seatNumber)))
          const rightDistance = Math.min(...floorAnchors.map((seat) => Math.abs(seat.seatNumber - right.seatNumber)))
          if (leftDistance !== rightDistance) return leftDistance - rightDistance
        }
        return left.seatNumber - right.seatNumber
      })
      const count = Math.min(pending.length, free.length)
      const chosen = free.slice(0, count).sort((left, right) => left.seatNumber - right.seatNumber)
      const cpfs = pending.splice(0, count)
      chosen.forEach((position, index) => {
        const cpf = cpfs[index]
        records.push({
          ...position,
          id: seatId(tripId, position, cpf),
          tripId,
          userCpf: cpf,
        })
        occupiedPositions.add(positionKey(position))
        seated.add(cpf)
        assignedCount += 1
      })
      usedFloors.add(floorKey)
    }

    if (pending.length) {
      warnings.push(`${pending.length} integrante(s) de uma família ficaram sem assento por falta de vagas.`)
    } else if (group.length > 1 && usedFloors.size > 1) {
      warnings.push('Uma família precisou ser dividida entre pisos ou ônibus por falta de assentos próximos.')
    }
  }

  return { assignedCount, records, warnings: [...new Set(warnings)] }
}
