import { updateDemoState } from '../../../demo/demoStore'
import type { Trip } from '../model/tripTypes'

export async function deleteTripWithCompatibility(trips: Trip[], tripId: string) {
  updateDemoState((state) => {
    state.trips = state.trips.filter((trip) => trip.id !== tripId)
    state.rooms = state.rooms.filter((room) => room.tripId !== tripId)
    state.seats = state.seats.filter((seat) => seat.tripId !== tripId)
    state.payments = state.payments.filter((payment) => payment.tripId !== tripId)
  })
  return trips.filter((trip) => trip.id !== tripId)
}
