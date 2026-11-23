import { stripCpf } from '../../../shared/validation/cpf'
import type { Trip } from '../../trips/model/tripTypes'
import type {
  PaymentRecord,
  PaymentRow,
  PaymentSource,
  ReceiptStatus,
} from '../model/paymentTypes'
import { calculatePaymentProgress } from './paymentCalculations'

export function buildPaymentRows(
  trip: Trip,
  source: PaymentSource,
): PaymentRow[] {
  const memberCpfs = [...new Set(trip.travelerCpfs.map(stripCpf))]
  const paymentCpfs = source.payments
    .filter((payment) => payment.tripId === trip.id)
    .map((payment) => payment.userCpf)
  const rowCpfs = [...new Set([...memberCpfs, ...paymentCpfs])]

  return rowCpfs.map((userCpf) => {
    const user = source.users.find((item) => item.cpf === userCpf)
    const payment =
      source.payments.find(
        (item) => item.tripId === trip.id && item.userCpf === userCpf,
      ) ?? null
    return {
      name: user?.name ?? `CPF ${userCpf} (cadastro não encontrado)`,
      payment,
      pendingReceipts: payment
        ? Object.values(payment.receipts).filter(
            (receipt) => receipt.status === 'pending',
          ).length
        : 0,
      progress: calculatePaymentProgress(payment),
      userCpf,
    }
  })
}

export function paymentWithReceiptStatus(
  payment: PaymentRecord,
  installment: string,
  status: ReceiptStatus,
  note = '',
): PaymentRecord {
  const receipt = payment.receipts[installment]
  if (!receipt) throw new Error('Comprovante não encontrado.')
  const receipts = {
    ...payment.receipts,
    [installment]: {
      ...receipt,
      note: status === 'rejected' ? note.trim() : '',
      status,
    },
  }
  const paidInstallments = Math.min(
    Math.max(1, Math.trunc(payment.totalInstallments) || 1),
    Object.values(receipts).filter((item) => item.status === 'approved').length,
  )
  return { ...payment, paidInstallments, receipts }
}
