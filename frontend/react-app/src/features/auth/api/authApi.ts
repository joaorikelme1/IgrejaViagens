import { httpRequest, resetHttpSecurityState } from '../../../lib/http'
import { stripCpf } from '../../../shared/validation/cpf'
import type { AuthUser, LoginCredentials, UserRole } from '../model/authTypes'

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Resposta de login inválida.')
  }

  return value as Record<string, unknown>
}

function readString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function readRole(value: unknown): UserRole {
  return typeof value === 'string' && value.toLowerCase() === 'admin'
    ? 'admin'
    : 'traveler'
}

function readKids(value: unknown) {
  return Array.isArray(value)
    ? value.filter((kid): kid is string => typeof kid === 'string')
    : []
}

function toAuthUser(payload: unknown): AuthUser {
  const user = asRecord(payload)
  const responseCpf = stripCpf(readString(user.cpf))

  if (!responseCpf) {
    throw new Error('Resposta de autenticação inválida.')
  }

  return {
    cpf: responseCpf,
    name: readString(user.name, 'Usuário'),
    role: readRole(user.role),
    birthdate: readString(user.birthdate),
    firstLogin: user.firstLogin === true,
    married: user.married === true,
    spouseName: readString(user.spouseName),
    hasKids: user.hasKids === true,
    kids: readKids(user.kids),
  }
}

export async function getCurrentUser() {
  const response = await httpRequest<unknown>('/auth/me')
  return toAuthUser(response)
}

export async function login(credentials: LoginCredentials) {
  const cpf = stripCpf(credentials.cpf)

  await httpRequest<unknown>('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cpf, password: credentials.password }),
    // Um 401 aqui significa credenciais inválidas, não expiração de sessão.
    skipUnauthorizedNotification: true,
  })

  return getCurrentUser()
}

export async function logout() {
  try {
    await httpRequest<null>('/auth/logout', { method: 'POST' })
  } finally {
    resetHttpSecurityState()
  }
}

export async function completeFirstAccess(
  user: AuthUser,
  newPassword: string,
) {
  const cpf = stripCpf(user.cpf)

  await httpRequest<unknown>(`/users/${encodeURIComponent(cpf)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cpf,
      name: user.name,
      password: newPassword,
      role: user.role,
      birthdate: user.birthdate,
      firstLogin: false,
      married: user.married,
      spouseName: user.spouseName,
      hasKids: user.hasKids,
      kids: user.kids,
    }),
  })

  return getCurrentUser()
}
