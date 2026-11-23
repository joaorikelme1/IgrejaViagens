import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Trip } from '../../../trips/model/tripTypes'
import type {
  FinancialSummaryValue,
  PaymentRow,
} from '../../../payments/model/paymentTypes'
import { AdminDashboardPage } from './AdminDashboardPage'

const mocks = vi.hoisted(() => ({
  loadAdminDashboard: vi.fn(),
  loadPaymentSource: vi.fn(),
  printReport: vi.fn(),
  useTrip: vi.fn(),
}))

vi.mock('../api/adminDashboardApi', () => ({
  loadAdminDashboard: mocks.loadAdminDashboard,
}))

vi.mock('../../../trips/hooks/useTrip', () => ({
  useTrip: mocks.useTrip,
}))

vi.mock('../../../payments/api/paymentApi', () => ({
  loadPaymentSource: mocks.loadPaymentSource,
}))

vi.mock('../../../payments/utils/paymentReport', () => ({
  printPaymentReport: mocks.printReport,
}))

const trip: Trip = {
  id: 'trip-1',
  name: 'Retiro 2027',
  destination: 'Goiânia',
  departurePlace: 'Brasília',
  departureTime: '08:00',
  date: '2027-01-20',
  maxPeople: 44,
  price: 800,
  arrecadationGoal: 1600,
  rules: '',
  buses: [{ id: 1, floors: 1, seatsFloor1: 44, seatsFloor2: 0, seats: 44 }],
  hotelsJson: '[]',
  travelersJson: '[]',
  travelerCpfs: [],
}

describe('AdminDashboardPage', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
    mocks.useTrip.mockReturnValue({ activeTrip: trip })
    mocks.loadPaymentSource.mockResolvedValue({ users: [], payments: [] })
    mocks.printReport.mockReturnValue(true)
  })

  afterEach(cleanup)

  it('renderiza estado vazio sem NaN ou Infinity', async () => {
    mocks.loadAdminDashboard.mockResolvedValue({
      users: [],
      payments: [],
      seats: [],
    })
    render(<AdminDashboardPage />)

    expect(
      await screen.findByText('Ainda não há dados operacionais para esta viagem.'),
    ).toBeInTheDocument()
    expect(screen.getByText('0/44')).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent(/NaN|Infinity/)
  })

  it('renderiza indicadores, gráficos e viajantes com dados', async () => {
    mocks.useTrip.mockReturnValue({
      activeTrip: {
        ...trip,
        travelersJson: '["11144477735"]',
        travelerCpfs: ['11144477735'],
      },
    })
    mocks.loadAdminDashboard.mockResolvedValue({
      users: [{ cpf: '11144477735', name: 'Tiago Viajante' }],
      payments: [
        {
          userCpf: '11144477735',
          tripId: trip.id,
          totalInstallments: 4,
          paidInstallments: 2,
          receipts: [{ status: 'pending' }],
        },
      ],
      seats: [
        { id: 'seat-1', tripId: trip.id, busId: '1', userCpf: '11144477735' },
      ],
    })
    render(<AdminDashboardPage />)

    expect(await screen.findByText('Tiago Viajante')).toBeInTheDocument()
    expect(screen.getByText('1/44')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Parcelas pagas e pendentes' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Assentos ocupados e livres' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Parcelas pagas por viajante' })).toBeInTheDocument()
  })

  it('gera o relatório PDF pelo dashboard', async () => {
    const reportTrip = {
      ...trip,
      travelersJson: '["11144477735"]',
      travelerCpfs: ['11144477735'],
    }
    mocks.useTrip.mockReturnValue({ activeTrip: reportTrip })
    mocks.loadAdminDashboard.mockResolvedValue({ users: [], payments: [], seats: [] })
    mocks.loadPaymentSource.mockResolvedValue({
      users: [{
        birthdate: '', childCpfs: [], cpf: '11144477735', firstLogin: false,
        hasKids: false, kids: [], married: false, name: 'Tiago Viajante',
        role: 'traveler', spouseName: '', spouseCpf: '',
      }],
      payments: [],
    })

    render(<AdminDashboardPage />)
    await userEvent.click(
      await screen.findByRole('button', { name: 'Gerar relatório PDF' }),
    )

    const report = mocks.printReport.mock.lastCall?.[0] as {
      rows: PaymentRow[]
      summary: FinancialSummaryValue
      trip: Trip
    }
    expect(report.rows.map((row) => row.name)).toEqual(['Tiago Viajante'])
    expect(report.summary.expectedTotal).toBe(800)
    expect(report.trip).toBe(reportTrip)
  })
})
