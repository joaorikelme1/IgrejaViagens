import type { SystemUser } from '../../users/model/userTypes'

export type PaymentStatus = 'complete' | 'partial' | 'pending' | 'unconfigured'
export type ReceiptStatus = 'approved' | 'pending' | 'rejected'

export interface PaymentReceipt {
  data: string
  date: string
  filename: string
  note: string
  status: ReceiptStatus
  type: string
}

export interface PaymentRecord {
  dueDay: number
  id: string
  locked: boolean
  paidInstallments: number
  receipts: Record<string, PaymentReceipt>
  totalInstallments: number
  tripId: string
  userCpf: string
}

export interface PaymentMutation {
  dueDay: number
  id?: string
  locked: boolean
  paidInstallments: number
  receipts: Record<string, PaymentReceipt>
  totalInstallments: number
  tripId: string
  userCpf: string
}

export interface PaymentProgress {
  invalidData: boolean
  paidInstallments: number
  percentage: number
  status: PaymentStatus
  totalInstallments: number
}

export interface PaymentSource {
  payments: PaymentRecord[]
  users: SystemUser[]
}

export interface FinancialSummaryValue {
  collected: number
  completeCount: number
  expectedTotal: number
  goal: number
  goalPercentage: number
  partialCount: number
  pendingCount: number
  pendingValue: number
}

export interface PaymentRow {
  name: string
  payment: PaymentRecord | null
  pendingReceipts: number
  progress: PaymentProgress
  userCpf: string
}
