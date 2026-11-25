import type { Trip } from '../../trips/model/tripTypes'
import type {
  FinancialSummaryValue,
  PaymentProgress,
  PaymentRecord,
} from '../model/paymentTypes'

function finiteNonNegative(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

export function paidAmountForInstallments(price: number, paid: number, total: number) {
  const totalInstallments = Math.max(0, Math.trunc(total))
  if (!totalInstallments) return 0
  const paidInstallments = Math.min(totalInstallments, Math.max(0, Math.trunc(paid)))
  const totalCents = Math.round(finiteNonNegative(price) * 100)
  const baseCents = Math.floor(totalCents / totalInstallments)
  const remainderCents = totalCents % totalInstallments
  return (baseCents * paidInstallments + Math.min(paidInstallments, remainderCents)) / 100
}

export function installmentAmount(price: number, total: number, installment: number) {
  const current = paidAmountForInstallments(price, installment, total)
  const previous = paidAmountForInstallments(price, installment - 1, total)
  return Math.round((current - previous) * 100) / 100
}

export function calculatePaymentProgress(
  payment: PaymentRecord | null | undefined,
): PaymentProgress {
  if (!payment) {
    return {
      invalidData: false,
      paidInstallments: 0,
      percentage: 0,
      status: 'unconfigured',
      totalInstallments: 0,
    }
  }

  const rawTotal = payment.totalInstallments
  const total = Number.isFinite(rawTotal) ? Math.trunc(rawTotal) : 0
  if (total <= 0) {
    return {
      invalidData: true,
      paidInstallments: 0,
      percentage: 0,
      status: 'pending',
      totalInstallments: 0,
    }
  }

  const rawPaid = Number.isFinite(payment.paidInstallments)
    ? Math.trunc(payment.paidInstallments)
    : 0
  const paid = Math.min(total, Math.max(0, rawPaid))
  const percentage = Math.round((paid / total) * 100)

  return {
    invalidData: rawPaid !== paid,
    paidInstallments: paid,
    percentage,
    status:
      percentage === 100
        ? 'complete'
        : percentage > 0
          ? 'partial'
          : 'pending',
    totalInstallments: total,
  }
}

export function calculateFinancialSummary(
  trip: Trip,
  payments: PaymentRecord[],
): FinancialSummaryValue {
  const travelerCpfs = [...new Set(trip.travelerCpfs)]
  const price = finiteNonNegative(trip.price)
  const expectedTotal = price * travelerCpfs.length
  let collected = 0
  let completeCount = 0
  let partialCount = 0
  let pendingCount = 0

  travelerCpfs.forEach((cpf) => {
    const payment = payments.find(
      (item) => item.tripId === trip.id && item.userCpf === cpf,
    )
    const progress = calculatePaymentProgress(payment)
    collected += paidAmountForInstallments(
      price,
      progress.paidInstallments,
      progress.totalInstallments,
    )
    if (progress.status === 'complete') completeCount += 1
    else if (progress.status === 'partial') partialCount += 1
    else pendingCount += 1
  })

  collected = Math.round(Math.min(expectedTotal, finiteNonNegative(collected)) * 100) / 100
  const goal = finiteNonNegative(trip.arrecadationGoal) || expectedTotal

  return {
    collected,
    completeCount,
    expectedTotal,
    goal,
    goalPercentage:
      goal > 0 ? finiteNonNegative((collected / goal) * 100) : 0,
    partialCount,
    pendingCount,
    pendingValue: Math.max(0, expectedTotal - collected),
  }
}
