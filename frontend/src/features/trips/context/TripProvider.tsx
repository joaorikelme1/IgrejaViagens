import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import { useAuth } from '../../auth/hooks/useAuth'
import { deleteTripWithCompatibility } from '../api/tripCompatibilityApi'
import {
  createTripRecord,
  listTrips,
  updateTripRecord,
} from '../api/tripApi'
import type { Trip, TripMutation } from '../model/tripTypes'
import {
  clearActiveTripId,
  readActiveTripId,
  writeActiveTripId,
} from '../storage/activeTripStorage'
import { TripContext } from './tripContext'

function getLoadError(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Não foi possível carregar as viagens.'
}

export function TripProvider({ children }: PropsWithChildren) {
  const { user } = useAuth()
  const [trips, setTrips] = useState<Trip[]>([])
  const [activeTripId, setActiveTripId] = useState<string | null>(
    readActiveTripId,
  )
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSelectorOpen, setIsSelectorOpen] = useState(false)

  const reloadTrips = useCallback(() => {
    setIsLoading(true)
    setErrorMessage(null)

    void listTrips()
      .then((loadedTrips) => setTrips(loadedTrips))
      .catch((error: unknown) => {
        setTrips([])
        setErrorMessage(getLoadError(error))
      })
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    let isCurrent = true

    void listTrips()
      .then((loadedTrips) => {
        if (isCurrent) setTrips(loadedTrips)
      })
      .catch((error: unknown) => {
        if (!isCurrent) return
        setTrips([])
        setErrorMessage(getLoadError(error))
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false)
      })

    return () => {
      isCurrent = false
    }
  }, [])

  const availableTrips = useMemo(() => {
    if (!user) return []
    if (user.role === 'admin') return trips

    return trips.filter((trip) => trip.travelerCpfs.includes(user.cpf))
  }, [trips, user])

  const activeTrip = useMemo(
    () => availableTrips.find((trip) => trip.id === activeTripId) ?? null,
    [activeTripId, availableTrips],
  )

  const selectTrip = useCallback(
    (tripId: string) => {
      if (!availableTrips.some((trip) => trip.id === tripId)) return

      writeActiveTripId(tripId)
      setActiveTripId(tripId)
      setIsSelectorOpen(false)
    },
    [availableTrips],
  )

  const clearActiveTrip = useCallback(() => {
    clearActiveTripId()
    setActiveTripId(null)
  }, [])

  const createTrip = useCallback(
    async (mutation: TripMutation) => {
      const id = `trip_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const createdTrip: Trip = {
        id,
        ...mutation,
        hotelsJson: '[]',
        travelersJson: '[]',
        travelerCpfs: [],
      }
      const persistedTrip = await createTripRecord(createdTrip)

      setTrips((current) => [...current, persistedTrip])
      writeActiveTripId(persistedTrip.id)
      setActiveTripId(persistedTrip.id)
      setIsSelectorOpen(false)
      return persistedTrip
    },
    [],
  )

  const updateTrip = useCallback(
    async (tripId: string, mutation: TripMutation) => {
      const currentTrip = trips.find((trip) => trip.id === tripId)
      if (!currentTrip) throw new Error('Viagem não encontrada.')

      const updatedTrip: Trip = {
        ...currentTrip,
        ...mutation,
        // Estes contratos não pertencem ao formulário e nunca são reconstruídos.
        hotelsJson: currentTrip.hotelsJson,
        travelersJson: currentTrip.travelersJson,
        travelerCpfs: currentTrip.travelerCpfs,
      }
      const persistedTrip = await updateTripRecord(updatedTrip)

      setTrips((current) =>
        current.map((trip) => (trip.id === tripId ? persistedTrip : trip)),
      )
      return persistedTrip
    },
    [trips],
  )

  const deleteTrip = useCallback(
    async (tripId: string) => {
      if (!trips.some((trip) => trip.id === tripId)) {
        throw new Error('Viagem não encontrada.')
      }

      const persistedTrips = await deleteTripWithCompatibility(trips, tripId)
      setTrips(persistedTrips)

      if (activeTripId === tripId) {
        clearActiveTripId()
        setActiveTripId(null)
      }
    },
    [activeTripId, trips],
  )

  const contextValue = useMemo(
    () => ({
      activeTrip,
      activeTripId,
      availableTrips,
      errorMessage,
      isLoading,
      isSelectorOpen,
      clearActiveTrip,
      closeSelector: () => setIsSelectorOpen(false),
      createTrip,
      deleteTrip,
      openSelector: () => setIsSelectorOpen(true),
      reloadTrips,
      selectTrip,
      updateTrip,
    }),
    [
      activeTrip,
      activeTripId,
      availableTrips,
      clearActiveTrip,
      createTrip,
      deleteTrip,
      errorMessage,
      isLoading,
      isSelectorOpen,
      reloadTrips,
      selectTrip,
      updateTrip,
    ],
  )

  return (
    <TripContext.Provider value={contextValue}>{children}</TripContext.Provider>
  )
}
