import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Trip } from '../../trips/model/tripTypes'
import type { SystemUser, TripTravelerSource } from '../model/userTypes'
import { TripTravelersPage } from './TripTravelersPage'

const mocks = vi.hoisted(() => ({
  addExisting: vi.fn(),
  createTraveler: vi.fn(),
  loadSource: vi.fn(),
  reloadTrips: vi.fn(),
  removeTraveler: vi.fn(),
  updateUser: vi.fn(),
  useTrip: vi.fn(),
}))

vi.mock('../../trips/hooks/useTrip', () => ({ useTrip: mocks.useTrip }))
vi.mock('../api/tripTravelerApi', () => ({
  loadTripTravelerSource: mocks.loadSource,
}))
vi.mock('../api/travelerCompatibilityApi', () => ({
  addExistingUserToTrip: mocks.addExisting,
  createTravelerForTrip: mocks.createTraveler,
  removeTravelerFromTrip: mocks.removeTraveler,
}))
vi.mock('../api/usersApi', () => ({ updateUser: mocks.updateUser }))

const trip: Trip = {
  id: 'trip-1',
  name: 'Retiro 2027',
  destination: 'Goiânia',
  departurePlace: 'Brasília',
  departureTime: '08:00',
  date: '2027-01-20',
  maxPeople: 3,
  price: 800,
  arrecadationGoal: 20000,
  rules: '',
  buses: [],
  hotelsJson: '[]',
  travelersJson: '["11144477735"]',
  travelerCpfs: ['11144477735'],
}

const traveler: SystemUser = {
  birthdate: '1990-05-10',
  childCpfs: [],
  cpf: '11144477735',
  firstLogin: false,
  hasKids: true,
  kids: ['Lia'],
  married: true,
  name: 'Tiago Viajante',
  role: 'traveler',
  spouseName: 'Bruna',
  spouseCpf: '',
}

const available: SystemUser = {
  ...traveler,
  cpf: '52998224725',
  name: 'Carla Disponível',
  spouseName: '',
  spouseCpf: '',
  married: false,
}

const source: TripTravelerSource = {
  users: [traveler, available],
  payments: [
    {
      userCpf: traveler.cpf,
      paidInstallments: 2,
      totalInstallments: 4,
      receipts: [
        { installment: '2', fileName: 'recibo.pdf', status: 'pending' },
      ],
    },
  ],
  seats: [
    { userCpf: traveler.cpf, busId: '1', floor: 1, seatNumber: 12 },
  ],
  rooms: [
    {
      id: '5',
      name: 'Quarto 5',
      type: 'double',
      occupants: [traveler.cpf],
    },
  ],
}

function renderPage(activeTrip = trip) {
  mocks.useTrip.mockReturnValue({ activeTrip, reloadTrips: mocks.reloadTrips })
  mocks.loadSource.mockResolvedValue(source)
  return render(<TripTravelersPage />)
}

describe('TripTravelersPage', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
    mocks.addExisting.mockResolvedValue(undefined)
    mocks.removeTraveler.mockResolvedValue(undefined)
    mocks.updateUser.mockImplementation((_cpf, mutation) =>
      Promise.resolve({ ...traveler, ...mutation }),
    )
    mocks.createTraveler.mockResolvedValue({
      ...available,
      cpf: '93541134780',
      name: 'Novo Viajante',
    })
  })

  afterEach(() => cleanup())

  it('exibe assento, quarto, pagamento e comprovantes nos detalhes', async () => {
    renderPage()

    expect(await screen.findByText(/Ônibus 1 · Piso 1 · 12/)).toBeInTheDocument()
    expect(screen.getByText('Quarto 5 · Duplo')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.getByText('1 pendente(s)')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Detalhes' }))

    expect(screen.getByText('Bruna')).toBeInTheDocument()
    expect(screen.getByText(/recibo.pdf · pending/)).toBeInTheDocument()
    expect(screen.getByText(/cadastro correspondente é único/)).toBeInTheDocument()
  })

  it('adiciona usuário existente à viagem', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Adicionar existente' }))
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar Carla Disponível' }))

    await waitFor(() =>
      expect(mocks.addExisting).toHaveBeenCalledWith(available.cpf, trip.id),
    )
    expect(
      await screen.findByText('Usuário adicionado à viagem e pagamento inicial criado.'),
    ).toBeInTheDocument()
  })

  it('cria um novo viajante já associado à viagem', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Novo viajante' }))
    await userEvent.type(screen.getByLabelText('Nome completo *'), 'Novo Viajante')
    await userEvent.type(screen.getByLabelText('CPF *'), '93541134780')
    await userEvent.type(screen.getByLabelText('Senha inicial *'), 'senha-temporaria')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar usuário' }))

    await waitFor(() => expect(mocks.createTraveler).toHaveBeenCalled())
    expect(mocks.createTraveler).toHaveBeenCalledWith(
      '93541134780',
      expect.objectContaining({
        role: 'traveler',
        firstLogin: true,
        initialPassword: 'senha-temporaria',
      }),
      trip.id,
    )
  })

  it('bloqueia inclusão quando maxPeople foi atingido', async () => {
    renderPage({ ...trip, maxPeople: 1 })

    expect(await screen.findByRole('button', { name: 'Novo viajante' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Adicionar existente' })).toBeDisabled()
    expect(screen.getByText('A viagem atingiu o limite de 1 pessoa.')).toBeInTheDocument()
    expect(mocks.createTraveler).not.toHaveBeenCalled()
    expect(mocks.addExisting).not.toHaveBeenCalled()
  })

  it('remove apenas da viagem e não chama exclusão global', async () => {
    renderPage()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Remover da viagem' }),
    )
    expect(screen.getByRole('dialog')).toHaveTextContent(
      'O cadastro global será mantido.',
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Remover somente da viagem' }),
    )

    await waitFor(() =>
      expect(mocks.removeTraveler).toHaveBeenCalledWith(traveler.cpf, trip.id),
    )
    expect(
      await screen.findByText('Viajante removido somente desta viagem.'),
    ).toBeInTheDocument()
  })
})
