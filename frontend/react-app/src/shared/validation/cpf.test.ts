import { describe, expect, it } from 'vitest'
import { isValidCpf, maskCpf, stripCpf } from './cpf'

describe('CPF', () => {
  it('remove caracteres e limita o CPF a onze digitos', () => {
    expect(stripCpf('529.982.247-25 extra 9')).toBe('52998224725')
  })

  it('aplica a mascara progressivamente', () => {
    expect(maskCpf('5299')).toBe('529.9')
    expect(maskCpf('52998224725')).toBe('529.982.247-25')
  })

  it('valida os digitos verificadores e rejeita sequencias repetidas', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true)
    expect(isValidCpf('529.982.247-24')).toBe(false)
    expect(isValidCpf('111.111.111-11')).toBe(false)
  })
})
