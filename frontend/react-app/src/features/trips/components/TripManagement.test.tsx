import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../../App'
import { AppProviders } from '../../../app/providers'
import type { AuthUser } from '../../auth/model/authTypes'
import {
  readActiveTripId,
  writeActiveTripId,
} from '../storage/activeTripStorage'

const admin: AuthUser = {
  cpf: '52998224725',
  name: 'Ana Administradora',
  role: 'admin',
  birthdate: '',
  firstLogin: false,
  married: false,
  spouseName: '',
  hasKids: false,
  kids: [],
}

const rawTrip = {
  id: 'trip-1',
  name: 'Retiro 2027',
  destination: 'Goiânia',
  departurePlace: 'Brasília',
  departureTime: '08:00',
  date: '2027-01-20',
  maxPeople: 44,
  price: 800,
  arrecadationGoal: 20000,
  rules: 'Levar documento',
  busesJson: JSON.stringify([
    {
      id: 'bus-existing',
      floors: 1,
      seatsFloor1: 44,
      seatsFloor2: 0,
      seats: 44,
      plate: 'ABC1D23',
    },
  ]),
  hotelsJson: JSON.stringify([{ id: 'hotel-1', name: 'Hotel Central' }]),
  travelersJson: JSON.stringify(['11144477735']),
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function requestPath(input: RequestInfo | URL) {
  const url =
    input instanceof Request
      ? input.url
      : input instanceof URL
        ? input.href
        : input
  return new URL(url, 'http://localhost').pathname
}

function parseRequestBody(init?: RequestInit) {
  if (typeof init?.body !== 'string') {
    throw new Error('Corpo JSON não informado no teste.')
  }
  return JSON.parse(init.body) as unknown
}

function renderRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppProviders>
        <App />
      </AppProviders>
    </MemoryRouter>,
  )
}

describe('gestão de viagens e configurações', () => {
  const fetchMock = vi.fn<typeof fetch>()
  let resourceHandler: (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => Promise<Response>

  beforeEach(() => {
    sessionStorage.clear()
    fetchMock.mockReset()
    resourceHandler = () => Promise.resolve(jsonResponse([]))
    fetchMock.mockImplementation((input, init) => {
      const path = requestPath(input)
      if (path === '/auth/me') {
        return Promise.resolve(jsonResponse(admin))
      }
      if (path === '/auth/csrf') {
        return Promise.resolve(jsonResponse({
          headerName: 'X-XSRF-TOKEN',
          token: 'csrf-test-token',
        }))
      }
      return resourceHandler(input, init)
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('cria uma viagem, persiste a meta e a torna ativa', async () => {
    const savedTripBodies: Array<Record<string, unknown>> = []
    resourceHandler = (input, init) => {
      const path = requestPath(input)
      if (path === '/trips' && !init?.method) return Promise.resolve(jsonResponse([]))
      if (path === '/trips' && init?.method === 'POST') {
        const body = parseRequestBody(init) as Record<string, unknown>
        savedTripBodies.push(body)
        return Promise.resolve(jsonResponse(body))
      }
      return Promise.resolve(jsonResponse([]))
    }

    renderRoute('/admin/cadastros')
    await userEvent.click(
      await screen.findByRole('button', { name: /Viagem ativa.*Selecionar viagem/ }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Nova viagem' }))

    await userEvent.type(screen.getByLabelText('Nome da viagem'), 'Conferência 2028')
    await userEvent.type(screen.getByLabelText('Origem'), 'Brasília')
    await userEvent.type(screen.getByLabelText('Destino'), 'Caldas Novas')
    await userEvent.type(screen.getByLabelText('Data'), '2028-04-10')
    await userEvent.type(screen.getByLabelText('Horário'), '07:30')
    const goal = screen.getByRole('spinbutton', { name: /Meta de arrecadação/ })
    await userEvent.clear(goal)
    await userEvent.type(goal, '30000')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar viagem' }))

    await waitFor(() => expect(savedTripBodies).toHaveLength(1))
    expect(savedTripBodies[0]).toMatchObject({
      name: 'Conferência 2028',
      departurePlace: 'Brasília',
      destination: 'Caldas Novas',
      arrecadationGoal: 30000,
      hotelsJson: '[]',
      travelersJson: '[]',
    })
    expect(readActiveTripId()).toBe(String(savedTripBodies[0].id))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('edita viagem, configura ônibus e preserva hotéis, viajantes e IDs', async () => {
    let persistedBody: Record<string, unknown> | null = null
    writeActiveTripId(rawTrip.id)
    resourceHandler = (input, init) => {
      const path = requestPath(input)
      if (path === '/trips' && !init?.method) {
        return Promise.resolve(jsonResponse([rawTrip]))
      }
      if (path === '/trips/trip-1' && init?.method === 'PUT') {
        persistedBody = parseRequestBody(init) as Record<string, unknown>
        return Promise.resolve(jsonResponse(persistedBody))
      }
      return Promise.resolve(jsonResponse([]))
    }

    renderRoute('/admin/cadastros')
    await userEvent.click(
      await screen.findByRole('button', { name: /Viagem ativa.*Retiro 2027/ }),
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Editar viagem Retiro 2027' }),
    )

    expect(
      screen.getByRole('button', { name: 'Remover ônibus 1' }),
    ).toBeDisabled()

    const destination = screen.getByLabelText('Destino')
    await userEvent.clear(destination)
    await userEvent.type(destination, 'Pirenópolis')
    const goal = screen.getByRole('spinbutton', { name: /Meta de arrecadação/ })
    await userEvent.clear(goal)
    await userEvent.type(goal, '35000')
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Pisos do ônibus 1' }),
      '2',
    )
    const secondFloor = screen.getByRole('spinbutton', {
      name: 'Assentos no segundo piso do ônibus 1',
    })
    await userEvent.clear(secondFloor)
    await userEvent.type(secondFloor, '18')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar viagem' }))

    await waitFor(() => expect(persistedBody).not.toBeNull())
    const persistedTrip = persistedBody as Record<string, unknown> | null
    expect(persistedTrip).toMatchObject({
      id: rawTrip.id,
      destination: 'Pirenópolis',
      arrecadationGoal: 35000,
      hotelsJson: rawTrip.hotelsJson,
      travelersJson: rawTrip.travelersJson,
    })
    const buses = JSON.parse(String(persistedTrip?.busesJson)) as Array<
      Record<string, unknown>
    >
    expect(buses[0]).toMatchObject({
      id: 'bus-existing',
      plate: 'ABC1D23',
      floors: 2,
      seatsFloor1: 44,
      seatsFloor2: 18,
      seats: 62,
    })
  })

  it('só exclui após confirmação e delega a limpeza atômica ao backend', async () => {
    const deleteRequests: string[] = []
    writeActiveTripId(rawTrip.id)
    resourceHandler = (input, init) => {
      const path = requestPath(input)
      if (path === '/trips' && !init?.method) {
        return Promise.resolve(jsonResponse([rawTrip]))
      }
      if (init?.method === 'DELETE') {
        deleteRequests.push(path)
        return Promise.resolve(new Response(null, { status: 204 }))
      }
      return Promise.resolve(jsonResponse([]))
    }

    renderRoute('/admin/cadastros')
    await userEvent.click(
      await screen.findByRole('button', { name: /Viagem ativa.*Retiro 2027/ }),
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Excluir viagem Retiro 2027' }),
    )

    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      'Esta ação não pode ser desfeita.',
    )
    expect(deleteRequests).toHaveLength(0)
    await userEvent.click(screen.getByRole('button', { name: 'Excluir viagem' }))

    await waitFor(() => expect(deleteRequests).toEqual(['/trips/trip-1']))
    expect(readActiveTripId()).toBeNull()
  })

  it('não anuncia sucesso quando a persistência das Configurações falha', async () => {
    writeActiveTripId(rawTrip.id)
    resourceHandler = (input, init) => {
      const path = requestPath(input)
      if (path === '/trips' && !init?.method) {
        return Promise.resolve(jsonResponse([rawTrip]))
      }
      if (path === '/trips/trip-1') {
        return Promise.resolve(
          jsonResponse({ message: 'Falha controlada' }, 500),
        )
      }
      return Promise.resolve(jsonResponse([]))
    }

    renderRoute('/admin/configuracoes')
    await userEvent.click(
      await screen.findByRole('button', { name: 'Salvar configurações' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('Falha controlada')
    expect(
      screen.queryByText('Configurações salvas com sucesso.'),
    ).not.toBeInTheDocument()
    expect(readActiveTripId()).toBe(rawTrip.id)
  })

  it('atualiza Configurações e mantém a mesma viagem ativa', async () => {
    let persistedBody: Record<string, unknown> | null = null
    writeActiveTripId(rawTrip.id)
    resourceHandler = (input, init) => {
      const path = requestPath(input)
      if (path === '/trips' && !init?.method) {
        return Promise.resolve(jsonResponse([rawTrip]))
      }
      if (path === '/trips/trip-1') {
        persistedBody = parseRequestBody(init) as Record<string, unknown>
        return Promise.resolve(jsonResponse(persistedBody))
      }
      return Promise.resolve(jsonResponse([]))
    }

    renderRoute('/admin/configuracoes')
    const name = await screen.findByLabelText('Nome da viagem')
    await userEvent.clear(name)
    await userEvent.type(name, 'Retiro atualizado')
    await userEvent.click(screen.getByRole('button', { name: 'Usar sugestão' }))
    await userEvent.click(screen.getByRole('button', { name: 'Salvar configurações' }))

    expect(
      await screen.findByText('Configurações salvas com sucesso.'),
    ).toBeInTheDocument()
    expect(readActiveTripId()).toBe(rawTrip.id)
    expect(
      persistedBody as Record<string, unknown> | null,
    ).toMatchObject({
      id: rawTrip.id,
      name: 'Retiro atualizado',
      arrecadationGoal: rawTrip.maxPeople * rawTrip.price,
      hotelsJson: rawTrip.hotelsJson,
      travelersJson: rawTrip.travelersJson,
    })
  })
})
