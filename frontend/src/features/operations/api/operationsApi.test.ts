import { describe, expect, it } from 'vitest'
import { toRoom, toSeat } from './operationsApi'

describe('mapeamento das estruturas operacionais do Supabase', () => {
  it('converte quarto relacional e ocupantes para o contrato da interface', () => {
    expect(toRoom({ id: 'room-1', trip_id: 'trip-1', hotel_id: 'hotel-1', name: '101', room_type: 'Duplo', capacity: 2, room_occupants: [{ profiles: { cpf: '52998224725' } }] })).toEqual({ id: 'room-1', tripId: 'trip-1', hotelId: 'hotel-1', name: '101', type: 'Duplo', capacity: 2, occupants: ['52998224725'] })
  })

  it('converte assento relacional sem expor identificadores internos do viajante', () => {
    expect(toSeat({ id: 'seat-1', trip_id: 'trip-1', bus_id: 'bus-1', floor: 1, seat_number: 4, profiles: { cpf: '52998224725' } })).toEqual({ id: 'seat-1', tripId: 'trip-1', busId: 'bus-1', floor: 1, seatNumber: 4, userCpf: '52998224725' })
  })
})
