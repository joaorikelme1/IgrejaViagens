import { describe, expect, it } from 'vitest'
import type { BusConfig } from '../model/tripTypes'
import { busDisplayName } from './busDisplayName'

const bus = (label?: string): BusConfig => ({
  id: 'e178f040-7830-43a9-a003-932061fe5aec',
  label,
  floors: 1,
  seatsFloor1: 44,
  seatsFloor2: 0,
  seats: 44,
})

describe('busDisplayName', () => {
  it('substitui IDs técnicos por uma identificação ordinal', () => {
    expect(busDisplayName(bus(), 0)).toBe('Ônibus 1')
    expect(
      busDisplayName(
        bus('Ônibus e178f040-7830-43a9-a003-932061fe5aec'),
        1,
      ),
    ).toBe('Ônibus 2')
  })

  it('preserva nomes informados pelo administrador', () => {
    expect(busDisplayName(bus('Executivo Azul'), 0)).toBe('Executivo Azul')
  })
})
