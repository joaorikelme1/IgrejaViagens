import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Trip } from '../../../trips/model/tripTypes'
import { AdminDashboardPage } from './AdminDashboardPage'

const mocks = vi.hoisted(() => ({
  loadAdminDashboard: vi.fn(),
  useTrip: vi.fn(),
}))

vi.mock('../api/adminDashboardApi', () => ({
  loadAdminDashboard: mocks.loadAdminDashboard,
}))

vi.mock('../../../trips/hooks/useTrip', () => ({
  useTrip: mocks.useTrip,
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
    mocks.useTrip.mockReturnValue({ activeTrip: trip })
    mocks.loadAdminDashboard.mockReset()
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
})
