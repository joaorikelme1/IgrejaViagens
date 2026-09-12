import { describe, expect, it } from 'vitest'
import type { Trip } from '../../../trips/model/tripTypes'
import type { TravelerDashboardSource } from '../model/travelerDashboardTypes'
import { buildTravelerDashboard } from './buildTravelerDashboard'

const trip: Trip = {
  id: 'trip-1',
  name: 'Retiro',
  destination: 'Goiânia',
  departurePlace: 'Brasília',
  departureTime: '08:00',
  date: '2027-01-20',
  maxPeople: 44,
  price: 800,
  arrecadationGoal: 20000,
  rules: '',
  buses: [
    {
      id: 'bus-1',
      floors: 1,
      seatsFloor1: 44,
      seatsFloor2: 0,
      seats: 44,
    },
  ],
  hotelsJson: '[]',
  travelersJson: '["11144477735"]',
  travelerCpfs: ['11144477735'],
}

const emptySource: TravelerDashboardSource = {
  payments: [],
  rooms: [],
  seats: [],
}

describe('buildTravelerDashboard', () => {
  it('ignora assento inválido, elimina duplicidade e sinaliza inconsistências', () => {
    const result = buildTravelerDashboard('11144477735', trip, {
      ...emptySource,
      seats: [
        { id: 'seat-1', busId: '', floor: 1, seatNumber: 1 },
        { id: 'seat-2', busId: 'bus-1', floor: 1, seatNumber: 45 },
        { id: 'seat-3', busId: 'bus-1', floor: 1, seatNumber: 45 },
        { id: 'seat-4', busId: 'bus-2', floor: 2, seatNumber: 2 },
      ],
    })

    expect(result.seats).toEqual([
      { busId: 'bus-1', floor: 1, seatNumbers: [45] },
      { busId: 'bus-2', floor: 2, seatNumbers: [2] },
    ])
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        'Um registro de assento inválido foi ignorado.',
        'O assento 45 do ônibus bus-1 está fora da configuração atual.',
        'O assento 2 referencia um ônibus não configurado.',
        'Foram encontrados assentos em mais de um ônibus para o seu CPF.',
      ]),
    )
  })

  it('não produz percentual inválido quando o total de parcelas é zero', () => {
    const result = buildTravelerDashboard('11144477735', trip, {
      ...emptySource,
      payments: [
        { id: 'payment-1', paidInstallments: 1, totalInstallments: 0 },
      ],
    })

    expect(result.payment).toEqual({
      paidInstallments: 0,
      percentage: 0,
      status: 'pending',
      totalInstallments: 0,
    })
    expect(result.warnings).toContain(
      'O plano de pagamento possui uma quantidade de parcelas inválida.',
    )
  })
})
