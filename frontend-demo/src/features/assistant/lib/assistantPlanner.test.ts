import { describe, expect, it } from 'vitest'
import type { AssistantContext } from '../model/assistantTypes'
import { buildAssistantPlan, executeAssistantOperation } from './assistantPlanner'

const cpfs = ['11144477735', '52998224725', '12345678909']
const context: AssistantContext = {
  trip: { id: 'trip-1', name: 'Retiro', destination: '', departurePlace: '', departureTime: '', date: '', maxPeople: 3, price: 0, arrecadationGoal: 0, rules: '', buses: [], hotelsJson: '[]', travelersJson: '[]', travelerCpfs: cpfs },
  users: [
    { cpf: cpfs[0], name: 'Bruno Silva', spouseCpf: cpfs[1], spouseName: 'Ana Silva', childCpfs: [cpfs[2]], kids: ['Lia Silva'], married: true, hasKids: true, birthdate: '', firstLogin: false, role: 'traveler' },
    { cpf: cpfs[1], name: 'Ana Silva', spouseCpf: cpfs[0], spouseName: 'Bruno Silva', childCpfs: [], kids: [], married: true, hasKids: false, birthdate: '', firstLogin: false, role: 'traveler' },
    { cpf: cpfs[2], name: 'Lia Silva', spouseCpf: '', spouseName: '', childCpfs: [], kids: [], married: false, hasKids: false, birthdate: '', firstLogin: false, role: 'traveler' },
  ],
  buses: [{ id: 'bus-1', label: 'Executivo 1', floors: 1, seatsFloor1: 6, seatsFloor2: 0, seats: 6 }],
  hotels: [{ id: 'hotel-1', name: 'Central', rooms: [{ id: 'room-1', name: '101', type: 'family', capacity: 3 }] }],
  rooms: [],
  seats: [],
}

describe('assistantPlanner', () => {
  it('consulta pessoas sem alocação', () => {
    expect(buildAssistantPlan({ kind: 'query_unassigned_seats' }, context)).toMatchObject({ summary: '3 pessoa(s) ainda não possuem assento definido.' })
  })

  it('gera prévia familiar para ônibus e quartos', () => {
    const seats = buildAssistantPlan({ kind: 'distribute_seats' }, context)
    expect(seats.operation?.kind).toBe('save_seats')
    expect(seats.summary).toContain('3 pessoa(s)')
    const rooms = buildAssistantPlan({ kind: 'distribute_rooms' }, context)
    expect(rooms.operation?.kind).toBe('save_rooms')
    expect(rooms.warnings).toEqual([])
  })

  it('gera uma única prévia para distribuir quartos e assentos pendentes', () => {
    const plan = buildAssistantPlan({ kind: 'distribute_allocations' }, context)
    expect(plan.operation).toMatchObject({ kind: 'save_allocations' })
    expect(plan.summary).toContain('3 pessoa(s) receberão quarto')
    expect(plan.summary).toContain('3 pessoa(s) receberão assento')
    expect(plan.details).toContain('Famílias serão mantidas juntas ou próximas sempre que houver capacidade.')
  })

  it('preserva alocações existentes no pedido combinado', () => {
    const current = {
      ...context,
      rooms: [{ id: 'room-1', tripId: 'trip-1', hotelId: 'hotel-1', name: '101', type: 'family', capacity: 3, occupants: [cpfs[0]] }],
      seats: [{ id: 'seat-1', tripId: 'trip-1', busId: 'bus-1', floor: 1, seatNumber: 1, userCpf: cpfs[0] }],
    }
    const plan = buildAssistantPlan({ kind: 'distribute_allocations' }, current)
    expect(plan.summary).toContain('2 pessoa(s) receberão quarto')
    expect(plan.summary).toContain('2 pessoa(s) receberão assento')
    expect(plan.operation?.kind).toBe('save_allocations')
    if (plan.operation?.kind !== 'save_allocations') return
    expect(plan.operation.rooms[0].occupants).toContain(cpfs[0])
    expect(plan.operation.seats.some((seat) => seat.userCpf === cpfs[0])).toBe(true)
  })

  it('não oferece execução combinada quando falta estrutura', () => {
    const plan = buildAssistantPlan(
      { kind: 'distribute_allocations' },
      { ...context, buses: [], hotels: [] },
    )
    expect(plan.operation).toBeUndefined()
    expect(plan.details).toEqual(expect.arrayContaining([
      'Cadastre ao menos um ônibus.',
      'Cadastre ao menos um quarto de hotel.',
    ]))
  })

  it('move uma família inteira para o ônibus solicitado', () => {
    const plan = buildAssistantPlan({ kind: 'move_family_bus', family: 'Silva', bus: '1' }, context)
    expect(plan.operation?.kind).toBe('save_seats')
    expect(plan.details).toEqual(['Bruno Silva', 'Ana Silva', 'Lia Silva'])
  })

  it('não propõe execução silenciosa quando não há capacidade', () => {
    const plan = buildAssistantPlan({ kind: 'move_family_bus', family: 'Silva', bus: '1' }, { ...context, buses: [{ ...context.buses[0], seatsFloor1: 2, seats: 2 }] })
    expect(plan.operation).toBeUndefined()
    expect(plan.summary).toMatch(/não possui vagas suficientes/i)
  })

  it('bloqueia execução local para quem não é administrador', async () => {
    await expect(executeAssistantOperation('trip-1', { kind: 'save_seats', seats: [] }, 'traveler'))
      .rejects.toThrow('Somente administradores')
  })
})
