import { describe, expect, it } from 'vitest'
import type { Trip } from '../../trips/model/tripTypes'
import type { PaymentRecord } from '../model/paymentTypes'
import {
  calculateFinancialSummary,
  calculatePaymentProgress,
} from './paymentCalculations'

function payment(
  userCpf: string,
  paidInstallments: number,
  totalInstallments: number,
): PaymentRecord {
  return {
    dueDay: 10,
    id: `${userCpf}_trip-1`,
    locked: true,
    paidInstallments,
    receipts: {},
    totalInstallments,
    tripId: 'trip-1',
    userCpf,
  }
}

const trip: Trip = {
  id: 'trip-1',
  name: 'Retiro',
  destination: '',
  departurePlace: '',
  departureTime: '',
  date: '',
  maxPeople: 3,
  price: 100,
  arrecadationGoal: 200,
  rules: '',
  buses: [],
  hotelsJson: '[]',
  travelersJson: '["cpf-1","cpf-2","cpf-3"]',
  travelerCpfs: ['cpf-1', 'cpf-2', 'cpf-3'],
}

describe('cálculos de pagamentos', () => {
  it.each([
    [4, 4, 'complete', 100],
    [2, 4, 'partial', 50],
    [0, 4, 'pending', 0],
  ] as const)(
    'classifica %s/%s como %s',
    (paid, total, status, percentage) => {
      expect(calculatePaymentProgress(payment('cpf-1', paid, total))).toMatchObject({
        status,
        percentage,
      })
    },
  )

  it('calcula arrecadação, total esperado e valor pendente', () => {
    const summary = calculateFinancialSummary(trip, [
      payment('cpf-1', 4, 4),
      payment('cpf-2', 2, 4),
    ])

    expect(summary).toEqual({
      collected: 150,
      completeCount: 1,
      expectedTotal: 300,
      goal: 200,
      goalPercentage: 75,
      partialCount: 1,
      pendingCount: 1,
      pendingValue: 150,
    })
  })

  it('normaliza totais inválidos, negativos e infinitos', () => {
    const invalid = calculatePaymentProgress(payment('cpf-1', -5, 0))
    const summary = calculateFinancialSummary(
      { ...trip, price: Number.POSITIVE_INFINITY, arrecadationGoal: -10 },
      [payment('cpf-1', Number.POSITIVE_INFINITY, -2)],
    )

    expect(invalid).toEqual({
      invalidData: true,
      paidInstallments: 0,
      percentage: 0,
      status: 'pending',
      totalInstallments: 0,
    })
    expect(summary.collected).toBe(0)
    expect(summary.pendingValue).toBe(0)
    expect(summary.goalPercentage).toBe(0)
    expect(Object.values(summary).every(Number.isFinite)).toBe(true)
  })
})
