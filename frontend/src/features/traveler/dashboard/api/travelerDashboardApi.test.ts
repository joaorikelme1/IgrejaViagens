import { describe, expect, it } from 'vitest'
import { buildTravelerDashboard } from '../lib/buildTravelerDashboard'

describe('dashboard do viajante', () => {
  it('mascara os CPFs de acompanhantes na visão do viajante', () => {
    const view = buildTravelerDashboard('52998224725', { id: 'trip-1', name: 'Retiro', destination: '', departurePlace: '', departureTime: '', date: '', maxPeople: 1, price: 0, arrecadationGoal: 0, rules: '', buses: [], hotelsJson: '[]', travelersJson: '[]', travelerCpfs: [] }, { payments: [], seats: [], rooms: [{ id: 'room-1', hotelId: 'hotel-1', name: '101', type: 'duplo', capacity: 2, occupants: ['52998224725', '11144477735'] }] })
    expect(view.room?.companions[0]).toContain('7735')
  })
})
