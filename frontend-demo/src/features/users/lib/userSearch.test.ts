import { describe, expect, it } from 'vitest'
import type { SystemUser } from '../model/userTypes'
import { filterUsers } from './userSearch'

const users: SystemUser[] = [
  {
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
  },
]

describe('filterUsers', () => {
  it.each(['111.444.777-35', '11144477735', 'Tiago'])(
    'busca por nome ou CPF usando %s',
    (query) => {
      expect(filterUsers(users, query)).toEqual(users)
    },
  )
})
