import { DEMO_SESSION_KEY, readDemoState, updateDemoState } from '../../../demo/demoStore'
import { stripCpf } from '../../../shared/validation/cpf'
import type { AuthUser, LoginCredentials } from '../model/authTypes'

function toAuthUser(cpf: string): AuthUser {
  const user = readDemoState().users.find((item) => item.cpf === cpf)
  if (!user) throw new Error('Usuário não encontrado.')
  return { ...user }
}

export async function saveProfilePhoto(cpf: string, profilePhoto: string) {
  updateDemoState((state) => {
    const user = state.users.find((item) => item.cpf === stripCpf(cpf))
    if (user) Object.assign(user, { profilePhoto })
  })
  return profilePhoto
}

export async function getCurrentUser() {
  const cpf = sessionStorage.getItem(DEMO_SESSION_KEY)
  if (!cpf) throw new Error('Sessão não encontrada.')
  return toAuthUser(cpf)
}

export async function login(credentials: LoginCredentials) {
  const cpf = stripCpf(credentials.cpf)
  const state = readDemoState()
  if (!state.users.some((user) => user.cpf === cpf) || state.passwords[cpf] !== credentials.password) throw new Error('CPF ou senha inválidos.')
  sessionStorage.setItem(DEMO_SESSION_KEY, cpf)
  return toAuthUser(cpf)
}

export async function logout() { sessionStorage.removeItem(DEMO_SESSION_KEY) }

export async function completeFirstAccess(user: AuthUser, newPassword: string) {
  if (newPassword.length < 8) throw new Error('A nova senha deve ter ao menos 8 caracteres.')
  updateDemoState((state) => {
    state.passwords[user.cpf] = newPassword
    const saved = state.users.find((item) => item.cpf === user.cpf)
    if (saved) saved.firstLogin = false
  })
  return toAuthUser(user.cpf)
}
