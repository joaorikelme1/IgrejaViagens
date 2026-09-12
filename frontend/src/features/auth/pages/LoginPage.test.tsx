import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '../model/authTypes'
import { LoginPage } from './LoginPage'

const apiUser = {
  cpf: '52998224725',
  name: 'Maria Teste',
  password: 'senha-retornada-pelo-backend',
  role: 'traveler',
  birthdate: '1990-05-12',
  firstLogin: false,
  married: false,
  spouseName: '',
  hasKids: false,
  kids: [],
}

const csrfPayload = {
  headerName: 'X-XSRF-TOKEN',
  token: 'csrf-test-token',
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function parseRequestBody(options: RequestInit | undefined) {
  if (typeof options?.body !== 'string') {
    throw new Error('A requisicao deveria possuir um corpo JSON textual.')
  }

  return JSON.parse(options.body) as unknown
}

async function fillCredentials(password = 'senha-atual') {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('CPF'), '52998224725')
  await user.type(screen.getByLabelText('Senha'), password)
  return user
}

describe('LoginPage', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('autentica com CPF sem mascara e descarta a senha da resposta', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(csrfPayload))
      .mockResolvedValueOnce(jsonResponse(apiUser))
      .mockResolvedValueOnce(jsonResponse(apiUser))
    const onAuthenticated = vi.fn<(user: AuthUser) => void>()
    render(<LoginPage onAuthenticated={onAuthenticated} />)

    const user = await fillCredentials()
    expect(screen.getByLabelText('CPF')).toHaveValue('529.982.247-25')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledOnce())

    expect(fetchMock.mock.calls[0][0]).toBe('/auth/csrf')
    const [requestUrl, requestOptions] = fetchMock.mock.calls[1]
    expect(requestUrl).toBe('/auth/login')
    expect(requestOptions).toEqual(
      expect.objectContaining({ method: 'POST' }),
    )
    expect(parseRequestBody(requestOptions)).toEqual({
      cpf: '52998224725',
      password: 'senha-atual',
    })
    expect(requestOptions).toEqual(
      expect.objectContaining({ credentials: 'include' }),
    )
    expect((requestOptions?.headers as Headers).get('X-XSRF-TOKEN')).toBe(
      'csrf-test-token',
    )
    expect(fetchMock.mock.calls[2][0]).toBe('/auth/me')
    expect(fetchMock.mock.calls[2][1]).toEqual(
      expect.objectContaining({ credentials: 'include' }),
    )

    const authenticatedUser = onAuthenticated.mock.calls[0][0]
    expect(authenticatedUser).not.toHaveProperty('password')
    expect(authenticatedUser.name).toBe('Maria Teste')
  })

  it('apresenta a mensagem correta quando a API responde 401', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(csrfPayload))
      .mockResolvedValueOnce(
        new Response('CPF ou senha incorretos.', {
          status: 401,
          headers: { 'Content-Type': 'text/plain' },
        }),
      )
    const onAuthenticated = vi.fn<(user: AuthUser) => void>()
    render(<LoginPage onAuthenticated={onAuthenticated} />)

    const user = await fillCredentials('senha-incorreta')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'CPF ou senha incorretos.',
    )
    expect(onAuthenticated).not.toHaveBeenCalled()
  })

  it('conclui primeiro acesso com PUT individual e so entao cria a sessao', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(csrfPayload))
      .mockResolvedValueOnce(jsonResponse({ ...apiUser, firstLogin: true }))
      .mockResolvedValueOnce(jsonResponse({ ...apiUser, firstLogin: true }))
      .mockResolvedValueOnce(
        jsonResponse({ ...apiUser, password: 'nova-senha', firstLogin: false }),
      )
      .mockResolvedValueOnce(jsonResponse({ ...apiUser, firstLogin: false }))
    const onAuthenticated = vi.fn<(user: AuthUser) => void>()
    render(<LoginPage onAuthenticated={onAuthenticated} />)

    const user = await fillCredentials('senha-temporaria')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(onAuthenticated).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('Nova senha'), 'nova-senha')
    await user.type(screen.getByLabelText('Confirmar senha'), 'nova-senha')
    await user.click(
      screen.getByRole('button', { name: 'Salvar e entrar' }),
    )

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledOnce())
    expect(fetchMock).toHaveBeenCalledTimes(5)

    const [requestUrl, requestOptions] = fetchMock.mock.calls[3]
    expect(requestUrl).toBe('/users/52998224725')
    expect(requestOptions).toEqual(expect.objectContaining({ method: 'PUT' }))
    expect(parseRequestBody(requestOptions)).toEqual({
      cpf: '52998224725',
      name: 'Maria Teste',
      password: 'nova-senha',
      role: 'traveler',
      birthdate: '1990-05-12',
      firstLogin: false,
      married: false,
      spouseName: '',
      hasKids: false,
      kids: [],
    })
    expect(requestUrl).not.toContain('/bulk')
    expect(fetchMock.mock.calls[4][0]).toBe('/auth/me')

    const authenticatedUser = onAuthenticated.mock.calls[0][0]
    expect(authenticatedUser).not.toHaveProperty('password')
    expect(authenticatedUser.firstLogin).toBe(false)
  })

  it('alterna a visibilidade da senha', async () => {
    const user = userEvent.setup()
    render(<LoginPage onAuthenticated={vi.fn()} />)
    const passwordInput = screen.getByLabelText('Senha')

    expect(passwordInput).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    expect(passwordInput).toHaveAttribute('type', 'text')
    expect(
      screen.getByRole('button', { name: 'Ocultar senha' }),
    ).toBeInTheDocument()
  })
})
