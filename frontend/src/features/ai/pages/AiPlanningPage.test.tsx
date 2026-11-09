import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiPlan } from '../model/aiPlanningTypes'
import { AiPlanningPage } from './AiPlanningPage'

const mocks = vi.hoisted(() => ({
  apply: vi.fn(),
  deletePreference: vi.fn(),
  discard: vi.fn(),
  generate: vi.fn(),
  getUsage: vi.fn(),
  list: vi.fn(),
  listPreferences: vi.fn(),
  listUsers: vi.fn(),
  reloadTrips: vi.fn(),
  savePreference: vi.fn(),
  status: vi.fn(),
}))

vi.mock('../../trips/hooks/useTrip', () => ({
  useTrip: () => ({
    activeTrip: {
      id: 'trip-1',
      name: 'Retiro 2027',
      travelerCpfs: ['52998224725'],
    },
    reloadTrips: mocks.reloadTrips,
  }),
}))

vi.mock('../api/aiPlanningApi', () => ({
  applyAiPlan: mocks.apply,
  deleteTravelerPlanningPreference: mocks.deletePreference,
  discardAiPlan: mocks.discard,
  generateAiPlan: mocks.generate,
  getAiPlanningStatus: mocks.status,
  getAiUsage: mocks.getUsage,
  listAiPlans: mocks.list,
  listTravelerPlanningPreferences: mocks.listPreferences,
  saveTravelerPlanningPreference: mocks.savePreference,
}))

vi.mock('../../users/api/usersApi', () => ({
  listUsers: mocks.listUsers,
}))

const plan: AiPlan = {
  id: 'plan-1',
  tripId: 'trip-1',
  status: 'GENERATED',
  focus: 'ALL',
  provider: 'local',
  model: 'planejador-deterministico-v1',
  providerRequestId: null,
  promptVersion: 'deterministic-planner-v1',
  snapshotHash: 'a'.repeat(64),
  currentSnapshot: true,
  result: {
    summary: 'Famílias próximas e assentos acessíveis.',
    roomCreations: [{
      key: 'new_room_001',
      hotel: 'hotel_001',
      name: 'Quarto 102',
      type: 'Duplo',
      capacity: 2,
      reason: 'Capacidade necessária.',
    }],
    roomAssignments: [{
      traveler: 'traveler_001',
      room: 'new_room_001',
      reason: 'Preferência familiar.',
    }],
    seatAssignments: [{
      traveler: 'traveler_001',
      bus: 'bus_001',
      floor: 1,
      seatNumber: 2,
      reason: 'Piso inferior.',
    }],
    warnings: [],
  },
  travelerLabels: { traveler_001: 'Ana' },
  busLabels: { bus_001: 'Ônibus 1' },
  hotelLabels: { hotel_001: 'Hotel Central' },
  roomLabels: { new_room_001: 'Quarto 102' },
  inputTokens: null,
  outputTokens: null,
  estimatedCost: null,
  errorCode: null,
  createdAt: '2027-01-01T12:00:00Z',
  updatedAt: '2027-01-01T12:00:00Z',
  appliedAt: null,
}

describe('AiPlanningPage', () => {
  beforeEach(() => {
    mocks.apply.mockReset().mockResolvedValue({
      planId: plan.id,
      roomsCreated: 1,
      travelersAssignedToRooms: 1,
      travelersAssignedToSeats: 1,
    })
    mocks.discard.mockReset().mockResolvedValue({ ...plan, status: 'DISCARDED' })
    mocks.deletePreference.mockReset().mockResolvedValue(undefined)
    mocks.generate.mockReset().mockResolvedValue(plan)
    mocks.getUsage.mockReset().mockResolvedValue({
      tripId: 'trip-1',
      requestsToday: 1,
      maxRequestsPerDay: 200,
      activeGenerations: 0,
    })
    mocks.list.mockReset().mockResolvedValue([plan])
    mocks.listPreferences.mockReset().mockResolvedValue([])
    mocks.listUsers.mockReset().mockResolvedValue([{
      birthdate: '',
      childCpfs: [],
      cpf: '52998224725',
      firstLogin: false,
      hasKids: false,
      kids: [],
      married: false,
      name: 'Ana',
      role: 'traveler',
      spouseName: '',
      spouseCpf: '',
    }])
    mocks.reloadTrips.mockReset().mockResolvedValue(undefined)
    mocks.status.mockReset().mockResolvedValue({
      available: true,
      provider: 'local',
      model: 'planejador-deterministico-v1',
      generationCooldownSeconds: 5,
      maxRequestsPerAdminPerHour: 60,
      maxRequestsPerTripPerDay: 200,
    })
    mocks.savePreference.mockReset().mockResolvedValue({
      userCpf: '52998224725',
      mobilityRequirement: 'REQUIRE_LOWER_FLOOR',
      seatRegion: 'ANY',
      preferredBusFloor: null,
      preferredRoomType: null,
      includeInAiPlanning: true,
      companionCpfs: [],
      separatedFromCpfs: [],
      version: 0,
      updatedAt: '2027-01-01T12:00:00Z',
    })
  })

  afterEach(cleanup)

  it('exibe a proposta com nomes resolvidos e exige confirmacao para aplicar', async () => {
    render(<AiPlanningPage />)

    expect(await screen.findByText('Famílias próximas e assentos acessíveis.')).toBeInTheDocument()
    expect(screen.getAllByText('Ana').length).toBeGreaterThan(0)
    expect(screen.getByText('Hotel Central')).toBeInTheDocument()
    const applyButton = screen.getByRole('button', { name: 'Aplicar plano' })
    expect(applyButton).toBeDisabled()

    await userEvent.click(screen.getByRole('checkbox'))
    expect(applyButton).toBeEnabled()
    await userEvent.click(applyButton)

    await waitFor(() => expect(mocks.apply).toHaveBeenCalledWith(plan.id))
    expect(mocks.reloadTrips).toHaveBeenCalled()
  })

  it('informa quando o planejador local esta desativado', async () => {
    mocks.status.mockResolvedValue({
      available: false,
      provider: 'local',
      model: 'planejador-deterministico-v1',
      generationCooldownSeconds: 5,
      maxRequestsPerAdminPerHour: 60,
      maxRequestsPerTripPerDay: 200,
    })
    mocks.list.mockResolvedValue([])
    render(<AiPlanningPage />)

    expect(await screen.findByText('Planejador desativado')).toBeInTheDocument()
    expect(screen.getByText(/não utiliza API externa/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Gerar nova proposta/i })).not.toBeInTheDocument()
  })

  it('permite configurar preferencia operacional do viajante', async () => {
    render(<AiPlanningPage />)

    await userEvent.click(await screen.findByRole('button', { name: /Ana.*Padrão/s }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await userEvent.selectOptions(
      screen.getByLabelText('Mobilidade'),
      'REQUIRE_LOWER_FLOOR',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Salvar preferências' }))

    await waitFor(() => expect(mocks.savePreference).toHaveBeenCalledWith(
      'trip-1',
      '52998224725',
      expect.objectContaining({ mobilityRequirement: 'REQUIRE_LOWER_FLOOR' }),
    ))
  })

  it('informa que o processamento local nao possui cobranca de API', async () => {
    render(<AiPlanningPage />)
    expect(await screen.findByText(/Processamento local/)).toBeInTheDocument()
    expect(screen.getByText(/Sem cobrança/)).toBeInTheDocument()
  })
})
