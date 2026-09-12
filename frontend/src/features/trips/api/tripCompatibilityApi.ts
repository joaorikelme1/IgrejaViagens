import { httpRequest } from '../../../lib/http'
import type { Trip } from '../model/tripTypes'

/**
 * A exclusão e a limpeza dos recursos dependentes são uma transação única no
 * backend. A lista local só é alterada depois da confirmação HTTP.
 */
export async function deleteTripWithCompatibility(
  trips: Trip[],
  tripId: string,
) {
  await httpRequest<null>(`/trips/${encodeURIComponent(tripId)}`, {
    method: 'DELETE',
  })
  return trips.filter((trip) => trip.id !== tripId)
}
