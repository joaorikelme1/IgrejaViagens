import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Trip } from '../../trips/model/tripTypes'
import type { SystemUser } from '../../users/model/userTypes'
import type {
  HotelConfig,
  HotelSource,
  RoomRecord,
} from '../model/operationTypes'
import { HotelManagementPage } from './HotelManagementPage'

const mocks = vi.hoisted(() => ({
  deleteRoomRecords: vi.fn(),
  loadHotelSource: vi.fn(),
  reloadTrips: vi.fn(),
  saveHotelStructure: vi.fn(),
  saveRoomRecord: vi.fn(),
  useTrip: vi.fn(),
}))

vi.mock('../../trips/hooks/useTrip', () => ({ useTrip: mocks.useTrip }))
vi.mock('../api/operationsApi', () => ({
  deleteRoomRecords: mocks.deleteRoomRecords,
  loadHotelSource: mocks.loadHotelSource,
  saveHotelStructure: mocks.saveHotelStructure,
  saveRoomRecord: mocks.saveRoomRecord,
}))

const cpfs = ['11144477735', '52998224725']
const hotels: HotelConfig[] = [{
  id: 'hotel-legacy',
  name: 'Hotel Central',
  rooms: [{ id: 'room-legacy', name: '101', type: 'double', capacity: 2 }],
}]
const trip: Trip = {
  id: 'trip-1',
  name: 'Retiro',
  destination: '',
  departurePlace: '',
  departureTime: '',
  date: '',
  maxPeople: 2,
  price: 100,
  arrecadationGoal: 200,
  rules: '',
  buses: [],
  hotelsJson: JSON.stringify(hotels),
  travelersJson: JSON.stringify(cpfs),
  travelerCpfs: cpfs,
}

function systemUser(cpf: string, name: string): SystemUser {
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

const existingRoom: RoomRecord = {
  id: 'room-legacy',
  tripId: trip.id,
  hotelId: 'hotel-legacy',
  name: '101',
  type: 'double',
  capacity: 2,
  occupants: [cpfs[0]],
}
const source: HotelSource = {
  rooms: [existingRoom],
  users: [systemUser(cpfs[0], 'Ana'), systemUser(cpfs[1], 'Bruno')],
}
let savedRoom: RoomRecord | null = null
let savedHotels: HotelConfig[] | null = null

describe('HotelManagementPage', () => {
  beforeEach(() => {
    savedRoom = null
    savedHotels = null
    Object.values(mocks).forEach((mock) => mock.mockReset())
    mocks.useTrip.mockReturnValue({ activeTrip: trip, reloadTrips: mocks.reloadTrips })
    mocks.loadHotelSource.mockResolvedValue(source)
    mocks.saveHotelStructure.mockImplementation((_tripId: string, value: HotelConfig[]) => {
      savedHotels = value
      return Promise.resolve()
    })
    mocks.saveRoomRecord.mockImplementation((room: RoomRecord) => {
      savedRoom = room
      return Promise.resolve(room)
    })
    mocks.deleteRoomRecords.mockResolvedValue(undefined)
  })

  afterEach(() => cleanup())

  it('lista hotel, quarto, capacidade e ocupantes', async () => {
    render(<HotelManagementPage />)
    expect(await screen.findByText('Hotel Central')).toBeInTheDocument()
    expect(screen.getByText('Ana')).toBeInTheDocument()
    expect(screen.getByText('1/2')).toBeInTheDocument()
    expect(screen.getByLabelText('1 de 2 lugares ocupados')).toBeInTheDocument()
    expect(screen.queryByText(/room-legacy/)).not.toBeInTheDocument()
  })

  it('cadastra hotel mantendo a estrutura existente', async () => {
    render(<HotelManagementPage />)
    await screen.findByText('Hotel Central')
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar hotel' }))
    await userEvent.type(screen.getByLabelText('Nome do hotel'), 'Hotel Novo')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar hotel' }))
    await waitFor(() => expect(mocks.saveHotelStructure).toHaveBeenCalled())

    expect(savedHotels?.[0].id).toBe('hotel-legacy')
    expect(savedHotels?.[0].rooms[0].id).toBe('room-legacy')
    expect(savedHotels?.[1].name).toBe('Hotel Novo')
  })

  it('distribui viajantes sem remover o ocupante atual', async () => {
    render(<HotelManagementPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Distribuir' }))
    expect(screen.getByRole('checkbox', { name: /Ana/ })).toBeChecked()
    await userEvent.click(screen.getByRole('checkbox', { name: /Bruno/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Salvar ocupantes' }))
    await waitFor(() => expect(mocks.saveRoomRecord).toHaveBeenCalled())

    expect(savedRoom?.id).toBe('room-legacy')
    expect(savedRoom?.occupants).toEqual(cpfs)
  })

  it('edita quarto preservando ID e ocupantes existentes', async () => {
    render(<HotelManagementPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Editar' }))
    const name = screen.getByLabelText('Número ou nome')
    await userEvent.clear(name)
    await userEvent.type(name, 'Suíte 101')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar quarto' }))
    await waitFor(() => expect(mocks.saveRoomRecord).toHaveBeenCalled())

    expect(savedRoom).toMatchObject({
      id: 'room-legacy',
      name: 'Suíte 101',
      occupants: [cpfs[0]],
    })
  })

  it('trata ausência de hotéis e erro de carregamento', async () => {
    mocks.useTrip.mockReturnValue({
      activeTrip: { ...trip, hotelsJson: '[]' },
      reloadTrips: mocks.reloadTrips,
    })
    const { unmount } = render(<HotelManagementPage />)
    expect(await screen.findByText('Nenhum hotel configurado')).toBeInTheDocument()
    unmount()
    mocks.loadHotelSource.mockRejectedValue(new Error('Quartos indisponíveis'))
    render(<HotelManagementPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Quartos indisponíveis')
  })
})
