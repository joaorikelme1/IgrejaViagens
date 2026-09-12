import type { SystemUser } from '../../users/model/userTypes'

export type OperationId = string | number

export interface HotelRoomConfig {
  [key: string]: unknown
  capacity: number
  id: OperationId
  name: string
  type: string
}

export interface HotelConfig {
  [key: string]: unknown
  id: OperationId
  name: string
  rooms: HotelRoomConfig[]
}

export interface RoomRecord {
  capacity: number
  hotelId: string
  id: string
  name: string
  occupants: string[]
  tripId: string
  type: string
}

export interface SeatRecord {
  busId: string
  floor: number
  id: string
  seatNumber: number
  tripId: string
  userCpf: string
}

export interface HotelSource {
  rooms: RoomRecord[]
  users: SystemUser[]
}

export interface TransportSource {
  seats: SeatRecord[]
  users: SystemUser[]
}

export interface RoomConflict {
  key: string
  message: string
  roomId?: string
}

export interface SeatConflict {
  busId?: string
  floor?: number
  key: string
  message: string
  seatNumber?: number
}
