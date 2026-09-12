import { maskCpf, stripCpf } from '../../../shared/validation/cpf'
import type { SystemUser } from '../model/userTypes'

export function filterUsers(users: SystemUser[], query: string) {
  const normalized = query.trim().toLocaleLowerCase('pt-BR')
  if (!normalized) return users
  const digits = stripCpf(query)

  return users.filter(
    (user) =>
      user.name.toLocaleLowerCase('pt-BR').includes(normalized) ||
      (digits.length > 0 && user.cpf.includes(digits)) ||
      maskCpf(user.cpf).includes(normalized),
  )
}
