import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Trip } from '../../trips/model/tripTypes'
import type { SystemUser } from '../../users/model/userTypes'
import type {
  PaymentMutation,
  PaymentRecord,
  PaymentSource,
} from '../model/paymentTypes'
import { AdminPaymentsPage } from './AdminPaymentsPage'

const mocks = vi.hoisted(() => ({
  loadSource: vi.fn(),
  readReceiptFile: vi.fn(),
  savePayment: vi.fn(),
  useTrip: vi.fn(),
}))

vi.mock('../../trips/hooks/useTrip', () => ({ useTrip: mocks.useTrip }))
vi.mock('../api/paymentApi', () => ({
  loadPaymentSource: mocks.loadSource,
  savePayment: mocks.savePayment,
}))
vi.mock('../utils/receiptFile', () => ({
  readReceiptFile: mocks.readReceiptFile,
  safeReceiptData: vi.fn().mockReturnValue(null),
}))

const cpfs = ['11144477735', '52998224725', '93541134780', '98765432100']
const trip: Trip = {
  id: 'trip-1',
  name: 'Retiro 2027',
  destination: '',
  departurePlace: '',
  departureTime: '',
  date: '',
  maxPeople: 4,
  price: 100,
  arrecadationGoal: 400,
  rules: '',
  buses: [],
  hotelsJson: '[]',
  travelersJson: JSON.stringify(cpfs),
  travelerCpfs: cpfs,
}

function user(cpf: string, name: string): SystemUser {
  return {
    birthdate: '',
    childCpfs: [],
    cpf,
    firstLogin: false,
    hasKids: false,
    kids: [],
    married: false,
    name,
    role: 'traveler',
    spouseName: '',
    spouseCpf: '',
  }
}

function payment(
  cpf: string,
  paidInstallments: number,
  totalInstallments = 4,
): PaymentRecord {
  return {
    dueDay: 10,
    id: cpf + '_trip-1',
    locked: true,
    paidInstallments,
    receipts: {},
    totalInstallments,
    tripId: trip.id,
    userCpf: cpf,
  }
}

const source: PaymentSource = {
  users: [
    user(cpfs[0], 'Ana Completa'),
    user(cpfs[1], 'Bruno Parcial'),
    user(cpfs[2], 'Carla Pendente'),
    user(cpfs[3], 'Diego Sem Plano'),
  ],
  payments: [payment(cpfs[0], 4), payment(cpfs[1], 2), payment(cpfs[2], 0)],
}

describe('AdminPaymentsPage', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
    mocks.useTrip.mockReturnValue({ activeTrip: trip })
    mocks.loadSource.mockResolvedValue(source)
    mocks.readReceiptFile.mockResolvedValue('data:application/pdf;base64,dGVzdGU=')
    mocks.savePayment.mockImplementation((mutation: PaymentMutation) =>
      Promise.resolve({
        ...mutation,
        id: mutation.id ?? mutation.userCpf + '_' + mutation.tripId,
      }),
    )
  })

  afterEach(() => cleanup())

  it('lista pagos, parciais e pendentes da viagem ativa', async () => {
    render(<AdminPaymentsPage />)

    expect(await screen.findByText('Ana Completa')).toBeInTheDocument()
    expect(screen.getByText('Bruno Parcial')).toBeInTheDocument()
    expect(screen.getByText('Carla Pendente')).toBeInTheDocument()
    expect(screen.getByText('Pago · 100%')).toBeInTheDocument()
    expect(screen.getByText('Parcial · 50%')).toBeInTheDocument()
    expect(screen.getByText('Pendente · 0%')).toBeInTheDocument()
    expect(screen.getByText('R$ 150,00')).toBeInTheDocument()
    expect(screen.getByText('R$ 250,00')).toBeInTheDocument()
  })

  it('filtra por busca e situação', async () => {
    render(<AdminPaymentsPage />)
    const search = await screen.findByLabelText('Buscar por nome ou CPF')
    await userEvent.type(search, '529.982')

    expect(screen.getByText('Bruno Parcial')).toBeInTheDocument()
    expect(screen.queryByText('Ana Completa')).not.toBeInTheDocument()
    await userEvent.clear(search)
    await userEvent.selectOptions(screen.getByLabelText('Situação'), 'pending')
    expect(screen.getByText('Carla Pendente')).toBeInTheDocument()
    expect(screen.queryByText('Bruno Parcial')).not.toBeInTheDocument()
  })

  it('registra pagamento para viajante ainda não configurado', async () => {
    render(<AdminPaymentsPage />)
    await userEvent.click(
      await screen.findByRole('button', { name: 'Registrar pagamento' }),
    )
    expect(screen.getByRole('combobox', { name: 'Viajante' })).toHaveValue(cpfs[3])
    await userEvent.click(screen.getByRole('button', { name: 'Salvar pagamento' }))

    await waitFor(() => expect(mocks.savePayment).toHaveBeenCalled())
    expect(mocks.savePayment).toHaveBeenCalledWith(
      expect.objectContaining({ userCpf: cpfs[3], tripId: trip.id }),
    )
  })

  it('só anuncia confirmação depois da resposta de persistência', async () => {
    let resolveSave: ((value: PaymentRecord) => void) | undefined
    mocks.savePayment.mockReturnValue(
      new Promise<PaymentRecord>((resolve) => {
        resolveSave = resolve
      }),
    )
    render(<AdminPaymentsPage />)
    const editButtons = await screen.findAllByRole('button', { name: 'Editar' })
    await userEvent.click(editButtons[0])
    await userEvent.click(screen.getByRole('button', { name: 'Salvar pagamento' }))

    expect(screen.queryByText('Pagamento persistido com sucesso.')).not.toBeInTheDocument()
    resolveSave?.(source.payments[0])
    expect(
      await screen.findByText('Pagamento persistido com sucesso.'),
    ).toBeInTheDocument()
  })

  it('anexa comprovante para o viajante sem trocar de login', async () => {
    render(<AdminPaymentsPage />)
    const receiptButtons = await screen.findAllByRole('button', {
      name: 'Comprovantes',
    })
    await userEvent.click(receiptButtons[0])
    expect(
      screen.getByRole('heading', { name: 'Comprovantes de Ana Completa' }),
    ).toBeInTheDocument()

    const input = screen.getByLabelText('Anexar comprovante da parcela 1')
    const file = new File(['receipt'], 'parcela-1.pdf', {
      type: 'application/pdf',
    })
    await userEvent.upload(input, file)

    await waitFor(() => expect(mocks.savePayment).toHaveBeenCalled())
    const savedMutation = mocks.savePayment.mock.lastCall?.[0] as
      | PaymentMutation
      | undefined
    expect(savedMutation).toMatchObject({
      id: source.payments[0].id,
      userCpf: cpfs[0],
    })
    expect(savedMutation?.receipts['1']).toMatchObject({
      data: 'data:application/pdf;base64,dGVzdGU=',
      filename: 'parcela-1.pdf',
      status: 'pending',
      type: 'application/pdf',
    })
    expect(
      await screen.findByText(
        'Comprovante anexado pelo administrador e aguardando aprovação.',
      ),
    ).toBeInTheDocument()
  })

  it('exibe erro de carregamento da API', async () => {
    mocks.loadSource.mockRejectedValue(new Error('API indisponível'))
    render(<AdminPaymentsPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('API indisponível')
  })
})
