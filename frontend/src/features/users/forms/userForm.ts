import { isValidCpf, stripCpf } from '../../../shared/validation/cpf'
import type { SystemUser, UserMutation } from '../model/userTypes'

export interface UserFormValues extends Omit<UserMutation, 'initialPassword'> {
  cpf: string
  initialPassword: string
}

export function createEmptyUserForm(
  role: UserMutation['role'] = 'traveler',
): UserFormValues {
  return {
    birthdate: '',
    cpf: '',
    firstLogin: true,
    hasKids: false,
    initialPassword: '',
    kids: [],
    married: false,
    name: '',
    role,
    spouseName: '',
  }
}

export function userToForm(user: SystemUser): UserFormValues {
  return {
    birthdate: user.birthdate,
    cpf: user.cpf,
    firstLogin: user.firstLogin,
    hasKids: user.hasKids,
    initialPassword: '',
    kids: [...user.kids],
    married: user.married,
    name: user.name,
    role: user.role,
    spouseName: user.spouseName,
  }
}

export function validateUserForm(values: UserFormValues, isEditing: boolean) {
  if (!values.name.trim()) throw new Error('Informe o nome completo.')
  if (!isEditing && !isValidCpf(values.cpf)) throw new Error('CPF inválido.')
  if (!isEditing && values.initialPassword.length < 8) {
    throw new Error('A senha inicial deve ter ao menos 8 caracteres.')
  }
  if (values.married && !values.spouseName.trim()) {
    throw new Error('Informe o nome do cônjuge.')
  }
  if (
    values.hasKids &&
    (values.kids.length === 0 || values.kids.some((kid) => !kid.trim()))
  ) {
    throw new Error('Preencha o nome de todos os filhos.')
  }
}

export function userFormSubmission(
  values: UserFormValues,
  isEditing: boolean,
) {
  validateUserForm(values, isEditing)
  const cpf = stripCpf(values.cpf)
  const mutation: UserMutation = {
    birthdate: values.birthdate,
    firstLogin: values.firstLogin,
    hasKids: values.hasKids,
    kids: values.hasKids
      ? values.kids.map((kid) => kid.trim()).filter(Boolean)
      : [],
    married: values.married,
    name: values.name.trim(),
    role: values.role,
    spouseName: values.married ? values.spouseName.trim() : '',
    ...(!isEditing ? { initialPassword: values.initialPassword } : {}),
  }
  return { cpf, mutation }
}
