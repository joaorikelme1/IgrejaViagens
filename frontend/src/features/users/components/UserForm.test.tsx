import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UserForm } from './UserForm'

describe('UserForm', () => {
  afterEach(() => cleanup())

  it('envia dados familiares e uma senha inicial definida pelo administrador', async () => {
    const submit = vi.fn().mockResolvedValue(undefined)
    const view = render(
      <UserForm
        onClose={vi.fn()}
        onSubmit={submit}
        title="Novo usuário"
      />,
    )

    expect(view.container.querySelector('input[type="password"]')).not.toBeNull()
    expect(view.container.innerHTML).not.toContain('acess@123')

    await userEvent.type(screen.getByLabelText('Nome completo *'), 'Ana Lima')
    await userEvent.type(screen.getByLabelText('CPF *'), '11144477735')
    await userEvent.type(screen.getByLabelText('Senha inicial *'), 'senha-segura')
    await userEvent.click(screen.getByLabelText('Casado(a)'))
    await userEvent.type(screen.getByLabelText('Nome do cônjuge'), 'Bruno Lima')
    await userEvent.click(screen.getByLabelText('Tem filhos'))
    fireEvent.change(screen.getByLabelText('Quantidade de filhos'), {
      target: { value: '2' },
    })
    await userEvent.type(screen.getByLabelText('Nome do filho 1'), 'Lia')
    await userEvent.type(screen.getByLabelText('Nome do filho 2'), 'Caio')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar usuário' }))

    expect(submit).toHaveBeenCalledWith(
      '11144477735',
      expect.objectContaining({
        married: true,
        spouseName: 'Bruno Lima',
        hasKids: true,
        kids: ['Lia', 'Caio'],
        initialPassword: 'senha-segura',
      }),
    )
  })

  it('mantém o modal aberto e não anuncia sucesso após erro HTTP', async () => {
    const submit = vi.fn().mockRejectedValue(new Error('Falha controlada'))
    render(
      <UserForm
        onClose={vi.fn()}
        onSubmit={submit}
        title="Novo usuário"
      />,
    )

    await userEvent.type(screen.getByLabelText('Nome completo *'), 'Ana Lima')
    await userEvent.type(screen.getByLabelText('CPF *'), '11144477735')
    await userEvent.type(screen.getByLabelText('Senha inicial *'), 'senha-segura')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar usuário' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Falha controlada')
    expect(screen.queryByText(/sucesso/i)).not.toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('envia CPF e nome ao vincular um cônjuge já cadastrado', async () => {
    const submit = vi.fn().mockResolvedValue(undefined)
    render(
      <UserForm
        availableUsers={[{
          birthdate: '',
          childCpfs: [],
          cpf: '12345678909',
          firstLogin: false,
          hasKids: false,
          kids: [],
          married: false,
          name: 'Bruno Lima',
          role: 'traveler',
          spouseCpf: '',
          spouseName: '',
        }]}
        onClose={vi.fn()}
        onSubmit={submit}
        title="Novo usuário"
      />,
    )

    await userEvent.type(screen.getByLabelText('Nome completo *'), 'Ana Lima')
    await userEvent.type(screen.getByLabelText('CPF *'), '11144477735')
    await userEvent.type(screen.getByLabelText('Senha inicial *'), 'senha-segura')
    await userEvent.click(screen.getByLabelText('Casado(a)'))
    await userEvent.selectOptions(
      screen.getByLabelText('Vincular cadastro do cônjuge'),
      '12345678909',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Salvar usuário' }))

    expect(submit).toHaveBeenCalledWith(
      '11144477735',
      expect.objectContaining({
        spouseCpf: '12345678909',
        spouseName: 'Bruno Lima',
      }),
    )
  })
})
