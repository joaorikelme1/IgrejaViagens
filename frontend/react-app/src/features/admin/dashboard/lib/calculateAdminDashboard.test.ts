import { describe, expect, it } from 'vitest'
import type { Trip } from '../../../trips/model/tripTypes'
import { calculateAdminDashboard } from './calculateAdminDashboard'

const trip: Trip = {
  id: 'trip-1',
  name: 'Retiro',
  destination: 'Goiânia',
  departurePlace: 'Brasília',
  departureTime: '08:00',
  date: '2027-01-20',
  maxPeople: 50,
  price: 1000,
  arrecadationGoal: 3000,
  rules: '',
  buses: [
    {
      id: 'bus-7',
      floors: 1,
      seatsFloor1: 50,
      seatsFloor2: 0,
      seats: 50,
    },
  ],
  hotelsJson: '[]',
  travelersJson: '["11144477735","52998224725"]',
  travelerCpfs: ['11144477735', '52998224725'],
}

describe('calculateAdminDashboard', () => {
  it('trata coleções vazias e valores sem divisor', () => {
    const result = calculateAdminDashboard(
      { ...trip, price: 0, arrecadationGoal: 0, buses: [], travelerCpfs: [] },
      { users: [], payments: [], seats: [] },
    )

    expect(result).toMatchObject({
      totalTravelers: 0,
      occupiedSeats: 0,
      totalSeats: 0,
      paidInstallments: 0,
      pendingInstallments: 0,
      pendingReceipts: 0,
      collectedAmount: 0,
      arrecadationGoal: 0,
      arrecadationPercentage: 0,
    })
  })

  it('calcula indicadores somente para a viagem e seus viajantes', () => {
    const result = calculateAdminDashboard(trip, {
      users: [
        { cpf: '11144477735', name: 'Tiago Viajante' },
        { cpf: '52998224725', name: 'Ana Admin' },
        { cpf: '00000000000', name: 'Pessoa externa' },
      ],
      payments: [
        {
          userCpf: '11144477735',
          tripId: trip.id,
          totalInstallments: 4,
          paidInstallments: 2,
          receipts: [{ status: 'pending' }],
        },
        {
          userCpf: '52998224725',
          tripId: trip.id,
          totalInstallments: 2,
          paidInstallments: 1,
          receipts: [{ status: 'approved' }],
        },
        {
          userCpf: '00000000000',
          tripId: trip.id,
          totalInstallments: 1,
          paidInstallments: 1,
          receipts: [{ status: 'pending' }],
        },
      ],
      seats: [
        { id: '1', tripId: trip.id, busId: 'bus-7', userCpf: '11144477735' },
        { id: '2', tripId: 'other', busId: 'bus-7', userCpf: '52998224725' },
      ],
    })

    expect(result.totalTravelers).toBe(2)
    expect(result.occupiedSeats).toBe(1)
    expect(result.totalSeats).toBe(50)
    expect(result.paidInstallments).toBe(3)
    expect(result.pendingInstallments).toBe(3)
    expect(result.pendingReceipts).toBe(1)
    expect(result.collectedAmount).toBe(1000)
    expect(result.arrecadationGoal).toBe(3000)
    expect(result.arrecadationPercentage).toBeCloseTo(33.33, 1)
    expect(result.installmentRows).toEqual([
      { name: 'Tiago', paid: 2, total: 4 },
      { name: 'Ana', paid: 1, total: 2 },
    ])
  })
})
