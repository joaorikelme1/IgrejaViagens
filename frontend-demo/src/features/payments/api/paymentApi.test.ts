import { describe, expect, it } from 'vitest'
import { calculatePaymentProgress } from '../lib/paymentCalculations'

describe('regras de pagamento preservadas pela persistência Supabase', () => {
  it('mantém o limite de parcelas pagas no total configurado', () => {
    expect(calculatePaymentProgress({ id: 'payment-1', tripId: 'trip-1', userCpf: '52998224725', totalInstallments: 3, paidInstallments: 3, dueDay: 10, locked: false, receipts: {} })).toMatchObject({ status: 'complete', percentage: 100 })
  })
})
