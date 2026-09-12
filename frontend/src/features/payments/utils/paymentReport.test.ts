import { describe, expect, it, vi } from 'vitest'
import type { Trip } from '../../trips/model/tripTypes'
import type { FinancialSummaryValue, PaymentRow } from '../model/paymentTypes'
import { buildPaymentReportHtml, printPaymentReport } from './paymentReport'

const trip: Trip = {
  id: 'trip-1',
  name: 'Retiro <Especial>',
  destination: 'Caldas Novas',
  departurePlace: 'Brasília',
  departureTime: '07:30',
  date: '2027-01-10',
  maxPeople: 40,
  price: 200,
  arrecadationGoal: 8000,
  rules: '',
  buses: [],
  hotelsJson: '[]',
  travelersJson: '[]',
  travelerCpfs: ['11144477735'],
}

const rows: PaymentRow[] = [{
  name: 'Ana & João',
  userCpf: '11144477735',
  payment: {
    dueDay: 10,
    id: 'payment-1',
    locked: true,
    paidInstallments: 2,
    receipts: {
      '1': { data: '', date: '', filename: '', note: '', status: 'approved', type: '' },
      '2': { data: '', date: '', filename: '', note: '', status: 'pending', type: '' },
    },
    totalInstallments: 4,
    tripId: trip.id,
    userCpf: '11144477735',
  },
  pendingReceipts: 1,
  progress: {
    invalidData: false,
    paidInstallments: 2,
    percentage: 50,
    status: 'partial',
    totalInstallments: 4,
  },
}]

const summary: FinancialSummaryValue = {
  collected: 100,
  completeCount: 0,
  expectedTotal: 200,
  goal: 8000,
  goalPercentage: 1.25,
  partialCount: 1,
  pendingCount: 0,
  pendingValue: 100,
}

describe('relatório de pagamentos', () => {
  it('gera conteúdo imprimível com viagem, financeiro e viajantes', () => {
    const html = buildPaymentReportHtml({
      generatedAt: new Date('2027-01-02T10:30:00'),
      rows,
      summary,
      trip,
    })

    expect(html).toContain('Relatório geral da viagem')
    expect(html).toContain('10/01/2027')
    expect(html).toContain('111.444.777-35')
    expect(html).toContain('2/4 parcelas')
    expect(html).toMatch(/R\$\s100,00/)
    expect(html).toContain('Ana &amp; João')
    expect(html).not.toContain('Retiro <Especial>')
  })

  it('abre a impressão e informa quando o navegador bloqueia a janela', () => {
    const print = vi.fn()
    const reportWindow = {
      document: { close: vi.fn(), write: vi.fn() },
      focus: vi.fn(),
      opener: window,
      print,
    }
    const open = vi.spyOn(window, 'open').mockReturnValue(reportWindow as unknown as Window)

    expect(printPaymentReport({ rows, summary, trip })).toBe(true)
    expect(reportWindow.document.write).toHaveBeenCalledOnce()
    expect(print).toHaveBeenCalledOnce()

    open.mockReturnValueOnce(null)
    expect(printPaymentReport({ rows, summary, trip })).toBe(false)
    open.mockRestore()
  })
})
