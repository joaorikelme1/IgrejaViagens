import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../App'
import { AppProviders } from '../providers'
import type { AuthUser } from '../../features/auth/model/authTypes'
import {
  readActiveTripId,
  writeActiveTripId,
} from '../../features/trips/storage/activeTripStorage'

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

const traveler: AuthUser = {
  ...admin,
  cpf: '11144477735',
  name: 'Tiago Viajante',
  role: 'traveler',
}

const trip = {
  id: 'trip-1',
  name: 'Retiro 2027',
  destination: 'Goiânia',
  date: '2027-01-20',
  travelersJson: JSON.stringify([traveler.cpf]),
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
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

let authenticatedSessionUser: AuthUser | null = null

function renderRoute(path: string, authenticatedUser?: AuthUser) {
  authenticatedSessionUser = authenticatedUser ?? null

  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppProviders>
        <App />
      </AppProviders>
    </MemoryRouter>,
  )
}

describe('rotas e layout protegido', () => {
  const fetchMock = vi.fn<typeof fetch>()
  let resourceHandler: (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => Promise<Response>

  beforeEach(() => {
    sessionStorage.clear()
    authenticatedSessionUser = null
    fetchMock.mockReset()
    resourceHandler = () => Promise.resolve(jsonResponse([]))
    fetchMock.mockImplementation((input, init) => {
      const path = requestPath(input)
      if (path === '/auth/me') {
        return Promise.resolve(
          authenticatedSessionUser
            ? jsonResponse(authenticatedSessionUser)
            : new Response(null, { status: 401 }),
        )
      }
      if (path === '/auth/csrf') {
        return Promise.resolve(jsonResponse({
          headerName: 'X-XSRF-TOKEN',
          token: 'csrf-test-token',
        }))
      }
      if (path === '/auth/logout') {
        authenticatedSessionUser = null
        return Promise.resolve(new Response(null, { status: 204 }))
      }
      return resourceHandler(input, init)
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('redireciona usuário sem sessão de rota protegida para o login', async () => {
    renderRoute('/admin')

    expect(
      await screen.findByRole('heading', { name: 'Bem-vindo(a)' }),
    ).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('/auth/me')
  })

  it('permite que admin acesse rota administrativa', async () => {
    writeActiveTripId(trip.id)
    resourceHandler = (input) =>
      Promise.resolve(
        requestPath(input) === '/trips' ? jsonResponse([trip]) : jsonResponse([]),
      )
    renderRoute('/admin/viajantes', admin)

    expect(
      await screen.findByRole('heading', { name: 'Viajantes de Retiro 2027' }),
    ).toBeInTheDocument()
  })

  it('impede viajante de acessar rota administrativa', async () => {
    writeActiveTripId(trip.id)
    resourceHandler = (input) =>
      Promise.resolve(
        requestPath(input) === '/trips' ? jsonResponse([trip]) : jsonResponse([]),
      )
    renderRoute('/admin', traveler)

    expect(
      await screen.findByRole('heading', { name: 'Olá, Tiago' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('Total de viajantes'),
    ).not.toBeInTheDocument()
  })

  it('exibe menus diferentes para admin e viajante', async () => {
    const adminView = renderRoute('/admin/cadastros', admin)
    const adminSidebar = await screen.findByRole('complementary', {
      name: 'Navegação principal',
    })

    expect(within(adminSidebar).getByText('Viajantes')).toBeInTheDocument()
    expect(within(adminSidebar).getByText('Cadastro Global')).toBeInTheDocument()
    expect(within(adminSidebar).queryByText('Início')).not.toBeInTheDocument()

    adminView.unmount()
    renderRoute('/viajante', traveler)
    const travelerSidebar = await screen.findByRole('complementary', {
      name: 'Navegação principal',
    })

    expect(within(travelerSidebar).getByText('Início')).toBeInTheDocument()
    expect(within(travelerSidebar).getByText('Pagamento')).toBeInTheDocument()
    expect(
      within(travelerSidebar).queryByText('Cadastro Global'),
    ).not.toBeInTheDocument()
  })

  it('encerra a sessão e limpa a viagem ativa no logout', async () => {
    writeActiveTripId(trip.id)
    renderRoute('/admin/cadastros', admin)

    await userEvent.click(
      await screen.findByRole('button', { name: 'Sair' }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Bem-vindo(a)' }),
    ).toBeInTheDocument()
    expect(readActiveTripId()).toBeNull()
    const logoutRequest = fetchMock.mock.calls.find(
      ([input]) => requestPath(input) === '/auth/logout',
    )
    expect(logoutRequest?.[1]).toEqual(
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    )
  })

  it('seleciona uma viagem e atualiza o contexto do layout', async () => {
    resourceHandler = (input) =>
      Promise.resolve(
        requestPath(input) === '/trips' ? jsonResponse([trip]) : jsonResponse([]),
      )
    renderRoute('/admin', admin)

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', { name: `Selecionar viagem ${trip.name}` }),
    )

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(
      await screen.findByRole('heading', { name: trip.name }),
    ).toBeInTheDocument()
    expect(readActiveTripId()).toBe(trip.id)
  })

  it('exige viagem em Configurações e permanece na rota após selecionar', async () => {
    resourceHandler = (input) =>
      Promise.resolve(
        requestPath(input) === '/trips' ? jsonResponse([trip]) : jsonResponse([]),
      )
    renderRoute('/admin/configuracoes', admin)

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', { name: `Selecionar viagem ${trip.name}` }),
    )

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(
      screen.getByRole('button', { name: 'Salvar configurações' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: trip.name }),
    ).toBeInTheDocument()
    expect(readActiveTripId()).toBe(trip.id)
  })

  it('restaura a viagem ativa persistida', async () => {
    writeActiveTripId(trip.id)
    resourceHandler = (input) =>
      Promise.resolve(
        requestPath(input) === '/trips' ? jsonResponse([trip]) : jsonResponse([]),
      )
    renderRoute('/admin', admin)

    expect(
      await screen.findByRole('heading', { name: trip.name }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('filtra viagens do viajante usando travelersJson', async () => {
    const otherTrip = {
      ...trip,
      id: 'trip-2',
      name: 'Viagem de outro grupo',
      travelersJson: JSON.stringify([admin.cpf]),
    }
    resourceHandler = (input) =>
      Promise.resolve(
        requestPath(input) === '/trips'
          ? jsonResponse([trip, otherTrip])
          : jsonResponse([]),
      )
    renderRoute('/viajante', traveler)

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: `Selecionar viagem ${trip.name}` }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', {
        name: `Selecionar viagem ${otherTrip.name}`,
      }),
    ).not.toBeInTheDocument()
  })

  it('renderiza página 404 para rota inexistente', async () => {
    renderRoute('/endereco-inexistente')

    expect(
      await screen.findByRole('heading', { name: 'Página não encontrada' }),
    ).toBeInTheDocument()
    expect(screen.getByText('404')).toBeInTheDocument()
  })

  it('abre e fecha a sidebar pelo controle mobile', async () => {
    renderRoute('/admin/cadastros', admin)
    const sidebar = await screen.findByRole('complementary', {
      name: 'Navegação principal',
    })
    const menuButton = screen.getByLabelText('Abrir menu')

    expect(menuButton).toHaveAttribute('aria-expanded', 'false')
    expect(sidebar).not.toHaveClass('is-open')

    fireEvent.click(menuButton)
    expect(menuButton).toHaveAttribute('aria-expanded', 'true')
    expect(sidebar).toHaveClass('is-open')

    fireEvent.click(screen.getByLabelText('Fechar menu'))
    expect(menuButton).toHaveAttribute('aria-expanded', 'false')
    expect(sidebar).not.toHaveClass('is-open')
  })
})
