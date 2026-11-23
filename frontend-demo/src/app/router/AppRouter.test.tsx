import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../../features/auth/context/authContext'
import { AppRouter } from './AppRouter'

vi.mock('./LoginRoute', () => ({ LoginRoute: () => <h1>Login Supabase</h1> }))

const anonymous = { user: null, signIn: vi.fn(), signOut: vi.fn().mockResolvedValue(undefined) }

describe('rotas protegidas', () => {
  it('redireciona visitante sem sessão Supabase para login', async () => {
    render(<AuthContext.Provider value={anonymous}><MemoryRouter initialEntries={['/admin']}><AppRouter /></MemoryRouter></AuthContext.Provider>)
    expect(await screen.findByRole('heading', { name: 'Login Supabase' })).toBeInTheDocument()
  })

  it('mantém página 404 para rota inexistente', async () => {
    render(<AuthContext.Provider value={anonymous}><MemoryRouter initialEntries={['/inexistente']}><AppRouter /></MemoryRouter></AuthContext.Provider>)
    expect(await screen.findByText('Página não encontrada')).toBeInTheDocument()
  })
})
