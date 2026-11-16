import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useAuth } from '../hooks/useAuth'
import { AuthProvider } from './AuthProvider'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  onAuthStateChange: vi.fn(),
  from: vi.fn(),
}))

vi.mock('../../../infrastructure/supabase/client', () => ({
  supabase: {
    auth: { getUser: mocks.getUser, onAuthStateChange: mocks.onAuthStateChange },
    from: mocks.from,
  },
  unwrap: <T,>(result: { data?: T; error: { message: string } | null }) => {
    if (result.error) throw new Error(result.error.message)
    return result.data as T
  },
}))

function profileQuery() {
  const response = Promise.resolve({
    data: { id: '00000000-0000-4000-8000-000000000001', cpf: '52998224725', name: 'Ana Administradora', role: 'admin', birthdate: null, first_login: false, married: false, spouse_name: '', has_kids: false, profile_photo_path: null },
    error: null,
  })
  const query = { select: () => query, eq: () => query, single: () => query, then: response.then.bind(response) }
  return query
}

function Probe() {
  const { user } = useAuth()
  return <span>{user?.name ?? 'Deslogado'}</span>
}

describe('AuthProvider com Supabase', () => {
  it('carrega o perfil associado à sessão Supabase', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: '00000000-0000-4000-8000-000000000001' } }, error: null })
    mocks.from.mockReturnValue(profileQuery())
    mocks.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
    render(<AuthProvider><Probe /></AuthProvider>)
    expect(await screen.findByText('Ana Administradora')).toBeInTheDocument()
  })
})
