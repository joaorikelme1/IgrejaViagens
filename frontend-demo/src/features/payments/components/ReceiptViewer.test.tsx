import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  it('permite ao administrador anexar comprovantes em todas as parcelas', async () => {
    const onUpload = vi.fn().mockResolvedValue(undefined)
    render(
      <ReceiptViewer
        onClose={vi.fn()}
        onUpload={onUpload}
        payment={payment}
        title="Comprovantes"
      />,
    )

    expect(
      screen.getByLabelText('Substituir comprovante da parcela 1'),
    ).toBeInTheDocument()
    const emptyInstallment = screen.getByLabelText(
      'Anexar comprovante da parcela 2',
    )
    const file = new File(['receipt'], 'parcela-2.pdf', {
      type: 'application/pdf',
    })
    await userEvent.upload(emptyInstallment, file)

    expect(onUpload).toHaveBeenCalledWith('2', file)
  })

  it('exibe comprovante de imagem servido por URL assinada', () => {
    render(
      <ReceiptViewer
        onClose={vi.fn()}
        payment={{
          ...payment,
          receipts: {
            1: {
              ...payment.receipts[1],
              data: 'https://cpkmrzqohcithmsbczmg.supabase.co/storage/v1/object/sign/payment-receipts/arquivo.jpg?token=assinatura',
              filename: 'comprovante.jpg',
              type: 'image/jpeg',
            },
          },
        }}
        title="Comprovantes"
      />,
    )

    expect(screen.getByRole('img', { name: 'Comprovante da parcela 1' })).toHaveAttribute(
      'src',
      expect.stringContaining('/storage/v1/object/sign/payment-receipts/arquivo.jpg'),
    )
    expect(screen.getByText('Baixar comprovante')).toHaveAttribute(
      'href',
      expect.stringContaining('token=assinatura'),
    )
  })
})
