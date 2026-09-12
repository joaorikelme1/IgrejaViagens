import { describe, expect, it } from 'vitest'
import {
  addHotel,
  addRoom,
  assertRoomCapacity,
  getRoomConflicts,
  parseHotels,
  removeHotel,
  removeRoom,
  updateHotel,
  updateRoom,
} from './hotelOperations'
import type { HotelConfig, RoomRecord } from '../model/operationTypes'

const hotels: HotelConfig[] = [{
  id: 91,
  name: 'Hotel Antigo',
  providerCode: 'preservado',
  rooms: [{ id: 'room-101', name: '101', type: 'double', capacity: 2, balcony: true }],
}]

describe('operações de hotel', () => {
  it('faz CRUD de hotel preservando ID, quartos e campos desconhecidos', () => {
    const created = addHotel(hotels, { id: 'hotel-new', name: 'Hotel Novo' })
    const edited = updateHotel(created, 91, 'Hotel Renomeado')
    const removed = removeHotel(edited, 'hotel-new')

    expect(edited[0]).toMatchObject({
      id: 91,
      name: 'Hotel Renomeado',
      providerCode: 'preservado',
      rooms: [{ id: 'room-101', balcony: true }],
    })
    expect(removed).toHaveLength(1)
    expect(removed[0].id).toBe(91)
  })

  it('faz CRUD de quartos sem renumerar IDs ou perder campos', () => {
    const created = addRoom(hotels, 91, {
      id: 'room-102',
      name: '102',
      type: 'single',
      capacity: 1,
    })
    const edited = updateRoom(created, 91, 'room-101', {
      name: 'Suíte 101',
      type: 'custom',
      capacity: 3,
    })
    const removed = removeRoom(edited, 91, 'room-102')

    expect(edited[0].rooms[0]).toMatchObject({
      id: 'room-101',
      name: 'Suíte 101',
      capacity: 3,
      balcony: true,
    })
    expect(removed[0].rooms.map((room) => room.id)).toEqual(['room-101'])
  })

  it('mantém dados válidos ao interpretar hotelsJson', () => {
    const parsed = parseHotels(JSON.stringify(hotels))
    expect(parsed[0]).toMatchObject({ id: 91, providerCode: 'preservado' })
    expect(parsed[0].rooms[0]).toMatchObject({ id: 'room-101', balcony: true })
    expect(parseHotels('{inválido')).toEqual([])
  })

  it('bloqueia capacidade excedida e identifica inconsistências do backend', () => {
    const roomRecords: RoomRecord[] = [
      {
        id: 'room-101',
        tripId: 'trip-1',
        hotelId: '91',
        name: '101',
        type: 'double',
        capacity: 2,
        occupants: ['11144477735', '52998224725', '93541134780'],
      },
      {
        id: 'orphan',
        tripId: 'trip-1',
        hotelId: '',
        name: 'Órfão',
        type: 'custom',
        capacity: 1,
        occupants: ['11144477735'],
      },
    ]
    const conflicts = getRoomConflicts(
      hotels,
      roomRecords,
      ['11144477735', '52998224725'],
    )

    expect(() => assertRoomCapacity(1, ['11144477735', '52998224725'])).toThrow(
      'no máximo 1',
    )
    expect(conflicts.map((item) => item.key)).toEqual(
      expect.arrayContaining([
        'capacity-room-101',
        'orphan-room-orphan',
        'non-member-room-101-93541134780',
        'multiple-rooms-11144477735',
      ]),
    )
  })
})
