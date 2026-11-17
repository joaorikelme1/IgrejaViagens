import { supabase, unwrap } from '../../../infrastructure/supabase/client'
import type { BusConfig, Trip } from '../model/tripTypes'

type TripRow = { id: string; version: number; updated_at: string; name: string; destination: string; departure_place: string; departure_time: string | null; departure_date: string | null; max_people: number; price: number; arrecadation_goal: number; rules: string }
type BusRow = { id: string; trip_id: string; label: string; company: string; plate: string; driver_name: string; floors: number; seats_floor1: number; seats_floor2: number }
type HotelRow = { id: string; trip_id: string; name: string; address: string; notes: string; rooms: { id: string; name: string; room_type: string; capacity: number }[] | null }
type MembershipRow = { trip_id: string; profiles: { cpf: string } | null }

const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0

function busesToApi(buses: BusConfig[]) {
  return buses.map((bus) => ({ id: String(bus.id), label: bus.label ?? '', company: bus.company ?? '', plate: bus.plate ?? '', driver_name: bus.driverName ?? '', floors: bus.floors, seats_floor1: bus.seatsFloor1, seats_floor2: bus.seatsFloor2 }))
}

export function toTrip(value: unknown): Trip | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Partial<TripRow> & { buses?: BusConfig[]; hotels?: unknown[]; travelerCpfs?: string[] }
  if (!row.id) return null
  return { id: row.id, version: number(row.version), updatedAt: row.updated_at, name: row.name || 'Viagem sem nome', destination: row.destination || '', departurePlace: row.departure_place || '', departureTime: row.departure_time || '', date: row.departure_date || '', maxPeople: number(row.max_people) || 1, price: number(row.price), arrecadationGoal: number(row.arrecadation_goal), rules: row.rules || '', buses: row.buses ?? [], hotelsJson: JSON.stringify(row.hotels ?? []), travelersJson: JSON.stringify(row.travelerCpfs ?? []), travelerCpfs: row.travelerCpfs ?? [] }
}

async function hydrate(rows: TripRow[]) {
  if (!rows.length) return []
  const ids = rows.map((row) => row.id)
  const buses = unwrap<BusRow[]>(await supabase.from('buses').select('id, trip_id, label, company, plate, driver_name, floors, seats_floor1, seats_floor2').in('trip_id', ids))
  const hotels = unwrap<HotelRow[]>(await supabase.from('hotels').select('id, trip_id, name, address, notes, rooms(id,name,room_type,capacity)').in('trip_id', ids))
  const memberships = unwrap<MembershipRow[]>(await supabase.from('trip_travelers').select('trip_id, profiles(cpf)').in('trip_id', ids))
  return rows.map((row) => toTrip({ ...row,
    buses: buses.filter((bus) => bus.trip_id === row.id).map((bus) => ({ id: bus.id, label: bus.label, company: bus.company, plate: bus.plate, driverName: bus.driver_name, floors: bus.floors, seatsFloor1: bus.seats_floor1, seatsFloor2: bus.seats_floor2, seats: bus.seats_floor1 + bus.seats_floor2 })),
    hotels: hotels.filter((hotel) => hotel.trip_id === row.id).map((hotel) => ({ id: hotel.id, name: hotel.name, address: hotel.address, notes: hotel.notes, rooms: (hotel.rooms ?? []).map((room) => ({ id: room.id, name: room.name, type: room.room_type, capacity: room.capacity })) })),
    travelerCpfs: memberships.filter((member) => member.trip_id === row.id).flatMap((member) => member.profiles?.cpf ? [member.profiles.cpf] : []),
  })!).filter((trip): trip is Trip => trip !== null)
}

export async function listTrips() {
  const rows = unwrap<TripRow[]>(await supabase.from('trips').select('id, version, updated_at, name, destination, departure_place, departure_time, departure_date, max_people, price, arrecadation_goal, rules').order('departure_date', { ascending: true }))
  return hydrate(rows)
}

export function tripToApi(trip: Trip) {
  return { name: trip.name.trim(), destination: trip.destination.trim(), departure_place: trip.departurePlace.trim(), departure_time: trip.departureTime || null, departure_date: trip.date || null, max_people: trip.maxPeople, price: trip.price, arrecadation_goal: trip.arrecadationGoal, rules: trip.rules }
}

export async function createTripRecord(trip: Trip) {
  const row = unwrap<TripRow>(await supabase.from('trips').insert(tripToApi(trip)).select('id, version, updated_at, name, destination, departure_place, departure_time, departure_date, max_people, price, arrecadation_goal, rules').single())
  if (trip.buses.length) unwrap(await supabase.rpc('replace_buses', { p_trip_id: row.id, p_buses: busesToApi(trip.buses) }))
  return (await hydrate([row]))[0]
}

export async function updateTripRecord(trip: Trip) {
  let query = supabase.from('trips').update(tripToApi(trip)).eq('id', trip.id)
  if (trip.version !== undefined) query = query.eq('version', trip.version)
  const row = unwrap<TripRow>(await query.select('id, version, updated_at, name, destination, departure_place, departure_time, departure_date, max_people, price, arrecadation_goal, rules').single())
  unwrap(await supabase.rpc('replace_buses', { p_trip_id: row.id, p_buses: busesToApi(trip.buses) }))
  return (await hydrate([row]))[0]
}
