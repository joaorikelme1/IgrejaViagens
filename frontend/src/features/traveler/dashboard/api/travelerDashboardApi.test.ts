import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadTravelerDashboard } from './travelerDashboardApi'

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function pathOf(input: RequestInfo | URL) {
  const value =
    input instanceof Request
      ? input.url
      : input instanceof URL
        ? input.href
        : input
  return new URL(value, 'http://localhost').pathname
}

describe('loadTravelerDashboard', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('filtra pagamentos, assentos e quartos pelo CPF e pela viagem', async () => {
    const fetchMock = vi.fn<typeof fetch>((input) => {
      const path = pathOf(input)
      if (path === '/payments') {
        return Promise.resolve(
          jsonResponse([
            {
              id: 'mine',
              userCpf: '111.444.777-35',
              tripId: 'trip-1',
              totalInstallments: 4,
              paidInstallments: 2,
            },
            {
              id: 'other-user',
              userCpf: '52998224725',
              tripId: 'trip-1',
              totalInstallments: 1,
              paidInstallments: 1,
            },
            {
              id: 'other-trip',
              userCpf: '11144477735',
              tripId: 'trip-2',
              totalInstallments: 1,
              paidInstallments: 1,
            },
          ]),
        )
      }
      if (path === '/seats') {
        return Promise.resolve(
          jsonResponse([
            {
              id: 'seat-mine',
              userCpf: '11144477735',
              tripId: 'trip-1',
              busId: 2,
              floor: 1,
              seatNumber: 8,
            },
            {
              id: 'seat-other',
              userCpf: '52998224725',
              tripId: 'trip-1',
              busId: 2,
              floor: 1,
              seatNumber: 9,
            },
          ]),
        )
      }
      return Promise.resolve(
        jsonResponse([
          {
            id: 'room-mine',
            tripId: 'trip-1',
            occupants: ['11144477735', '52998224725'],
          },
          {
            id: 'room-other',
            tripId: 'trip-1',
            occupants: ['00000000191'],
          },
          {
            id: 'room-other-trip',
            tripId: 'trip-2',
            occupants: ['11144477735'],
          },
        ]),
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await loadTravelerDashboard('111.444.777-35', 'trip-1')

    expect(result.payments.map((payment) => payment.id)).toEqual(['mine'])
    expect(result.seats.map((seat) => seat.id)).toEqual(['seat-mine'])
    expect(result.rooms.map((room) => room.id)).toEqual(['room-mine'])
    expect(result.seats[0].busId).toBe('2')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
