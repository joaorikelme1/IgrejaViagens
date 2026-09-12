import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  deleteRoomRecords,
  deleteSeats,
  saveBusStructure,
  saveHotelStructure,
  saveRoomRecord,
  saveSeatRecord,
} from './operationsApi'

interface CapturedRequest {
  body?: unknown
  method: string
  path: string
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

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function backend(data: Record<string, unknown>, putStatus = 200) {
  const requests: CapturedRequest[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>((input, init) => {
      const path = pathOf(input)
      const method = init?.method ?? 'GET'
      if (path === '/auth/csrf') {
        return Promise.resolve(jsonResponse({
          headerName: 'X-XSRF-TOKEN',
          token: 'csrf-test-token',
        }))
      }
      const body: unknown =
        typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
      requests.push({ body, method, path })
      if (method === 'PUT') {
        return Promise.resolve(
          putStatus >= 400
            ? jsonResponse({ message: 'Falha de persistência' }, putStatus)
            : jsonResponse(body),
        )
      }
      return Promise.resolve(jsonResponse(data[path] ?? []))
    }),
  )
  return requests
}

function requestBody(requests: CapturedRequest[], path: string) {
  return requests.find(
    (request) => request.method === 'PUT' && request.path === path,
  )?.body as Record<string, unknown> | undefined
}

describe('operationsApi', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('preserva os demais campos da viagem ao atualizar hotéis ou ônibus', async () => {
    const requests = backend({
      '/trips': [{
        id: 'trip-1',
        hotelsJson: '[]',
        busesJson: '[]',
        travelersJson: '["11144477735"]',
        serverRevision: 13,
      }],
    })
    await saveHotelStructure('trip-1', [{ id: 'hotel-1', name: 'Central', rooms: [] }])
    await saveBusStructure('trip-1', [{
      id: 'bus-legacy',
      floors: 1,
      seatsFloor1: 20,
      seatsFloor2: 0,
      seats: 20,
    }])

    const writes = requests.filter((request) => request.path === '/trips/trip-1')
    expect(writes[0].body).toMatchObject({
      id: 'trip-1',
      serverRevision: 13,
      travelersJson: '["11144477735"]',
    })
    expect(writes[1].body).toMatchObject({
      id: 'trip-1',
      serverRevision: 13,
    })
  })

  it('persiste somente o quarto e o assento alterados em endpoints granulares', async () => {
    const requests = backend({
      '/rooms': [{
        id: 'room-existing',
        tripId: 'trip-1',
        hotelId: 'hotel-1',
        name: '101',
        type: 'double',
        capacity: 2,
        occupants: ['11144477735'],
        providerCode: 'room-preserved',
      }],
      '/seats': [{
        id: 'seat-existing',
        tripId: 'trip-1',
        busId: 'bus-1',
        floor: 2,
        seatNumber: 8,
        userCpf: '11144477735',
        providerCode: 'seat-preserved',
      }],
    })

    await saveRoomRecord({
      id: 'room-existing',
      tripId: 'trip-1',
      hotelId: 'hotel-1',
      name: 'Suíte 101',
      type: 'custom',
      capacity: 3,
      occupants: ['11144477735'],
    })
    await saveSeatRecord({
      id: 'seat-existing',
      tripId: 'trip-1',
      busId: 'bus-1',
      floor: 2,
      seatNumber: 8,
      userCpf: '52998224725',
    })

    expect(requestBody(requests, '/rooms/room-existing')).toMatchObject({
      id: 'room-existing',
      occupants: ['11144477735'],
      capacity: 3,
    })
    expect(requestBody(requests, '/seats/seat-existing')).toMatchObject({
      id: 'seat-existing',
      floor: 2,
      seatNumber: 8,
      userCpf: '52998224725',
    })
    expect(requests.some((request) => request.path.endsWith('/bulk'))).toBe(false)
  })

  it('exclui quartos e assentos por ID sem substituir coleções', async () => {
    const requests = backend({
      '/seats': [
        {
          id: 'seat-target',
          tripId: 'trip-1',
          busId: 'bus-1',
          floor: 1,
          seatNumber: 4,
          userCpf: '11144477735',
        },
        {
          id: 'seat-other',
          tripId: 'trip-2',
          busId: 'bus-2',
          floor: 1,
          seatNumber: 4,
          userCpf: '52998224725',
        },
      ],
    })

    await deleteRoomRecords('trip-1', ['room-1', 'room-2'])
    await deleteSeats('trip-1', (seat) => seat.busId === 'bus-1')

    expect(requests.filter((request) => request.method === 'DELETE')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '/rooms/room-1' }),
        expect.objectContaining({ path: '/rooms/room-2' }),
        expect.objectContaining({ path: '/seats/seat-target' }),
      ]),
    )
    expect(
      requests.some(
        (request) =>
          request.method === 'DELETE' && request.path === '/seats/seat-other',
      ),
    ).toBe(false)
  })

  it('propaga erro de persistência sem confirmar sucesso', async () => {
    backend({ '/trips': [{ id: 'trip-1', hotelsJson: '[]' }] }, 500)
    await expect(saveHotelStructure('trip-1', [])).rejects.toThrow(
      'Falha de persistência',
    )
  })
})
