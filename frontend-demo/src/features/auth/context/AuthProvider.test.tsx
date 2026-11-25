import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useAuth } from '../hooks/useAuth'
import { AuthProvider } from './AuthProvider'

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), logout: vi.fn() }))

vi.mock('../api/authApi', () => mocks)

function Probe() {
  const { user } = useAuth()
  return <span>{user?.name ?? 'Deslogado'}</span>
}

describe('AuthProvider da demonstração', () => {
  it('carrega o usuário salvo na sessão isolada da demo', async () => {
    mocks.getCurrentUser.mockResolvedValue({
      cpf: '52998224725', name: 'Ana Administradora', role: 'admin', birthdate: '',
      firstLogin: false, married: false, spouseName: '', hasKids: false, kids: [], profilePhoto: '',
    })
    render(<AuthProvider><Probe /></AuthProvider>)
    expect(await screen.findByText('Ana Administradora')).toBeInTheDocument()
  })
})
