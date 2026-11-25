import { describe, expect, it } from 'vitest'
import { toSystemUser } from './usersApi'

describe('perfil Supabase para usuário da interface', () => {
  it('normaliza CPF e converte colunas snake_case do perfil', () => {
    expect(toSystemUser({ cpf: '529.982.247-25', name: 'Ana', role: 'admin', birthdate: '1990-01-01', firstLogin: false, married: false, spouseName: '', hasKids: true, kids: ['Lia'], childCpfs: [] })).toMatchObject({ cpf: '52998224725', name: 'Ana', role: 'admin', firstLogin: false, kids: ['Lia'] })
  })

  it('rejeita resposta sem CPF', () => expect(toSystemUser({ name: 'Sem CPF' })).toBeNull())
})
