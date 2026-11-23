import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '../model/authTypes'
import { ProfileAvatar } from './ProfileAvatar'
import { ProfilePhotoModal } from './ProfilePhotoModal'

const mocks = vi.hoisted(() => ({
  preparePhoto: vi.fn(),
  savePhoto: vi.fn(),
}))

vi.mock('../api/authApi', () => ({ saveProfilePhoto: mocks.savePhoto }))
vi.mock('../utils/profilePhoto', async (importOriginal) => {
  const original = await importOriginal<typeof import('../utils/profilePhoto')>()
  return { ...original, prepareProfilePhoto: mocks.preparePhoto }
})

const photo = 'data:image/png;base64,YWJj'
const user: AuthUser = {
  birthdate: '',
  cpf: '52998224725',
  firstLogin: false,
  hasKids: false,
  kids: [],
  married: false,
  name: 'Maria Silva',
  profilePhoto: photo,
  role: 'traveler',
  spouseName: '',
}

describe('foto de perfil', () => {
  beforeEach(() => {
    mocks.preparePhoto.mockReset()
    mocks.savePhoto.mockReset()
    mocks.savePhoto.mockImplementation((_cpf: string, value: string) => Promise.resolve(value))
  })

  afterEach(cleanup)

  it('exibe a foto e volta para a inicial se a imagem falhar', async () => {
    const onClick = vi.fn()
    const { container } = render(
      <ProfileAvatar className="topbar-avatar" name={user.name} onClick={onClick} profilePhoto={photo} />,
    )

    const image = container.querySelector('img')
    expect(image).not.toBeNull()
    fireEvent.error(image as HTMLImageElement)
    expect(screen.getByText('M')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Alterar foto de perfil' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('permite remover e persistir a foto atual', async () => {
    const onClose = vi.fn()
    const onSaved = vi.fn()
    render(<ProfilePhotoModal onClose={onClose} onSaved={onSaved} user={user} />)

    await userEvent.click(screen.getByRole('button', { name: 'Remover foto' }))
    await userEvent.click(screen.getByRole('button', { name: 'Salvar foto' }))

    expect(mocks.savePhoto).toHaveBeenCalledWith(user.cpf, '')
    expect(onSaved).toHaveBeenCalledWith('')
    expect(onClose).toHaveBeenCalledOnce()
  })
})
