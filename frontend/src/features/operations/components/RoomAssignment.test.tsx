import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { SystemUser } from '../../users/model/userTypes'
import type { HotelRoomConfig, RoomRecord } from '../model/operationTypes'
import { RoomAssignment } from './RoomAssignment'

const user = (cpf: string, name: string): SystemUser => ({
  birthdate: '',
  childCpfs: [],
  cpf,
  firstLogin: false,
  hasKids: false,
  kids: [],
  married: false,
  name,
  role: 'traveler',
  spouseCpf: '',
  spouseName: '',
})

const room: HotelRoomConfig = {
  capacity: 3,
  id: 'room-1',
  name: 'Quarto 101',
  type: 'Familiar',
}

const roomRecord = (
  id: string,
  occupants: string[],
): RoomRecord => ({
  capacity: 3,
  hotelId: 'hotel-1',
  id,
  name: id === 'room-1' ? 'Quarto 101' : 'Quarto 102',
  occupants,
  tripId: 'trip-1',
  type: 'Familiar',
})

describe('RoomAssignment', () => {
  it('mantém os ocupantes atuais e esconde viajantes já acomodados em outros quartos', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <RoomAssignment
        current={['11144477735']}
        onClose={vi.fn()}
        onSave={onSave}
        room={room}
        rooms={[
          roomRecord('room-1', ['11144477735']),
          roomRecord('room-2', ['52998224725']),
        ]}
        users={[
          user('11144477735', 'Ana'),
          user('52998224725', 'Bruno'),
          user('39053344705', 'Carla'),
        ]}
      />,
    )

    expect(screen.getByText('Ana')).toBeInTheDocument()
    expect(screen.queryByText('Bruno')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox', { name: /Carla/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Salvar ocupantes' }))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(['11144477735', '39053344705'])
    })
  })
})
