const ACTIVE_TRIP_KEY = 'igreja-viagens:active-trip-id'

export function readActiveTripId() {
  const tripId = sessionStorage.getItem(ACTIVE_TRIP_KEY)
  return tripId?.trim() || null
}

export function writeActiveTripId(tripId: string) {
  sessionStorage.setItem(ACTIVE_TRIP_KEY, tripId)
}

export function clearActiveTripId() {
  sessionStorage.removeItem(ACTIVE_TRIP_KEY)
}
