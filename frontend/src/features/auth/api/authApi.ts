import { supabase, unwrap } from '../../../infrastructure/supabase/client'
import { cpfEmail } from '../../../infrastructure/supabase/repositories/shared'
import { stripCpf } from '../../../shared/validation/cpf'
import type { AuthUser, LoginCredentials, UserRole } from '../model/authTypes'

type Profile = { id: string; cpf: string; name: string; role: UserRole; birthdate: string | null; first_login: boolean; married: boolean; spouse_name: string; has_kids: boolean; profile_photo_path: string | null }

function toAuthUser(profile: Profile, profilePhoto = ''): AuthUser {
  return { cpf: profile.cpf, name: profile.name, role: profile.role, birthdate: profile.birthdate ?? '', firstLogin: profile.first_login, married: profile.married, spouseName: profile.spouse_name, hasKids: profile.has_kids, kids: [], profilePhoto }
}

async function currentProfile() {
  const session = unwrap<{ user: { id: string } | null }>(await supabase.auth.getUser())
  if (!session.user) throw new Error('Sessão não encontrada.')
  const profile = unwrap<Profile>(await supabase.from('profiles').select('id, cpf, name, role, birthdate, first_login, married, spouse_name, has_kids, profile_photo_path').eq('id', session.user.id).single())
  return profile
}

export async function saveProfilePhoto(_cpf: string, profilePhoto: string) {
  const profile = await currentProfile()
  if (!profilePhoto) { unwrap(await supabase.from('profiles').update({ profile_photo_path: null }).eq('id', profile.id)); return '' }
  const blob = await (await fetch(profilePhoto)).blob()
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(blob.type) || blob.size > 600_000) throw new Error('A foto deve ser JPG, PNG ou WEBP e ter no máximo 600 KB.')
  const path = `${profile.id}/avatar.${blob.type.split('/')[1]}`
  unwrap(await supabase.storage.from('profile-photos').upload(path, blob, { upsert: true, contentType: blob.type }))
  unwrap(await supabase.from('profiles').update({ profile_photo_path: path }).eq('id', profile.id))
  const signed = unwrap<{ signedUrl: string } | null>(await supabase.storage.from('profile-photos').createSignedUrl(path, 60 * 60))
  return signed?.signedUrl ?? ''
}

export async function getCurrentUser() {
  const profile = await currentProfile()
  const signed = profile.profile_photo_path ? unwrap<{ signedUrl: string } | null>(await supabase.storage.from('profile-photos').createSignedUrl(profile.profile_photo_path, 60 * 60)) : null
  return toAuthUser(profile, signed?.signedUrl ?? '')
}

export async function login(credentials: LoginCredentials) {
  const cpf = stripCpf(credentials.cpf)
  if (!/^\d{11}$/.test(cpf)) throw new Error('Informe um CPF válido.')
  unwrap(await supabase.auth.signInWithPassword({ email: cpfEmail(cpf), password: credentials.password }))
  return getCurrentUser()
}

export async function logout() { unwrap(await supabase.auth.signOut()) }

export async function completeFirstAccess(_user: AuthUser, newPassword: string) {
  if (newPassword.length < 8) throw new Error('A nova senha deve ter ao menos 8 caracteres.')
  const profile = await currentProfile()
  unwrap(await supabase.auth.updateUser({ password: newPassword }))
  unwrap(await supabase.from('profiles').update({ first_login: false }).eq('id', profile.id))
  return getCurrentUser()
}
