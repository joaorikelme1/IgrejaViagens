import { supabase, unwrap } from '../../../infrastructure/supabase/client'
import { stripCpf } from '../../../shared/validation/cpf'
import type { UserMutation } from '../model/userTypes'
import { createUser, deleteUser } from './usersApi'

async function profileId(cpf: string) {
  const row = unwrap<{ id: string }>(await supabase.from('profiles').select('id').eq('cpf', cpf).single())
  return row.id
}

export async function addExistingUserToTrip(cpfValue: string, tripId: string) {
  unwrap(await supabase.rpc('add_trip_traveler', { p_trip_id: tripId, p_traveler_id: await profileId(stripCpf(cpfValue)) }))
}

export async function createTravelerForTrip(cpfValue: string, mutation: UserMutation, tripId: string) {
  const created = await createUser(stripCpf(cpfValue), { ...mutation, role: 'traveler', firstLogin: true })
  await addExistingUserToTrip(created.cpf, tripId)
  return created
}

export async function removeTravelerFromTrip(cpfValue: string, tripId: string) {
  unwrap(await supabase.rpc('remove_trip_traveler', { p_trip_id: tripId, p_traveler_id: await profileId(stripCpf(cpfValue)) }))
}

export async function deleteUserGlobally(cpfValue: string) { await deleteUser(stripCpf(cpfValue)) }
