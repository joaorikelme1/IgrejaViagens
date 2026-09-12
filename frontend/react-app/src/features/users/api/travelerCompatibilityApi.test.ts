import { afterEach, describe, expect, it, vi } from 'vitest'
import type { UserMutation } from '../model/userTypes'
import {
  addExistingUserToTrip,
  createTravelerForTrip,
  deleteUserGlobally,
  removeTravelerFromTrip,
} from './travelerCompatibilityApi'

interface CapturedRequest {
  body?: unknown
  method: string
  path: string
}

const userMutation: UserMutation = {
  birthdate: '',
  firstLogin: true,
  hasKids: false,
  kids: [],
  initialPassword: 'senha-temporaria',
  married: false,
  name: 'Tiago',
  role: 'traveler',
  spouseName: '',
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

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function backend() {
  const requests: CapturedRequest[] = []
  const fetchMock = vi.fn<typeof fetch>((input, init) => {
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

    if (method === 'DELETE') {
      return Promise.resolve(new Response(null, { status: 204 }))
    }
    return Promise.resolve(jsonResponse(body ?? {}))
  })
  vi.stubGlobal('fetch', fetchMock)
  return requests
}

describe('associações transacionais de viajantes', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('associa usuário existente sem substituir coleções globais', async () => {
    const requests = backend()

    await addExistingUserToTrip('111.444.777-35', 'trip-1')

    expect(requests).toEqual([
      {
        body: undefined,
        method: 'PUT',
        path: '/trips/trip-1/travelers/11144477735',
      },
    ])
  })

  it('cria e associa o novo viajante em um único comando', async () => {
    const requests = backend()

    const created = await createTravelerForTrip(
      '11144477735',
      userMutation,
      'trip-1',
    )

    expect(requests).toHaveLength(1)
    expect(requests[0]).toMatchObject({
      method: 'POST',
      path: '/trips/trip-1/travelers',
      body: {
        cpf: '11144477735',
        firstLogin: true,
        name: 'Tiago',
        password: 'senha-temporaria',
        role: 'traveler',
      },
    })
    expect(created).not.toHaveProperty('password')
  })

  it('remove somente da viagem em um único comando', async () => {
    const requests = backend()

    await removeTravelerFromTrip('11144477735', 'trip-1')

    expect(requests).toEqual([
      {
        body: undefined,
        method: 'DELETE',
        path: '/trips/trip-1/travelers/11144477735',
      },
    ])
  })

  it('delega a exclusão global e a limpeza atômica ao backend', async () => {
    const requests = backend()

    await deleteUserGlobally('11144477735')

    expect(requests).toEqual([
      {
        body: undefined,
        method: 'DELETE',
        path: '/users/11144477735',
      },
    ])
  })
})
