import { use } from 'react'
import { TripContext } from '../context/tripContext'

export function useTrip() {
  const context = use(TripContext)

  if (!context) {
    throw new Error('useTrip deve ser usado dentro de TripProvider.')
  }

  return context
}
