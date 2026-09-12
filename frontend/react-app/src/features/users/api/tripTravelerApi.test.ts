import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadTripTravelerSource } from './tripTravelerApi'

function pathOf(input: RequestInfo | URL) {
  const value =
    input instanceof Request
      ? input.url
      : input instanceof URL
        ? input.href
        : input
  return new URL(value, 'http://localhost').pathname
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('loadTripTravelerSource', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('filtra a viagem e reduz usuários/comprovantes a campos seguros', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>((input) => {
        const path = pathOf(input)
        if (path === '/users') {
          return Promise.resolve(
            jsonResponse([
              {
                cpf: '11144477735',
                name: 'Tiago',
                role: 'traveler',
                password: 'não-deve-chegar-ao-estado',
              },
            ]),
          )
        }
        if (path === '/payments') {
          return Promise.resolve(
            jsonResponse([
              {
                userCpf: '11144477735',
                tripId: 'trip-1',
                paidInstallments: 1,
                totalInstallments: 2,
                receiptsJson: JSON.stringify({
                  1: {
                    fileName: 'comprovante.pdf',
                    status: 'pending',
                    data: 'base64-que-nao-deve-ir-ao-estado',
                  },
                }),
              },
              { userCpf: '11144477735', tripId: 'trip-2' },
            ]),
          )
        }
        if (path === '/seats') {
          return Promise.resolve(
            jsonResponse([
              {
                userCpf: '11144477735',
                tripId: 'trip-1',
                busId: '1',
                floor: 1,
                seatNumber: 8,
              },
            ]),
          )
        }
        return Promise.resolve(
          jsonResponse([
            {
              id: 'room-1',
              tripId: 'trip-1',
              occupants: ['11144477735'],
            },
          ]),
        )
      }),
    )

    const source = await loadTripTravelerSource('trip-1')

    expect(source.payments).toHaveLength(1)
    expect(source.seats).toHaveLength(1)
    expect(source.rooms).toHaveLength(1)
    expect(source.users[0]).not.toHaveProperty('password')
    expect(source.payments[0].receipts[0]).toEqual({
      installment: '1',
      fileName: 'comprovante.pdf',
      status: 'pending',
    })
    expect(JSON.stringify(source)).not.toContain('base64-que-nao-deve-ir-ao-estado')
  })
})
