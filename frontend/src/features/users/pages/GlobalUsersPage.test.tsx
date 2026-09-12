import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SystemUser, UserMutation } from '../model/userTypes'
import { GlobalUsersPage } from './GlobalUsersPage'

const mocks = vi.hoisted(() => ({
  createUser: vi.fn(),
  deleteGlobal: vi.fn(),
  listTrips: vi.fn(),
  listUsers: vi.fn(),
  reloadTrips: vi.fn(),
  updateUser: vi.fn(),
}))

vi.mock('../../trips/api/tripApi', () => ({ listTrips: mocks.listTrips }))
vi.mock('../../trips/hooks/useTrip', () => ({
  useTrip: () => ({ reloadTrips: mocks.reloadTrips }),
}))
vi.mock('../api/travelerCompatibilityApi', () => ({
  deleteUserGlobally: mocks.deleteGlobal,
}))
vi.mock('../api/usersApi', () => ({
  createUser: mocks.createUser,
  listUsers: mocks.listUsers,
  updateUser: mocks.updateUser,
}))

const user: SystemUser = {
  birthdate: '',
  childCpfs: [],
  cpf: '11144477735',
  firstLogin: true,
  hasKids: false,
  kids: [],
  married: false,
  name: 'Tiago Viajante',
  role: 'traveler',
  spouseName: '',
  spouseCpf: '',
}

describe('GlobalUsersPage', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
    mocks.listUsers.mockResolvedValue([user])
    mocks.listTrips.mockResolvedValue([
      {
        id: 'trip-1',
        name: 'Retiro',
        travelerCpfs: [user.cpf],
        travelersJson: '["11144477735"]',
      },
    ])
    mocks.deleteGlobal.mockResolvedValue(undefined)
    mocks.createUser.mockImplementation((cpf: string, mutation: UserMutation) =>
      Promise.resolve({ ...user, ...mutation, cpf }),
    )
    mocks.updateUser.mockImplementation((cpf: string, mutation: UserMutation) =>
      Promise.resolve({ ...user, ...mutation, cpf }),
    )
  })

  afterEach(() => cleanup())

  it('cadastra usuário com POST granular encapsulado pela API', async () => {
    render(<GlobalUsersPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Novo usuário' }))
    await userEvent.type(screen.getByLabelText('Nome completo *'), 'Carla Souza')
    await userEvent.type(screen.getByLabelText('CPF *'), '93541134780')
    await userEvent.type(screen.getByLabelText('Senha inicial *'), 'senha-temporaria')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar usuário' }))

    await waitFor(() => expect(mocks.createUser).toHaveBeenCalled())
    expect(mocks.createUser).toHaveBeenCalledWith(
      '93541134780',
      expect.objectContaining({ initialPassword: 'senha-temporaria' }),
    )
    expect(await screen.findByText('Usuário cadastrado com sucesso.')).toBeInTheDocument()
  })

  it('edita o usuário preservando o CPF', async () => {
    render(<GlobalUsersPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Editar' }))
    const name = screen.getByLabelText('Nome completo *')
    await userEvent.clear(name)
    await userEvent.type(name, 'Tiago Atualizado')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar usuário' }))

    await waitFor(() =>
      expect(mocks.updateUser).toHaveBeenCalledWith(
        user.cpf,
        expect.objectContaining({ name: 'Tiago Atualizado' }),
      ),
    )
  })

  it('diferencia e confirma a exclusão global', async () => {
    render(<GlobalUsersPage />)
    await userEvent.click(
      await screen.findByRole('button', { name: 'Excluir globalmente' }),
    )

    expect(screen.getByRole('dialog')).toHaveTextContent(
      'todas as viagens, pagamentos, assentos e quartos',
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Excluir usuário globalmente' }),
    )

    await waitFor(() => expect(mocks.deleteGlobal).toHaveBeenCalledWith(user.cpf))
    expect(await screen.findByText('Usuário excluído globalmente.')).toBeInTheDocument()
  })
})
