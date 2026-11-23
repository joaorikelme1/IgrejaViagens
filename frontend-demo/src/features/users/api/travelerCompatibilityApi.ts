import { updateDemoState } from '../../../demo/demoStore'
import { stripCpf } from '../../../shared/validation/cpf'
import type { UserMutation } from '../model/userTypes'
import { createUser, deleteUser } from './usersApi'

export async function addExistingUserToTrip(cpfValue: string, tripId: string) {
  const cpf = stripCpf(cpfValue)
  updateDemoState((state) => {
    if (!state.users.some((user) => user.cpf === cpf)) throw new Error('Viajante não encontrado.')
    const trip = state.trips.find((item) => item.id === tripId)
    if (!trip) throw new Error('Viagem não encontrada.')
    if (!trip.travelerCpfs.includes(cpf)) trip.travelerCpfs.push(cpf)
    trip.travelersJson = JSON.stringify(trip.travelerCpfs)
  })
}

export async function createTravelerForTrip(cpfValue: string, mutation: UserMutation, tripId: string) {
  const created = await createUser(stripCpf(cpfValue), { ...mutation, role: 'traveler', firstLogin: true })
  await addExistingUserToTrip(created.cpf, tripId)
  return created
}

export async function removeTravelerFromTrip(cpfValue: string, tripId: string) {
  const cpf = stripCpf(cpfValue)
  updateDemoState((state) => {
    const trip = state.trips.find((item) => item.id === tripId)
    if (!trip) throw new Error('Viagem não encontrada.')
    trip.travelerCpfs = trip.travelerCpfs.filter((item) => item !== cpf)
    trip.travelersJson = JSON.stringify(trip.travelerCpfs)
    state.rooms.forEach((room) => { if (room.tripId === tripId) room.occupants = room.occupants.filter((item) => item !== cpf) })
    state.seats = state.seats.filter((seat) => seat.tripId !== tripId || seat.userCpf !== cpf)
  })
}

export async function deleteUserGlobally(cpfValue: string) { await deleteUser(stripCpf(cpfValue)) }
