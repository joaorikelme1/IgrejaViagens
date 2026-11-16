import { describe, expect, it } from 'vitest'
import { buildTripTravelers } from '../lib/buildTripTravelers'

describe('fonte de viajantes', () => {
  it('mantém somente usuários associados à viagem ativa', () => {
    const source = buildTripTravelers(['52998224725'], { users: [{ cpf: '52998224725', name: 'Ana', role: 'traveler', birthdate: '', firstLogin: false, married: false, spouseName: '', spouseCpf: '', hasKids: false, kids: [], childCpfs: [] }], payments: [], rooms: [], seats: [] })
    expect(source).toHaveLength(1)
    expect(source[0].user.cpf).toBe('52998224725')
  })
})
