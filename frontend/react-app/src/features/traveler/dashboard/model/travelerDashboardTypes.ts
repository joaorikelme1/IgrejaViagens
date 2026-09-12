export interface TravelerPaymentRecord {
  id: string
  paidInstallments: number
  totalInstallments: number
}

export interface TravelerSeatRecord {
  busId: string
  floor: number
  id: string
  seatNumber: number
}

export interface TravelerRoomRecord {
  capacity: number
  hotelId: string
  id: string
  name: string
  occupants: string[]
  type: string
}

export interface TravelerDashboardSource {
  payments: TravelerPaymentRecord[]
  rooms: TravelerRoomRecord[]
  seats: TravelerSeatRecord[]
}

export interface TravelerSeatGroup {
  busId: string
  floor: number
  seatNumbers: number[]
}

export interface TravelerPaymentView {
  paidInstallments: number
  percentage: number
  status: 'confirmed' | 'partial' | 'pending' | 'unconfigured'
  totalInstallments: number
}

export interface TravelerRoomView {
  companions: string[]
  hotelId: string
  id: string
  label: string
}

export interface TravelerDashboardView {
  payment: TravelerPaymentView
  room: TravelerRoomView | null
  seats: TravelerSeatGroup[]
  warnings: string[]
}
