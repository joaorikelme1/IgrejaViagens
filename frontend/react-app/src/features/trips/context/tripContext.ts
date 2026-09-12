import { createContext } from 'react'
import type { Trip, TripMutation } from '../model/tripTypes'

export interface TripContextValue {
  activeTrip: Trip | null
  activeTripId: string | null
  availableTrips: Trip[]
  errorMessage: string | null
  isLoading: boolean
  isSelectorOpen: boolean
  clearActiveTrip: () => void
  closeSelector: () => void
  createTrip: (mutation: TripMutation) => Promise<Trip>
  deleteTrip: (tripId: string) => Promise<void>
  openSelector: () => void
  reloadTrips: () => void
  selectTrip: (tripId: string) => void
  updateTrip: (tripId: string, mutation: TripMutation) => Promise<Trip>
}

export const TripContext = createContext<TripContextValue | null>(null)
