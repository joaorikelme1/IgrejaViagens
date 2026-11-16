import { supabase, unwrap } from '../../../infrastructure/supabase/client'
import type { Trip } from '../model/tripTypes'

export async function deleteTripWithCompatibility(trips: Trip[], tripId: string) {
  unwrap(await supabase.from('trips').delete().eq('id', tripId))
  return trips.filter((trip) => trip.id !== tripId)
}
