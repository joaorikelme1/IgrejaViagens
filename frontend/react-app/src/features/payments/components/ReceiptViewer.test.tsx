import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PaymentRecord } from '../model/paymentTypes'
import { ReceiptViewer } from './ReceiptViewer'

const payment: PaymentRecord = {
  dueDay: 10,
  id: 'payment-1',
  locked: true,
  paidInstallments: 0,
  receipts: {
    1: {
      data: '',
      date: '09/09/2026',
      filename: 'arquivo-perdido.pdf',
      note: '',
      status: 'pending',
      type: 'application/pdf',
    },
  },
  totalInstallments: 2,
  tripId: 'trip-1',
  userCpf: '11144477735',
}

describe('ReceiptViewer', () => {
  afterEach(() => cleanup())

  it('mostra metadados e fallback quando o comprovante não possui arquivo', () => {
    render(
      <ReceiptViewer
        onClose={vi.fn()}
        payment={payment}
        title="Comprovantes"
      />,
    )

    expect(screen.getByText(/arquivo-perdido.pdf/)).toBeInTheDocument()
    expect(
      screen.getByText('Comprovante sem arquivo válido anexado.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByText('Baixar comprovante')).not.toBeInTheDocument()
  })
})
