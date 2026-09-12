import { describe, expect, it } from 'vitest'
import type { BusConfig } from '../../trips/model/tripTypes'
import type { SeatRecord } from '../model/operationTypes'
import {
  assertBusResizeKeepsSeats,
  createBus,
  getSeatConflicts,
  removeBus,
  seatAt,
  updateBus,
} from './transportOperations'

const bus: BusConfig = {
  id: 7,
  floors: 2,
  seatsFloor1: 20,
  seatsFloor2: 10,
  seats: 30,
  plate: 'ABC-1234',
}
const seat: SeatRecord = {
  id: 'seat-existing',
  tripId: 'trip-1',
  busId: '7',
  floor: 2,
  seatNumber: 8,
  userCpf: '11144477735',
}

describe('operações de transporte', () => {
  it('faz CRUD de ônibus, configura pisos e preserva ID/campos existentes', () => {
    const created = createBus([bus])
    const withCreated = [bus, created]
    const edited = updateBus(withCreated, 7, {
      floors: 1,
      seatsFloor1: 25,
      seatsFloor2: 0,
    })
    const removed = removeBus(edited, created.id)

    expect(edited[0]).toMatchObject({
      id: 7,
      plate: 'ABC-1234',
      floors: 1,
      seatsFloor1: 25,
      seatsFloor2: 0,
      seats: 25,
    })
    expect(String(created.id)).toMatch(/^bus_/)
    expect(removed.map((item) => item.id)).toEqual([7])
  })

  it('usa o piso real e bloqueia edição que perderia assento atribuído', () => {
    expect(seatAt([seat], 7, 2, 8)?.id).toBe('seat-existing')
    expect(seatAt([seat], 7, 1, 8)).toBeUndefined()
    expect(() =>
      assertBusResizeKeepsSeats(
        bus,
        { floors: 1, seatsFloor1: 20, seatsFloor2: 0 },
        [seat],
      ),
    ).toThrow('Libere-o antes')
  })

  it('identifica assentos duplicados, inválidos e referências inconsistentes', () => {
    const conflicts = getSeatConflicts(
      [bus],
      [
        seat,
        { ...seat, id: 'duplicate' },
        { ...seat, id: 'driver', floor: 1, seatNumber: 1 },
        { ...seat, id: 'outside', floor: 3, seatNumber: 50 },
        { ...seat, id: 'missing', busId: '404' },
      ],
      [],
    )

    expect(conflicts.some((item) => item.key.startsWith('duplicate-seat'))).toBe(true)
    expect(conflicts.some((item) => item.key === 'driver-seat-driver')).toBe(true)
    expect(conflicts.some((item) => item.key === 'outside-capacity-outside')).toBe(true)
    expect(conflicts.some((item) => item.key === 'missing-bus-missing')).toBe(true)
    expect(conflicts.some((item) => item.key.startsWith('non-member'))).toBe(true)
  })
})
