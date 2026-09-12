import { stripCpf } from '../../../shared/validation/cpf'
import type {
  HotelConfig,
  HotelRoomConfig,
  OperationId,
  RoomConflict,
  RoomRecord,
} from '../model/operationTypes'

type JsonRecord = Record<string, unknown>

function readId(value: unknown, fallback: string): OperationId {
  return typeof value === 'string' || typeof value === 'number'
    ? value
    : fallback
}

function readString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function readCapacity(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 1
}

function parseRoom(value: unknown, index: number): HotelRoomConfig | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }
  const source = value as JsonRecord
  const id = readId(source.id, `room_missing_id_${index + 1}`)
  return {
    ...source,
    capacity: readCapacity(source.capacity),
    id,
    name: readString(source.name, String(id)),
    type: readString(source.type, 'custom'),
  }
}

export function parseHotels(value: string): HotelConfig[] {
  try {
    const parsed: unknown = JSON.parse(value || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((entry, index) => {
      if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
        return []
      }
      const source = entry as JsonRecord
      const id = readId(source.id, `hotel_missing_id_${index + 1}`)
      const roomValues = Array.isArray(source.rooms) ? source.rooms : []
      return [{
        ...source,
        id,
        name: readString(source.name, `Hotel ${index + 1}`),
        rooms: roomValues
          .map(parseRoom)
          .filter((room): room is HotelRoomConfig => room !== null),
      }]
    })
  } catch {
    return []
  }
}

export function createUniqueId(prefix: string, existing: OperationId[]) {
  const base = `${prefix}_${Date.now()}`
  let candidate = base
  let suffix = 1
  const used = new Set(existing.map(String))
  while (used.has(candidate)) candidate = `${base}_${suffix++}`
  return candidate
}

export function addHotel(
  hotels: HotelConfig[],
  hotel: Pick<HotelConfig, 'id' | 'name'>,
) {
  return [...hotels, { ...hotel, rooms: [] }]
}

export function updateHotel(
  hotels: HotelConfig[],
  hotelId: OperationId,
  name: string,
) {
  return hotels.map((hotel) =>
    String(hotel.id) === String(hotelId)
      ? { ...hotel, name: name.trim(), rooms: hotel.rooms }
      : hotel,
  )
}

export function removeHotel(hotels: HotelConfig[], hotelId: OperationId) {
  return hotels.filter((hotel) => String(hotel.id) !== String(hotelId))
}

export function addRoom(
  hotels: HotelConfig[],
  hotelId: OperationId,
  room: HotelRoomConfig,
) {
  const duplicate = hotels.some((hotel) =>
    hotel.rooms.some((item) => String(item.id) === String(room.id)),
  )
  if (duplicate) throw new Error('Já existe um quarto com este identificador.')
  return hotels.map((hotel) =>
    String(hotel.id) === String(hotelId)
      ? { ...hotel, rooms: [...hotel.rooms, room] }
      : hotel,
  )
}

export function updateRoom(
  hotels: HotelConfig[],
  hotelId: OperationId,
  roomId: OperationId,
  patch: Pick<HotelRoomConfig, 'capacity' | 'name' | 'type'>,
) {
  return hotels.map((hotel) =>
    String(hotel.id) === String(hotelId)
      ? {
          ...hotel,
          rooms: hotel.rooms.map((room) =>
            String(room.id) === String(roomId)
              ? { ...room, ...patch, id: room.id }
              : room,
          ),
        }
      : hotel,
  )
}

export function removeRoom(
  hotels: HotelConfig[],
  hotelId: OperationId,
  roomId: OperationId,
) {
  return hotels.map((hotel) =>
    String(hotel.id) === String(hotelId)
      ? {
          ...hotel,
          rooms: hotel.rooms.filter(
            (room) => String(room.id) !== String(roomId),
          ),
        }
      : hotel,
  )
}

export function roomOccupants(rooms: RoomRecord[], roomId: OperationId) {
  return rooms.find((room) => room.id === String(roomId))?.occupants ?? []
}

export function getRoomConflicts(
  hotels: HotelConfig[],
  rooms: RoomRecord[],
  travelerCpfs: string[],
): RoomConflict[] {
  const conflicts: RoomConflict[] = []
  const knownRooms = new Map<string, HotelRoomConfig[]>()
  hotels.forEach((hotel) => {
    hotel.rooms.forEach((room) => {
      const id = String(room.id)
      knownRooms.set(id, [...(knownRooms.get(id) ?? []), room])
    })
  })
  knownRooms.forEach((matches, roomId) => {
    if (matches.length > 1) {
      conflicts.push({
        key: `duplicate-room-${roomId}`,
        message: `O ID de quarto ${roomId} aparece em mais de um hotel.`,
        roomId,
      })
    }
  })

  const allowed = new Set(travelerCpfs.map(stripCpf))
  const byTraveler = new Map<string, string[]>()
  rooms.forEach((record) => {
    const definition = knownRooms.get(record.id)?.[0]
    if (!definition) {
      conflicts.push({
        key: `orphan-room-${record.id}`,
        message: `O quarto ${record.id} existe no backend, mas não em nenhum hotel.`,
        roomId: record.id,
      })
    } else if (record.occupants.length > definition.capacity) {
      conflicts.push({
        key: `capacity-${record.id}`,
        message: `O quarto ${record.id} excede a capacidade (${record.occupants.length}/${definition.capacity}).`,
        roomId: record.id,
      })
    }
    record.occupants.forEach((cpf) => {
      const normalized = stripCpf(cpf)
      byTraveler.set(normalized, [...(byTraveler.get(normalized) ?? []), record.id])
      if (!allowed.has(normalized)) {
        conflicts.push({
          key: `non-member-${record.id}-${normalized}`,
          message: `O CPF ${normalized} ocupa o quarto ${record.id}, mas não pertence à viagem.`,
          roomId: record.id,
        })
      }
    })
  })
  byTraveler.forEach((roomIds, cpf) => {
    const uniqueRooms = [...new Set(roomIds)]
    if (uniqueRooms.length > 1) {
      conflicts.push({
        key: `multiple-rooms-${cpf}`,
        message: `O CPF ${cpf} aparece nos quartos ${uniqueRooms.join(', ')}.`,
      })
    }
  })
  return conflicts
}

export function assertRoomCapacity(capacity: number, occupants: string[]) {
  const unique = [...new Set(occupants.map(stripCpf).filter(Boolean))]
  if (unique.length > capacity) {
    throw new Error(`Este quarto comporta no máximo ${capacity} pessoa(s).`)
  }
  return unique
}
