import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '../model/authTypes'
import { LoginPage } from './LoginPage'

const login = vi.hoisted(() => vi.fn())
vi.mock('../api/authApi', () => ({ login }))

const user: AuthUser = { cpf: '52998224725', name: 'Ana', role: 'admin', birthdate: '', firstLogin: false, married: false, spouseName: '', hasKids: false, kids: [] }

describe('LoginPage com Supabase Auth', () => {
  it('envia CPF normalizado à autenticação', async () => {
    login.mockResolvedValue(user)
    const onAuthenticated = vi.fn()
    render(<LoginPage onAuthenticated={onAuthenticated} />)
    await userEvent.type(screen.getByLabelText('CPF'), '529.982.247-25')
    await userEvent.type(screen.getByLabelText('Senha'), 'senha-segura')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(login).toHaveBeenCalledWith({ cpf: '52998224725', password: 'senha-segura' })
    expect(onAuthenticated).toHaveBeenCalledWith(user)
  })

  it('mostra a falha devolvida pela autenticação', async () => {
    login.mockRejectedValue(new Error('Invalid login credentials'))
    render(<LoginPage onAuthenticated={vi.fn()} />)
    await userEvent.type(screen.getByLabelText('CPF'), '529.982.247-25')
    await userEvent.type(screen.getByLabelText('Senha'), 'senha-segura')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível entrar')
  })
})
