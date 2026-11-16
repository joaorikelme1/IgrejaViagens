import { supabase, unwrap } from '../../../infrastructure/supabase/client'
import type { BusConfig } from '../../trips/model/tripTypes'
import { listUsers } from '../../users/api/usersApi'
import type { HotelConfig, HotelSource, RoomRecord, SeatRecord, TransportSource } from '../model/operationTypes'

const text = (value: unknown, fallback = '') => typeof value === 'string' || typeof value === 'number' ? String(value) : fallback
const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0

export function toRoom(value: unknown, index = 0): RoomRecord | null {
  if (!value || typeof value !== 'object') return null
  const room = value as Record<string, unknown>
  const tripId = text(room.trip_id ?? room.tripId)
  if (!tripId) return null
  const occupants = Array.isArray(room.room_occupants) ? room.room_occupants.flatMap((item) => { const profile = (item as { profiles?: { cpf?: string } }).profiles; return profile?.cpf ? [profile.cpf] : [] }) : (Array.isArray(room.occupants) ? room.occupants.map((item) => text(item)) : [])
  return { id: text(room.id, `room-${index}`), tripId, hotelId: text(room.hotel_id ?? room.hotelId), name: text(room.name), type: text(room.room_type ?? room.type, 'custom'), capacity: number(room.capacity), occupants }
}

export function toSeat(value: unknown, index = 0): SeatRecord | null {
  if (!value || typeof value !== 'object') return null
  const seat = value as Record<string, unknown>
  const tripId = text(seat.trip_id ?? seat.tripId); const busId = text(seat.bus_id ?? seat.busId)
  if (!tripId || !busId) return null
  return { id: text(seat.id, `seat-${index}`), tripId, busId, floor: number(seat.floor), seatNumber: number(seat.seat_number ?? seat.seatNumber), userCpf: text((seat.profiles as { cpf?: string } | null)?.cpf ?? seat.userCpf) }
}

export async function saveHotelStructure(tripId: string, hotels: HotelConfig[]) {
  unwrap(await supabase.rpc('replace_hotels', { p_trip_id: tripId, p_hotels: hotels.map((hotel) => ({ name: hotel.name, rooms: hotel.rooms.map((room) => ({ name: room.name, room_type: room.type, capacity: room.capacity })) })) }))
}

export async function saveBusStructure(tripId: string, buses: BusConfig[]) {
  unwrap(await supabase.rpc('replace_buses', { p_trip_id: tripId, p_buses: buses.map((bus) => ({ floors: bus.floors, seats_floor1: bus.seatsFloor1, seats_floor2: bus.seatsFloor2 })) }))
}

export async function loadHotelSource(tripId: string): Promise<HotelSource> {
  const value = unwrap<unknown[]>(await supabase.from('rooms').select('id, trip_id, hotel_id, name, room_type, capacity, room_occupants(profiles(cpf))').eq('trip_id', tripId))
  const users = await listUsers()
  return { rooms: value.map(toRoom).filter((room): room is RoomRecord => room !== null), users }
}

export async function saveRoomRecord(room: RoomRecord) {
  const row = unwrap<{ id: string }>(await supabase.from('rooms').upsert({ id: room.id, trip_id: room.tripId, hotel_id: room.hotelId, name: room.name, room_type: room.type, capacity: room.capacity }).select('id, trip_id, hotel_id, name, room_type, capacity').single())
  await saveTripRoomAssignments(room.tripId, [{ ...room, id: row.id }])
  return { ...room, id: row.id }
}

export async function saveTripRoomAssignments(tripId: string, rooms: RoomRecord[]) {
  const profiles = unwrap<{ id: string; cpf: string }[]>(await supabase.from('profiles').select('id, cpf').in('cpf', [...new Set(rooms.flatMap((room) => room.occupants))]))
  const idByCpf = new Map(profiles.map((profile) => [profile.cpf, profile.id]))
  unwrap(await supabase.rpc('replace_room_assignments', { p_trip_id: tripId, p_rooms: rooms.map((room) => ({ id: room.id, occupants: room.occupants.map((cpf) => idByCpf.get(cpf)).filter(Boolean) })) }))
  return rooms
}

export async function deleteRoomRecords(_tripId: string, roomIds: string[]) { if (roomIds.length) unwrap(await supabase.from('rooms').delete().in('id', [...new Set(roomIds)])) }

export async function loadTransportSource(tripId: string): Promise<TransportSource> {
  const value = unwrap<unknown[]>(await supabase.from('seat_assignments').select('id, trip_id, bus_id, floor, seat_number, profiles(cpf)').eq('trip_id', tripId))
  const users = await listUsers()
  return { seats: value.map(toSeat).filter((seat): seat is SeatRecord => seat !== null), users }
}

export async function saveSeatRecord(seat: SeatRecord) { const rows = await saveTripSeatAssignments(seat.tripId, [seat]); return rows[0] }

export async function saveTripSeatAssignments(tripId: string, seats: SeatRecord[]) {
  const profiles = unwrap<{ id: string; cpf: string }[]>(await supabase.from('profiles').select('id, cpf').in('cpf', [...new Set(seats.map((seat) => seat.userCpf))]))
  const idByCpf = new Map(profiles.map((profile) => [profile.cpf, profile.id]))
  unwrap(await supabase.rpc('replace_seat_assignments', { p_trip_id: tripId, p_seats: seats.map((seat) => ({ busId: seat.busId, floor: seat.floor, seatNumber: seat.seatNumber, travelerId: idByCpf.get(seat.userCpf) })) }))
  return seats
}

export async function deleteSeats(tripId: string, predicate: (seat: SeatRecord) => boolean) {
  const current = await loadTransportSource(tripId)
  const remaining = current.seats.filter((seat) => !predicate(seat))
  await saveTripSeatAssignments(tripId, remaining)
}
