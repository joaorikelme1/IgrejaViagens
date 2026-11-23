export interface DashboardUser {
  cpf: string
  name: string
}

export interface DashboardReceipt {
  status: string
}

export interface DashboardPayment {
  userCpf: string
  tripId: string
  totalInstallments: number
  paidInstallments: number
  receipts: DashboardReceipt[]
}

export interface DashboardSeat {
  id: string
  tripId: string
  busId: string
  userCpf: string
}

export interface AdminDashboardSource {
  payments: DashboardPayment[]
  seats: DashboardSeat[]
  users: DashboardUser[]
}

export interface AdminDashboardIndicators {
  arrecadationGoal: number
  arrecadationPercentage: number
  collectedAmount: number
  installmentRows: Array<{
    name: string
    paid: number
    total: number
  }>
  occupiedSeats: number
  paidInstallments: number
  pendingInstallments: number
  pendingReceipts: number
  recentTravelers: DashboardUser[]
  totalSeats: number
  totalTravelers: number
}
