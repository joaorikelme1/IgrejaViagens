import { readDemoState, updateDemoState } from '../../../demo/demoStore'
import { stripCpf } from '../../../shared/validation/cpf'
import type { UserRole } from '../../auth/model/authTypes'
import type { SystemUser, UserMutation } from '../model/userTypes'

const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const role = (value: unknown): UserRole => value === 'admin' ? 'admin' : 'traveler'

export function toSystemUser(value: unknown): SystemUser | null {
  if (!value || typeof value !== 'object') return null
  const user = value as Partial<SystemUser>
  const cpf = stripCpf(user.cpf ?? '')
  if (!cpf) return null
  return { cpf, name: user.name || 'Usuário sem nome', role: role(user.role), birthdate: user.birthdate || '', firstLogin: user.firstLogin === true, married: user.married === true, spouseName: user.spouseName || '', spouseCpf: stripCpf(user.spouseCpf || ''), hasKids: user.hasKids === true, kids: user.kids || [], childCpfs: (user.childCpfs || []).map(stripCpf) }
}

export async function listUsers() { return copy(readDemoState().users).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')) }

function fromMutation(cpf: string, mutation: UserMutation): SystemUser {
  return { cpf, name: mutation.name.trim(), role: mutation.role, birthdate: mutation.birthdate || '', firstLogin: mutation.firstLogin, married: mutation.married, spouseName: mutation.married ? mutation.spouseName.trim() : '', spouseCpf: mutation.married ? stripCpf(mutation.spouseCpf) : '', hasKids: mutation.hasKids, kids: mutation.hasKids ? mutation.kids.map((name) => name.trim()).filter(Boolean) : [], childCpfs: mutation.hasKids ? mutation.childCpfs.map(stripCpf).filter(Boolean) : [] }
}

export async function createUser(cpfValue: string, mutation: UserMutation) {
  const cpf = stripCpf(cpfValue)
  if (!/^\d{11}$/.test(cpf)) throw new Error('Informe um CPF válido.')
  if (!mutation.initialPassword || mutation.initialPassword.length < 8) throw new Error('A senha inicial deve ter ao menos 8 caracteres.')
  const user = fromMutation(cpf, mutation)
  updateDemoState((state) => { if (state.users.some((item) => item.cpf === cpf)) throw new Error('Já existe um usuário com este CPF.'); state.users.push(user); state.passwords[cpf] = mutation.initialPassword! })
  return user
}

export async function updateUser(cpfValue: string, mutation: UserMutation) {
  const cpf = stripCpf(cpfValue)
  const user = fromMutation(cpf, mutation)
  updateDemoState((state) => { const index = state.users.findIndex((item) => item.cpf === cpf); if (index < 0) throw new Error('Usuário não encontrado.'); state.users[index] = user })
  return user
}

export async function deleteUser(cpfValue: string) {
  const cpf = stripCpf(cpfValue)
  updateDemoState((state) => {
    state.users = state.users.filter((user) => user.cpf !== cpf)
    delete state.passwords[cpf]
    state.trips.forEach((trip) => { trip.travelerCpfs = trip.travelerCpfs.filter((item) => item !== cpf); trip.travelersJson = JSON.stringify(trip.travelerCpfs) })
    state.rooms.forEach((room) => { room.occupants = room.occupants.filter((item) => item !== cpf) })
    state.seats = state.seats.filter((seat) => seat.userCpf !== cpf)
    state.payments = state.payments.filter((payment) => payment.userCpf !== cpf)
  })
}
