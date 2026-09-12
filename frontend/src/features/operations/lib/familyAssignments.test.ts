import { describe, expect, it } from 'vitest'
import type { SystemUser } from '../../users/model/userTypes'
import {
  assignFamiliesToRooms,
  assignFamiliesToSeats,
  buildFamilyGroups,
} from './familyAssignments'

function user(
  cpf: string,
  name: string,
  family: Partial<Pick<SystemUser, 'childCpfs' | 'kids' | 'married' | 'spouseCpf' | 'spouseName'>> = {},
): SystemUser {
  return {
    birthdate: '',
    childCpfs: [],
    cpf,
    firstLogin: false,
    hasKids: Boolean(family.childCpfs?.length || family.kids?.length),
    kids: [],
    married: false,
    name,
    role: 'traveler',
    spouseCpf: '',
    spouseName: '',
    ...family,
  }
}

const father = user('11144477735', 'Bruno Lima', {
  childCpfs: ['52998224725'],
  married: true,
  spouseCpf: '12345678909',
  spouseName: 'Ana Lima',
})
const mother = user('12345678909', 'Ana Lima', {
  married: true,
  spouseCpf: '11144477735',
  spouseName: 'Bruno Lima',
})
const child = user('52998224725', 'Lia Lima')
const travelers = [father.cpf, mother.cpf, child.cpf]

describe('familyAssignments', () => {
  it('forma um único grupo por vínculos de cônjuge e filhos', () => {
    expect(buildFamilyGroups([father, mother, child], travelers)).toEqual([travelers])
  })

  it('reconhece um vínculo legado somente quando o nome é único', () => {
    const legacy = user('98765432100', 'Carlos Souza', {
      married: true,
      spouseName: 'Maria Souza',
    })
    const maria = user('98765432101', 'Maria Souza')
    expect(buildFamilyGroups([legacy, maria], [legacy.cpf, maria.cpf])).toEqual([
      [legacy.cpf, maria.cpf],
    ])
  })

  it('acomoda a família inteira no mesmo quarto quando há capacidade', () => {
    const result = assignFamiliesToRooms(
      [{ id: 'hotel-1', name: 'Hotel', rooms: [{ id: 'room-1', name: 'Família', type: 'family', capacity: 3 }] }],
      [],
      [father, mother, child],
      travelers,
      'trip-1',
    )
    expect(result.assignedCount).toBe(3)
    expect(result.records[0].occupants).toEqual(travelers)
    expect(result.warnings).toEqual([])
  })

  it('preserva assentos existentes e coloca os demais familiares próximos', () => {
    const result = assignFamiliesToSeats(
      [{ id: 'bus-1', floors: 1, seatsFloor1: 8, seatsFloor2: 0, seats: 8 }],
      [{ id: 'manual', tripId: 'trip-1', busId: 'bus-1', floor: 1, seatNumber: 4, userCpf: father.cpf }],
      [father, mother, child],
      travelers,
      'trip-1',
    )
    expect(result.assignedCount).toBe(2)
    expect(result.records).toContainEqual(expect.objectContaining({ id: 'manual', userCpf: father.cpf }))
    const automaticNumbers = result.records
      .filter((seat) => seat.id !== 'manual')
      .map((seat) => seat.seatNumber)
      .sort()
    expect(automaticNumbers).toEqual([3, 5])
  })
})
