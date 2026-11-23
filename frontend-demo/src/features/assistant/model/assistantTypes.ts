import type { HotelConfig, RoomRecord, SeatRecord } from '../../operations/model/operationTypes'
import type { BusConfig, Trip } from '../../trips/model/tripTypes'
import type { SystemUser } from '../../users/model/userTypes'

export interface AssistantHotelDraft {
  address: string
  name: string
  notes: string
  rooms: Array<{ capacity: number; name: string; type: string }>
}

export interface AssistantBusDraft {
  company: string
  driverName: string
  floors: number
  label: string
  plate: string
  seatsFloor1: number
  seatsFloor2: number
}

export type AssistantIntent =
  | { kind: 'query_unassigned_seats' }
  | { kind: 'query_unassigned_rooms' }
  | { kind: 'query_unassigned_allocations' }
  | { kind: 'query_full_hotels' }
  | { kind: 'distribute_seats' }
  | { kind: 'distribute_rooms' }
  | { kind: 'distribute_allocations' }
  | { kind: 'create_hotels'; hotels: AssistantHotelDraft[] }
  | { kind: 'create_buses'; buses: AssistantBusDraft[] }
  | { kind: 'move_family_bus'; family: string; bus: string }
  | { kind: 'move_people_hotel'; people: string[]; hotel: string }

export type ParsedAssistantCommand =
  | { intent: AssistantIntent; clarification?: never }
  | { clarification: string; intent?: never }
  | { answer: string; clarification?: never; intent?: never }

export type AssistantOperation =
  | { kind: 'save_hotels'; hotels: HotelConfig[] }
  | { kind: 'save_buses'; buses: BusConfig[] }
  | { kind: 'save_rooms'; rooms: RoomRecord[] }
  | { kind: 'save_seats'; seats: SeatRecord[] }
  | { kind: 'save_allocations'; rooms: RoomRecord[]; seats: SeatRecord[] }

export interface AssistantPlan {
  details: string[]
  operation?: AssistantOperation
  summary: string
  title: string
  warnings: string[]
}

export interface AssistantContext {
  buses: BusConfig[]
  hotels: HotelConfig[]
  rooms: RoomRecord[]
  seats: SeatRecord[]
  trip: Trip
  users: SystemUser[]
}

export interface AssistantMessage {
  createdAt: string
  details?: string[]
  id: string
  role: 'assistant' | 'user'
  text: string
  tone?: 'default' | 'success' | 'warning'
  warnings?: string[]
}
