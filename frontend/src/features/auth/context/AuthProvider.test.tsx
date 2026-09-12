import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { httpRequest } from '../../../lib/http'
import {
  readActiveTripId,
  writeActiveTripId,
} from '../../trips/storage/activeTripStorage'
import { useAuth } from '../hooks/useAuth'
import type { AuthUser } from '../model/authTypes'
import { AuthProvider } from './AuthProvider'

const authenticatedUser: AuthUser = {
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

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function AuthProbe() {
  const { user } = useAuth()

  return (
    <div>
      <span>{user ? `Autenticado: ${user.name}` : 'Deslogado'}</span>
      <button
        onClick={() => {
          void httpRequest('/trips').catch(() => undefined)
        }}
        type="button"
      >
        Carregar recurso protegido
      </button>
    </div>
  )
}

describe('AuthProvider', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    sessionStorage.clear()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('consulta /auth/me, mantém loading e carrega a sessão autenticada', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(authenticatedUser))

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    )

    expect(screen.getByRole('status')).toHaveTextContent('Verificando sessão')
    expect(
      await screen.findByText('Autenticado: Ana Administradora'),
    ).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      '/auth/me',
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  it('considera o usuário deslogado quando /auth/me retorna 401', async () => {
    writeActiveTripId('trip-anterior')
    sessionStorage.setItem(
      'igreja-viagens:auth-session',
      JSON.stringify(authenticatedUser),
    )
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }))

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    )

    expect(await screen.findByText('Deslogado')).toBeInTheDocument()
    expect(readActiveTripId()).toBeNull()
    expect(sessionStorage.getItem('igreja-viagens:auth-session')).toBeNull()
  })

  it('limpa autenticação e viagem ativa após 401 de recurso protegido', async () => {
    writeActiveTripId('trip-ativa')
    fetchMock
      .mockResolvedValueOnce(jsonResponse(authenticatedUser))
      .mockResolvedValueOnce(new Response(null, { status: 401 }))

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    )

    expect(
      await screen.findByText('Autenticado: Ana Administradora'),
    ).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', { name: 'Carregar recurso protegido' }),
    )

    await waitFor(() => expect(screen.getByText('Deslogado')).toBeInTheDocument())
    expect(readActiveTripId()).toBeNull()
  })
})
