import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Trip } from '../../trips/model/tripTypes'
import type { PaymentMutation, PaymentRecord } from '../model/paymentTypes'
import { TravelerPaymentPage } from './TravelerPaymentPage'

const mocks = vi.hoisted(() => ({
  listPayments: vi.fn(),
  readReceiptFile: vi.fn(),
  savePayment: vi.fn(),
  useAuth: vi.fn(),
  useTrip: vi.fn(),
}))

vi.mock('../../auth/hooks/useAuth', () => ({ useAuth: mocks.useAuth }))
vi.mock('../../trips/hooks/useTrip', () => ({ useTrip: mocks.useTrip }))
vi.mock('../api/paymentApi', () => ({
  listPayments: mocks.listPayments,
  savePayment: mocks.savePayment,
}))
vi.mock('../utils/receiptFile', async (importOriginal) => {
  const original = await importOriginal<typeof import('../utils/receiptFile')>()
  return { ...original, readReceiptFile: mocks.readReceiptFile }
})

const cpf = '11144477735'
const trip: Trip = {
  id: 'trip-1',
  name: 'Retiro',
  destination: '',
  departurePlace: '',
  departureTime: '',
  date: '',
  maxPeople: 1,
  price: 600,
  arrecadationGoal: 600,
  rules: '',
  buses: [],
  hotelsJson: '[]',
  travelersJson: JSON.stringify([cpf]),
  travelerCpfs: [cpf],
}
const payment: PaymentRecord = {
  dueDay: 10,
  id: cpf + '_' + trip.id,
  locked: true,
  paidInstallments: 0,
  receipts: {},
  totalInstallments: 2,
  tripId: trip.id,
  userCpf: cpf,
}
let persistedMutation: PaymentMutation | null = null

describe('TravelerPaymentPage', () => {
  beforeEach(() => {
    persistedMutation = null
    Object.values(mocks).forEach((mock) => mock.mockReset())
    mocks.useAuth.mockReturnValue({ user: { cpf } })
    mocks.useTrip.mockReturnValue({ activeTrip: trip })
    mocks.listPayments.mockResolvedValue([
      payment,
      { ...payment, id: 'other', userCpf: '52998224725' },
    ])
    mocks.readReceiptFile.mockResolvedValue('data:image/png;base64,AA==')
    mocks.savePayment.mockImplementation((mutation: PaymentMutation) => {
      persistedMutation = mutation
      return Promise.resolve(mutation)
    })
  })

  afterEach(() => cleanup())

  it('usa somente o pagamento do CPF da sessão e anexa comprovante', async () => {
    render(<TravelerPaymentPage />)
    expect(await screen.findByText('2x de R$ 300,00')).toBeInTheDocument()
    const file = new File(['imagem'], 'recibo.png', { type: 'image/png' })
    fireEvent.change(screen.getAllByLabelText('Anexar')[0], {
      target: { files: [file] },
    })

    await waitFor(() => expect(mocks.savePayment).toHaveBeenCalled())
    expect(persistedMutation?.userCpf).toBe(cpf)
    expect(persistedMutation?.receipts['1']?.filename).toBe('recibo.png')
    expect(persistedMutation?.receipts['1']?.status).toBe('pending')
    expect(
      await screen.findByText('Comprovante enviado e aguardando análise.'),
    ).toBeInTheDocument()
  })
})
