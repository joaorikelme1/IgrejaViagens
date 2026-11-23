import { nextDemoId, readDemoState, updateDemoState } from '../../../demo/demoStore'
import type { BusConfig } from '../../trips/model/tripTypes'
import { listUsers } from '../../users/api/usersApi'
import type { HotelConfig, HotelSource, RoomRecord, SeatRecord, TransportSource } from '../model/operationTypes'

const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

export function toRoom(value: unknown, index = 0): RoomRecord | null {
  if (!value || typeof value !== 'object') return null
  const room = value as Partial<RoomRecord>
  if (!room.tripId) return null
  return { id: room.id || `room-${index}`, tripId: room.tripId, hotelId: room.hotelId ?? '', name: room.name ?? '', type: room.type ?? 'custom', capacity: Number(room.capacity) || 0, occupants: room.occupants ?? [] }
}

export function toSeat(value: unknown, index = 0): SeatRecord | null {
  if (!value || typeof value !== 'object') return null
  const seat = value as Partial<SeatRecord>
  if (!seat.tripId || !seat.busId) return null
  return { id: seat.id || `seat-${index}`, tripId: seat.tripId, busId: seat.busId, floor: Number(seat.floor) || 1, seatNumber: Number(seat.seatNumber) || 1, userCpf: seat.userCpf ?? '' }
}

export async function saveHotelStructure(tripId: string, hotels: HotelConfig[]) {
  updateDemoState((state) => {
    const trip = state.trips.find((item) => item.id === tripId)
    if (!trip) throw new Error('Viagem não encontrada.')
    trip.hotelsJson = JSON.stringify(hotels)
    const existing = new Map(state.rooms.filter((room) => room.tripId === tripId).map((room) => [room.id, room]))
    const ids = new Set(hotels.flatMap((hotel) => hotel.rooms.map((room) => String(room.id))))
    state.rooms = state.rooms.filter((room) => room.tripId !== tripId || ids.has(room.id))
    for (const hotel of hotels) for (const room of hotel.rooms) {
      const id = String(room.id)
      if (!existing.has(id)) state.rooms.push({ id, tripId, hotelId: String(hotel.id), name: room.name, type: room.type, capacity: room.capacity, occupants: [] })
    }
  })
}

export async function saveBusStructure(tripId: string, buses: BusConfig[]) {
  updateDemoState((state) => {
    const trip = state.trips.find((item) => item.id === tripId)
    if (!trip) throw new Error('Viagem não encontrada.')
    trip.buses = copy(buses)
    const ids = new Set(buses.map((bus) => String(bus.id)))
    state.seats = state.seats.filter((seat) => seat.tripId !== tripId || ids.has(seat.busId))
  })
}

export async function loadHotelSource(tripId: string): Promise<HotelSource> { return { rooms: copy(readDemoState().rooms.filter((room) => room.tripId === tripId)), users: await listUsers() } }

export async function saveRoomRecord(room: RoomRecord) {
  const saved = { ...copy(room), id: room.id || nextDemoId('room') }
  updateDemoState((state) => { const index = state.rooms.findIndex((item) => item.id === saved.id); if (index >= 0) state.rooms[index] = saved; else state.rooms.push(saved) })
  return saved
}

function assertTravelersExist(cpfs: string[]) {
  const existing = new Set(readDemoState().users.map((user) => user.cpf))
  const missing = cpfs.filter((cpf) => !existing.has(cpf))
  if (missing.length) throw new Error(`Viajante(s) não encontrado(s): ${missing.join(', ')}.`)
}

export async function saveTripRoomAssignments(tripId: string, rooms: RoomRecord[]) {
  assertTravelersExist(rooms.flatMap((room) => room.occupants))
  updateDemoState((state) => { state.rooms = [...state.rooms.filter((room) => room.tripId !== tripId), ...copy(rooms)] })
  return rooms
}

export async function deleteRoomRecords(tripId: string, roomIds: string[]) { updateDemoState((state) => { state.rooms = state.rooms.filter((room) => room.tripId !== tripId || !roomIds.includes(room.id)) }) }

export async function loadTransportSource(tripId: string): Promise<TransportSource> { return { seats: copy(readDemoState().seats.filter((seat) => seat.tripId === tripId)), users: await listUsers() } }

export async function saveSeatRecord(seat: SeatRecord) {
  assertTravelersExist([seat.userCpf])
  const saved = { ...copy(seat), id: seat.id || nextDemoId('seat') }
  updateDemoState((state) => { const index = state.seats.findIndex((item) => item.id === saved.id); if (index >= 0) state.seats[index] = saved; else state.seats.push(saved) })
  return saved
}

export async function saveTripSeatAssignments(tripId: string, seats: SeatRecord[]) {
  assertTravelersExist(seats.map((seat) => seat.userCpf))
  updateDemoState((state) => { state.seats = [...state.seats.filter((seat) => seat.tripId !== tripId), ...copy(seats)] })
  return seats
}

export async function saveTripAllocations(tripId: string, rooms: RoomRecord[], seats: SeatRecord[]) { await saveTripRoomAssignments(tripId, rooms); await saveTripSeatAssignments(tripId, seats); return { rooms, seats } }

export async function deleteSeats(tripId: string, predicate: (seat: SeatRecord) => boolean) { updateDemoState((state) => { state.seats = state.seats.filter((seat) => seat.tripId !== tripId || !predicate(seat)) }) }
