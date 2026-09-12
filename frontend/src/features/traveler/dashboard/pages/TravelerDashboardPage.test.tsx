import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '../../../auth/model/authTypes'
import type { Trip } from '../../../trips/model/tripTypes'
import type { TravelerDashboardSource } from '../model/travelerDashboardTypes'
import { TravelerDashboardPage } from './TravelerDashboardPage'

const mocks = vi.hoisted(() => ({
  loadTravelerDashboard: vi.fn(),
  openSelector: vi.fn(),
  useAuth: vi.fn(),
  useTrip: vi.fn(),
}))

vi.mock('../api/travelerDashboardApi', () => ({
  loadTravelerDashboard: mocks.loadTravelerDashboard,
}))

vi.mock('../../../auth/hooks/useAuth', () => ({
  useAuth: mocks.useAuth,
}))

vi.mock('../../../trips/hooks/useTrip', () => ({
  useTrip: mocks.useTrip,
}))

const traveler: AuthUser = {
  cpf: '11144477735',
  name: 'Tiago Viajante',
  role: 'traveler',
  birthdate: '',
  firstLogin: false,
  married: false,
  spouseName: '',
  hasKids: false,
  kids: [],
}

const trip: Trip = {
  id: 'trip-1',
  name: 'Retiro 2027',
  destination: 'Goiânia',
  departurePlace: 'Brasília',
  departureTime: '08:30',
  date: '2027-01-20',
  maxPeople: 44,
  price: 800,
  arrecadationGoal: 20000,
  rules: 'Levar documento\nRespeitar os horários',
  buses: [
    {
      id: 'bus-1',
      floors: 1,
      seatsFloor1: 44,
      seatsFloor2: 0,
      seats: 44,
    },
  ],
  hotelsJson: '[]',
  travelersJson: '["11144477735"]',
  travelerCpfs: ['11144477735'],
}

const completeSource: TravelerDashboardSource = {
  payments: [{ id: 'payment-1', paidInstallments: 4, totalInstallments: 4 }],
  seats: [{ id: 'seat-1', busId: 'bus-1', floor: 1, seatNumber: 12 }],
  rooms: [
    {
      id: 'room-5',
      name: 'Quarto 5',
      type: 'double',
      capacity: 2,
      hotelId: 'hotel-1',
      occupants: [traveler.cpf, '52998224725'],
    },
  ],
}

function renderDashboard(source: TravelerDashboardSource = completeSource) {
  mocks.loadTravelerDashboard.mockResolvedValue(source)
  return render(<TravelerDashboardPage />)
}

describe('TravelerDashboardPage', () => {
  beforeEach(() => {
    mocks.loadTravelerDashboard.mockReset()
    mocks.openSelector.mockReset()
    mocks.useAuth.mockReturnValue({ user: traveler })
    mocks.useTrip.mockReturnValue({ activeTrip: trip, openSelector: mocks.openSelector })
  })

  afterEach(() => cleanup())

  it('exibe a passagem com todos os dados disponíveis', async () => {
    renderDashboard()

    expect(await screen.findByText('Tiago Viajante')).toBeInTheDocument()
    expect(screen.getByText('Brasília')).toBeInTheDocument()
    expect(screen.getByText('Goiânia')).toBeInTheDocument()
    expect(screen.getByText('20/01/2027')).toBeInTheDocument()
    expect(screen.getByText('08:30')).toBeInTheDocument()
    expect(screen.getByText(/Ônibus bus-1 · Piso 1 · Assento\(s\) 12/)).toBeInTheDocument()
    expect(screen.getByText('Quarto 5 · Duplo')).toBeInTheDocument()
    expect(screen.getAllByText('Confirmado')).toHaveLength(2)
  })

  it('não carrega nem exibe passagem para administrador fora da viagem', () => {
    mocks.useAuth.mockReturnValue({
      user: {
        ...traveler,
        cpf: '52998224725',
        name: 'Ana Administradora',
        role: 'admin',
      },
    })

    renderDashboard()

    expect(screen.getByRole('status')).toHaveTextContent(
      'Seu usuário precisa ser adicionado como participante de Retiro 2027',
    )
    expect(
      screen.queryByRole('button', { name: 'Baixar / imprimir passagem' }),
    ).not.toBeInTheDocument()
    expect(mocks.loadTravelerDashboard).not.toHaveBeenCalled()
  })

  it('funciona quando o viajante não possui assento', async () => {
    renderDashboard({ ...completeSource, seats: [] })
    expect(await screen.findByText('Não atribuído')).toBeInTheDocument()
  })

  it('funciona quando o viajante não possui quarto', async () => {
    renderDashboard({ ...completeSource, rooms: [] })
    expect(await screen.findByText('Companheiros de quarto')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('funciona quando o viajante não possui pagamento', async () => {
    renderDashboard({ ...completeSource, payments: [] })
    expect(await screen.findAllByText('Não configurado')).toHaveLength(2)
    expect(screen.getAllByText('Nenhum pagamento associado')).toHaveLength(2)
  })

  it('exibe companheiros sem revelar o CPF completo', async () => {
    renderDashboard()
    expect(await screen.findByText('Viajante · CPF final 4725')).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent('52998224725')
  })

  it('abre o seletor existente para trocar de viagem', async () => {
    renderDashboard()
    await userEvent.click(await screen.findByRole('button', { name: 'Trocar viagem' }))
    expect(mocks.openSelector).toHaveBeenCalledOnce()
  })

  it('renderiza regras como texto, sem interpretar HTML', async () => {
    const unsafeRule = '<img src="x" onerror="alert(1)">\nChegar cedo'
    mocks.useTrip.mockReturnValue({
      activeTrip: { ...trip, rules: unsafeRule },
      openSelector: mocks.openSelector,
    })
    renderDashboard()

    expect(
      await screen.findByText(
        (_content, element) =>
          element?.tagName === 'P' && element.textContent === unsafeRule,
      ),
    ).toBeInTheDocument()
    expect(document.querySelector('img[src="x"]')).toBeNull()
  })

  it('mostra fallbacks quando a viagem não possui dados opcionais', async () => {
    mocks.useTrip.mockReturnValue({
      activeTrip: {
        ...trip,
        name: '',
        departurePlace: '',
        destination: '',
        departureTime: '',
        date: '',
        rules: '',
      },
      openSelector: mocks.openSelector,
    })
    renderDashboard({ payments: [], rooms: [], seats: [] })

    expect(await screen.findByText('Origem não informada')).toBeInTheDocument()
    expect(screen.getByText('Destino não informado')).toBeInTheDocument()
    expect(screen.getByText('Data não informada')).toBeInTheDocument()
    expect(screen.getByText('Nenhuma regra cadastrada.')).toBeInTheDocument()
    expect(screen.getAllByText('Não informado').length).toBeGreaterThan(0)
  })

  it('delega a impressão ao recurso nativo isolado', async () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => undefined)
    renderDashboard()

    const buttons = await screen.findAllByRole('button', {
      name: 'Baixar / imprimir passagem',
    })
    await userEvent.click(buttons[0])
    expect(printSpy).toHaveBeenCalledOnce()
    printSpy.mockRestore()
  })

  it('exibe erro de carregamento com opção de tentar novamente', async () => {
    mocks.loadTravelerDashboard.mockRejectedValue(new Error('Serviço indisponível'))
    render(<TravelerDashboardPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Serviço indisponível')
    expect(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    ).toBeInTheDocument()
  })
})
