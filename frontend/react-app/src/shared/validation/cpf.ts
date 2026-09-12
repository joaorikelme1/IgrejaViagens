export function stripCpf(value: string) {
  return value.replace(/\D/g, '').slice(0, 11)
}

export function maskCpf(value: string) {
  const digits = stripCpf(value)

  if (digits.length > 9) {
    return digits.replace(
      /(\d{3})(\d{3})(\d{3})(\d{0,2})/,
      '$1.$2.$3-$4',
    )
  }

  if (digits.length > 6) {
    return digits.replace(/(\d{3})(\d{3})(\d{0,3})/, '$1.$2.$3')
  }

  if (digits.length > 3) {
    return digits.replace(/(\d{3})(\d{0,3})/, '$1.$2')
  }

  return digits
}

export function isValidCpf(value: string) {
  const cpf = stripCpf(value)

  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false

  let sum = 0
  for (let index = 0; index < 9; index += 1) {
    sum += Number(cpf[index]) * (10 - index)
  }

  let remainder = (sum * 10) % 11
  if (remainder === 10) remainder = 0
  if (remainder !== Number(cpf[9])) return false

  sum = 0
  for (let index = 0; index < 10; index += 1) {
    sum += Number(cpf[index]) * (11 - index)
  }

  remainder = (sum * 10) % 11
  if (remainder === 10) remainder = 0

  return remainder === Number(cpf[10])
}
