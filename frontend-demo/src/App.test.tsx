import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { App } from './App'
import { AppProviders } from './app/providers'

describe('App', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(new Response(null, { status: 401 })),
      ),
    )
  })

  afterEach(() => vi.unstubAllGlobals())

  it('renderiza o login quando o backend não possui sessão', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppProviders>
          <App />
        </AppProviders>
      </MemoryRouter>,
    )

    expect(screen.getByRole('status')).toHaveTextContent('Verificando sessão')
    expect(
      await screen.findByRole('heading', { name: 'Bem-vindo(a)' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument()
  })
})
