import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BusConfig, Trip } from '../../trips/model/tripTypes'
import type { SystemUser } from '../../users/model/userTypes'
import type { SeatRecord, TransportSource } from '../model/operationTypes'
import { BusManagementPage } from './BusManagementPage'

const mocks = vi.hoisted(() => ({
  deleteSeats: vi.fn(),
  loadTransportSource: vi.fn(),
  reloadTrips: vi.fn(),
  saveBusStructure: vi.fn(),
  saveSeatRecord: vi.fn(),
  useTrip: vi.fn(),
}))

vi.mock('../../trips/hooks/useTrip', () => ({ useTrip: mocks.useTrip }))
vi.mock('../api/operationsApi', () => ({
  deleteSeats: mocks.deleteSeats,
  loadTransportSource: mocks.loadTransportSource,
  saveBusStructure: mocks.saveBusStructure,
  saveSeatRecord: mocks.saveSeatRecord,
}))

const cpf = '11144477735'
const bus: BusConfig = {
  id: 'bus-existing',
  floors: 2,
  seatsFloor1: 4,
  seatsFloor2: 2,
  seats: 6,
  legacyField: 'preservado',
}
const trip: Trip = {
  id: 'trip-1',
  name: 'Retiro',
  destination: '',
  departurePlace: '',
  departureTime: '',
  date: '',
  maxPeople: 1,
  price: 100,
  arrecadationGoal: 100,
  rules: '',
  buses: [bus],
  hotelsJson: '[]',
  travelersJson: JSON.stringify([cpf]),
  travelerCpfs: [cpf],
}
const user: SystemUser = {
  birthdate: '',
  childCpfs: [],
  cpf,
  firstLogin: false,
  hasKids: false,
  kids: [],
  married: false,
  name: 'Ana',
  role: 'traveler',
  spouseName: '',
  spouseCpf: '',
}
const occupiedSeat: SeatRecord = {
  id: 'seat-existing',
  tripId: trip.id,
  busId: String(bus.id),
  floor: 2,
  seatNumber: 2,
  userCpf: cpf,
}
const source: TransportSource = { seats: [occupiedSeat], users: [user] }
let savedBuses: BusConfig[] | null = null
let savedSeat: SeatRecord | null = null

describe('BusManagementPage', () => {
  beforeEach(() => {
    savedBuses = null
    savedSeat = null
    Object.values(mocks).forEach((mock) => mock.mockReset())
    mocks.useTrip.mockReturnValue({ activeTrip: trip, reloadTrips: mocks.reloadTrips })
    mocks.loadTransportSource.mockResolvedValue(source)
    mocks.saveBusStructure.mockImplementation((_tripId: string, value: BusConfig[]) => {
      savedBuses = value
      return Promise.resolve()
    })
    mocks.saveSeatRecord.mockImplementation((seat: SeatRecord) => {
      savedSeat = seat
      return Promise.resolve(seat)
    })
    mocks.deleteSeats.mockResolvedValue(undefined)
  })

  afterEach(() => cleanup())

  it('mostra pisos, assentos e ocupação usando o floor do backend', async () => {
    const { container } = render(<BusManagementPage />)
    expect(await screen.findByText('Ônibus bus-existing')).toBeInTheDocument()
    expect(container.querySelector('.transport-bus-card')).toHaveClass('has-two-floors')
    expect(container.querySelector('.transport-bus-card__info')).toBeInTheDocument()
    expect(container.querySelector('.transport-bus-card__actions')).toContainElement(
      screen.getByRole('button', { name: 'Editar ônibus' }),
    )
    expect(screen.getByText('1º piso')).toBeInTheDocument()
    expect(screen.getByText('2º piso')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Assento 2, ocupado por Ana' }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Assento 1, livre' })).toHaveLength(2)
    expect(screen.queryByText('M')).not.toBeInTheDocument()
  })

  it('cadastra ônibus sem renumerar o ônibus existente', async () => {
    render(<BusManagementPage />)
    await screen.findByText('Ônibus bus-existing')
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar ônibus' }))
    await userEvent.click(screen.getByRole('button', { name: 'Salvar ônibus' }))
    await waitFor(() => expect(mocks.saveBusStructure).toHaveBeenCalled())

    expect(savedBuses?.[0].id).toBe('bus-existing')
    expect(savedBuses?.[0].legacyField).toBe('preservado')
    expect(String(savedBuses?.[1].id)).toMatch(/^bus_/)
  })

  it('associa viajante a assento livre somente após persistência', async () => {
    render(<BusManagementPage />)
    const freeSeats = await screen.findAllByRole('button', {
      name: 'Assento 1, livre',
    })
    await userEvent.click(freeSeats[0])
    await userEvent.click(screen.getByRole('button', { name: /Ana.*Selecionar/ }))
    await waitFor(() => expect(mocks.saveSeatRecord).toHaveBeenCalled())

    expect(savedSeat).toMatchObject({
      busId: 'bus-existing',
      floor: 1,
      seatNumber: 1,
      userCpf: cpf,
    })
  })

  it('não reduz pisos quando isso apagaria assento atribuído', async () => {
    render(<BusManagementPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Editar ônibus' }))
    await userEvent.selectOptions(screen.getByLabelText('Pisos'), '1')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar ônibus' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Libere-o antes')
    expect(mocks.saveBusStructure).not.toHaveBeenCalled()
  })

  it('edita capacidade preservando ID, campos e assentos existentes', async () => {
    render(<BusManagementPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Editar ônibus' }))
    const floorOne = screen.getByLabelText('Assentos no piso 1')
    await userEvent.clear(floorOne)
    await userEvent.type(floorOne, '5')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar ônibus' }))
    await waitFor(() => expect(mocks.saveBusStructure).toHaveBeenCalled())

    expect(savedBuses?.[0]).toMatchObject({
      id: 'bus-existing',
      legacyField: 'preservado',
      seatsFloor1: 5,
    })
    expect(mocks.saveSeatRecord).not.toHaveBeenCalled()
    expect(mocks.deleteSeats).not.toHaveBeenCalled()
  })

  it('exclui ônibus com confirmação e limpa somente seus assentos', async () => {
    render(<BusManagementPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir ônibus' }))
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Excluir ônibus',
      }),
    )
    await waitFor(() => expect(mocks.deleteSeats).toHaveBeenCalled())

    expect(savedBuses).toEqual([])
    expect(screen.getByText('Nenhum ônibus configurado')).toBeInTheDocument()
  })

  it('trata ausência de dados e erro de carregamento', async () => {
    mocks.useTrip.mockReturnValue({
      activeTrip: { ...trip, buses: [] },
      reloadTrips: mocks.reloadTrips,
    })
    const { unmount } = render(<BusManagementPage />)
    expect(await screen.findByText('Nenhum ônibus configurado')).toBeInTheDocument()
    unmount()
    mocks.loadTransportSource.mockRejectedValue(new Error('Assentos indisponíveis'))
    render(<BusManagementPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Assentos indisponíveis')
  })
})
