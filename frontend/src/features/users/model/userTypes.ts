import type { UserRole } from '../../auth/model/authTypes'

export interface SystemUser {
  birthdate: string
  cpf: string
  firstLogin: boolean
  hasKids: boolean
  kids: string[]
  married: boolean
  name: string
  role: UserRole
  spouseName: string
}

export interface UserMutation {
  birthdate: string
  firstLogin: boolean
  hasKids: boolean
  kids: string[]
  married: boolean
  name: string
  role: UserRole
  spouseName: string
  initialPassword?: string
}

export interface ReceiptSummary {
  fileName: string
  installment: string
  status: string
}

export interface TravelerPaymentSummary {
  paidInstallments: number
  receipts: ReceiptSummary[]
  totalInstallments: number
  userCpf: string
}

export interface TravelerSeatSummary {
  busId: string
  floor: number
  seatNumber: number
  userCpf: string
}

export interface TravelerRoomSummary {
  id: string
  name: string
  occupants: string[]
  type: string
}

export interface TripTravelerSource {
  payments: TravelerPaymentSummary[]
  rooms: TravelerRoomSummary[]
  seats: TravelerSeatSummary[]
  users: SystemUser[]
}
