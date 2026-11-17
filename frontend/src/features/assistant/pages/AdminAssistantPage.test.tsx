import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Trip } from '../../trips/model/tripTypes'
import { AdminAssistantPage } from './AdminAssistantPage'

const mocks = vi.hoisted(() => ({
  loadHotelSource: vi.fn(),
  loadTransportSource: vi.fn(),
  reloadTrips: vi.fn(),
  saveBusStructure: vi.fn(),
  saveHotelStructure: vi.fn(),
  saveTripRoomAssignments: vi.fn(),
  saveTripSeatAssignments: vi.fn(),
  useTrip: vi.fn(),
}))

vi.mock('../../trips/hooks/useTrip', () => ({ useTrip: mocks.useTrip }))
vi.mock('../../operations/api/operationsApi', () => ({
  loadHotelSource: mocks.loadHotelSource,
  loadTransportSource: mocks.loadTransportSource,
  saveBusStructure: mocks.saveBusStructure,
  saveHotelStructure: mocks.saveHotelStructure,
  saveTripRoomAssignments: mocks.saveTripRoomAssignments,
  saveTripSeatAssignments: mocks.saveTripSeatAssignments,
}))

const cpf = '11144477735'
const trip: Trip = {
  id: 'trip-1', name: 'Retiro', destination: '', departurePlace: '', departureTime: '', date: '',
  maxPeople: 1, price: 0, arrecadationGoal: 0, rules: '',
  buses: [{ id: 'bus-1', label: 'Executivo', floors: 1, seatsFloor1: 4, seatsFloor2: 0, seats: 4 }],
  hotelsJson: '[]', travelersJson: `["${cpf}"]`, travelerCpfs: [cpf],
}
const user = { cpf, name: 'Ana Silva', spouseCpf: '', spouseName: '', childCpfs: [], kids: [], married: false, hasKids: false, birthdate: '', firstLogin: false, role: 'traveler' as const }

describe('AdminAssistantPage', () => {
  beforeEach(() => {
    localStorage.clear()
    Object.values(mocks).forEach((mock) => mock.mockReset())
    mocks.useTrip.mockReturnValue({ activeTrip: trip, reloadTrips: mocks.reloadTrips })
    mocks.loadHotelSource.mockResolvedValue({ rooms: [], users: [user] })
    mocks.loadTransportSource.mockResolvedValue({ seats: [], users: [user] })
    mocks.saveTripSeatAssignments.mockImplementation((_tripId, seats) => Promise.resolve(seats))
  })

  it('responde consultas usando dados reais carregados', async () => {
    render(<AdminAssistantPage />)
    const input = await screen.findByLabelText('Solicitação ao assistente')
    await userEvent.type(input, 'Quantas pessoas ainda não possuem ônibus definido?')
    await userEvent.click(screen.getByRole('button', { name: /Enviar comando/ }))
    expect(await screen.findByText('1 pessoa(s) ainda não possuem assento definido.')).toBeInTheDocument()
    expect(screen.getByText('Ana Silva')).toBeInTheDocument()
  })

  it('só executa distribuição depois da confirmação', async () => {
    render(<AdminAssistantPage />)
    const input = await screen.findByLabelText('Solicitação ao assistente')
    await userEvent.type(input, 'Distribua as pessoas pelos ônibus disponíveis')
    await userEvent.click(screen.getByRole('button', { name: /Enviar comando/ }))
    expect(mocks.saveTripSeatAssignments).not.toHaveBeenCalled()
    await userEvent.click(await screen.findByRole('button', { name: 'Confirmar e executar' }))
    await waitFor(() => expect(mocks.saveTripSeatAssignments).toHaveBeenCalledWith(trip.id, expect.arrayContaining([expect.objectContaining({ userCpf: cpf })])))
    expect(await screen.findByText(/concluído com sucesso/i)).toBeInTheDocument()
  })
})
