import { describe, expect, it } from 'vitest'
import { stripCpf } from '../../../shared/validation/cpf'

describe('identidade de viajante para RPCs', () => {
  it('normaliza CPF antes de resolver o perfil no Supabase', () => {
    expect(stripCpf('529.982.247-25')).toBe('52998224725')
  })
})
