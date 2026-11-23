import { nextDemoId, readDemoState, updateDemoState } from '../../../demo/demoStore'
import { stripCpf } from '../../../shared/validation/cpf'
import { listUsers } from '../../users/api/usersApi'
import type { PaymentMutation, PaymentReceipt, PaymentRecord, PaymentSource } from '../model/paymentTypes'

const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

export async function listPayments() { return copy(readDemoState().payments) }
export async function loadPaymentSource(): Promise<PaymentSource> { return { payments: await listPayments(), users: await listUsers() } }

export async function submitTravelerReceipt(payment: PaymentRecord, installment: string, receipt: PaymentReceipt) {
  if (!receipt.data.startsWith('data:')) throw new Error('O arquivo do comprovante é inválido.')
  const saved = { ...payment, receipts: { ...payment.receipts, [installment]: { ...receipt, date: new Date().toISOString(), status: 'pending' as const } } }
  updateDemoState((state) => { const index = state.payments.findIndex((item) => item.id === payment.id); if (index < 0) throw new Error('Pagamento não encontrado.'); state.payments[index] = saved })
  return saved
}

export async function savePayment(mutation: PaymentMutation) {
  const cpf = stripCpf(mutation.userCpf)
  if (!readDemoState().users.some((user) => user.cpf === cpf)) throw new Error('Viajante não encontrado.')
  const totalInstallments = Math.min(24, Math.max(1, Math.trunc(mutation.totalInstallments) || 1))
  const saved: PaymentRecord = { id: mutation.id || nextDemoId('payment'), tripId: mutation.tripId, userCpf: cpf, totalInstallments, paidInstallments: Math.min(totalInstallments, Math.max(0, Math.trunc(mutation.paidInstallments))), dueDay: Math.min(31, Math.max(1, Math.trunc(mutation.dueDay))), locked: mutation.locked, receipts: copy(mutation.receipts) }
  updateDemoState((state) => { const index = state.payments.findIndex((item) => item.id === saved.id); if (index >= 0) state.payments[index] = saved; else state.payments.push(saved) })
  return saved
}
