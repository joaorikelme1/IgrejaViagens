import { httpRequest } from '../../../lib/http'
import { stripCpf } from '../../../shared/validation/cpf'
import type { UserMutation } from '../model/userTypes'
import { deleteUser, toSystemUser } from './usersApi'

function mutationToApi(cpf: string, mutation: UserMutation) {
  return {
    birthdate: mutation.birthdate,
    cpf,
    firstLogin: true,
    hasKids: mutation.hasKids,
    kids: mutation.hasKids
      ? mutation.kids.map((kid) => kid.trim()).filter(Boolean)
      : [],
    married: mutation.married,
    name: mutation.name.trim(),
    password: mutation.initialPassword,
    role: 'traveler',
    spouseName: mutation.married ? mutation.spouseName.trim() : '',
  }
}

export async function addExistingUserToTrip(
  cpfValue: string,
  tripId: string,
) {
  const cpf = stripCpf(cpfValue)
  await httpRequest<unknown>(
    `/trips/${encodeURIComponent(tripId)}/travelers/${encodeURIComponent(cpf)}`,
    { method: 'PUT' },
  )
}

export async function createTravelerForTrip(
  cpfValue: string,
  mutation: UserMutation,
  tripId: string,
) {
  const cpf = stripCpf(cpfValue)
  if (!mutation.initialPassword || mutation.initialPassword.length < 8) {
    throw new Error('A senha inicial deve ter ao menos 8 caracteres.')
  }
  const response = await httpRequest<unknown>(
    `/trips/${encodeURIComponent(tripId)}/travelers`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mutationToApi(cpf, mutation)),
    },
  )
  const created = toSystemUser(response)
  if (!created) throw new Error('Resposta de usuário inválida.')
  return created
}

export async function removeTravelerFromTrip(
  cpfValue: string,
  tripId: string,
) {
  const cpf = stripCpf(cpfValue)
  await httpRequest<unknown>(
    `/trips/${encodeURIComponent(tripId)}/travelers/${encodeURIComponent(cpf)}`,
    { method: 'DELETE' },
  )
}

export async function deleteUserGlobally(cpfValue: string) {
  await deleteUser(stripCpf(cpfValue))
}
