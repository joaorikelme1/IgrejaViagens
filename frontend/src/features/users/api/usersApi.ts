import { supabase, unwrap } from '../../../infrastructure/supabase/client'
import { stripCpf } from '../../../shared/validation/cpf'
import type { UserRole } from '../../auth/model/authTypes'
import type { SystemUser, UserMutation } from '../model/userTypes'

type ProfileRow = { id: string; cpf: string; name: string; role: UserRole; birthdate: string | null; first_login: boolean; married: boolean; spouse_name: string; spouse_id: string | null; has_kids: boolean }

const asString = (value: unknown) => typeof value === 'string' ? value : ''
const role = (value: unknown): UserRole => value === 'admin' ? 'admin' : 'traveler'

export function toSystemUser(value: unknown): SystemUser | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  const cpf = stripCpf(asString(v.cpf))
  if (!cpf) return null
  return { cpf, name: asString(v.name) || 'Usuário sem nome', role: role(v.role), birthdate: asString(v.birthdate), firstLogin: v.first_login === true || v.firstLogin === true, married: v.married === true, spouseName: asString(v.spouse_name) || asString(v.spouseName), spouseCpf: stripCpf(asString(v.spouseCpf)), hasKids: v.has_kids === true || v.hasKids === true, kids: Array.isArray(v.kids) ? v.kids.filter((k): k is string => typeof k === 'string') : [], childCpfs: Array.isArray(v.childCpfs) ? v.childCpfs.filter((c): c is string => typeof c === 'string').map(stripCpf) : [] }
}

async function profileRows() {
  return unwrap<ProfileRow[]>(await supabase.from('profiles').select('id, cpf, name, role, birthdate, first_login, married, spouse_name, spouse_id, has_kids').order('name'))
}

export async function listUsers() {
  const profiles = await profileRows()
  const relationships = unwrap<{ parent_id: string; child_id: string }[]>(await supabase.from('family_relationships').select('parent_id, child_id'))
  const byId = new Map(profiles.map((item) => [item.id, item]))
  return profiles.map((item) => ({ cpf: item.cpf, name: item.name, role: item.role, birthdate: item.birthdate ?? '', firstLogin: item.first_login, married: item.married, spouseName: item.spouse_name, spouseCpf: byId.get(item.spouse_id ?? '')?.cpf ?? '', hasKids: item.has_kids, kids: [], childCpfs: relationships.filter((link) => link.parent_id === item.id).map((link) => byId.get(link.child_id)?.cpf ?? '').filter(Boolean) }))
}

async function idsForCpfs(cpfs: string[]) {
  if (!cpfs.length) return new Map<string, string>()
  const rows = unwrap<{ id: string; cpf: string }[]>(await supabase.from('profiles').select('id, cpf').in('cpf', cpfs))
  return new Map(rows.map((item) => [item.cpf, item.id]))
}

async function syncRelations(profile: ProfileRow, mutation: UserMutation) {
  const cpfs = [stripCpf(mutation.spouseCpf), ...mutation.childCpfs.map(stripCpf)].filter(Boolean)
  const ids = await idsForCpfs(cpfs)
  const spouseId = mutation.married ? ids.get(stripCpf(mutation.spouseCpf)) ?? null : null
  if (mutation.married && mutation.spouseCpf && !spouseId) throw new Error('O cadastro selecionado para cônjuge não existe.')
  unwrap(await supabase.from('profiles').update({ name: mutation.name.trim(), role: mutation.role, birthdate: mutation.birthdate || null, first_login: mutation.firstLogin, married: mutation.married, spouse_name: mutation.married ? mutation.spouseName.trim() : '', spouse_id: spouseId, has_kids: mutation.hasKids }).eq('id', profile.id))
  unwrap(await supabase.from('family_relationships').delete().eq('parent_id', profile.id))
  const children = mutation.hasKids ? mutation.childCpfs.map(stripCpf).map((cpf) => ids.get(cpf)).filter((id): id is string => Boolean(id)).map((child_id) => ({ parent_id: profile.id, child_id })) : []
  if (children.length) unwrap(await supabase.from('family_relationships').insert(children))
}

export async function createUser(cpfValue: string, mutation: UserMutation) {
  const cpf = stripCpf(cpfValue)
  if (!mutation.initialPassword || mutation.initialPassword.length < 8) throw new Error('A senha inicial deve ter ao menos 8 caracteres.')
  unwrap(await supabase.functions.invoke('provision-user', { body: { cpf, password: mutation.initialPassword, name: mutation.name, role: mutation.role, birthdate: mutation.birthdate || null, firstLogin: mutation.firstLogin, married: mutation.married, spouseName: mutation.spouseName, hasKids: mutation.hasKids } }))
  const row = unwrap<ProfileRow>(await supabase.from('profiles').select('id, cpf, name, role, birthdate, first_login, married, spouse_name, spouse_id, has_kids').eq('cpf', cpf).single())
  await syncRelations(row, mutation)
  const created = (await listUsers()).find((user) => user.cpf === cpf)
  if (!created) throw new Error('Usuário não foi criado.')
  return created
}

export async function updateUser(cpfValue: string, mutation: UserMutation) {
  const cpf = stripCpf(cpfValue)
  const row = unwrap<ProfileRow>(await supabase.from('profiles').select('id, cpf, name, role, birthdate, first_login, married, spouse_name, spouse_id, has_kids').eq('cpf', cpf).single())
  await syncRelations(row, mutation)
  const updated = (await listUsers()).find((user) => user.cpf === cpf)
  if (!updated) throw new Error('Usuário não encontrado.')
  return updated
}

export async function deleteUser(cpfValue: string) {
  const cpf = stripCpf(cpfValue)
  const row = unwrap<{ id: string }>(await supabase.from('profiles').select('id').eq('cpf', cpf).single())
  // Deletar a identidade do Auth requer a Edge Function; esta rota não expõe service_role ao navegador.
  unwrap(await supabase.functions.invoke('provision-user', { body: { action: 'delete', userId: row.id } }))
}
