import { useEffect, useMemo, useState } from 'react'
import { useTrip } from '../../trips/hooks/useTrip'
import type { Trip } from '../../trips/model/tripTypes'
import {
  deleteRoomRecords,
  loadHotelSource,
  saveHotelStructure,
  saveRoomRecord,
  saveTripRoomAssignments,
} from '../api/operationsApi'
import { HotelForm } from '../components/HotelForm'
import { OperationConfirmModal } from '../components/OperationConfirmModal'
import { RoomAssignment } from '../components/RoomAssignment'
import { RoomCard } from '../components/RoomCard'
import { RoomForm, type RoomFormValue } from '../components/RoomForm'
import { assignFamiliesToRooms } from '../lib/familyAssignments'
import {
  addHotel,
  addRoom,
  createUniqueId,
  getRoomConflicts,
  parseHotels,
  removeHotel,
  removeRoom,
  roomOccupants,
  updateHotel,
  updateRoom,
} from '../lib/hotelOperations'
import type {
  HotelConfig,
  HotelRoomConfig,
  HotelSource,
} from '../model/operationTypes'
import './operations.css'

type RoomTarget = { hotel: HotelConfig; room?: HotelRoomConfig }
type DeleteTarget =
  | { kind: 'hotel'; hotel: HotelConfig }
  | { kind: 'room'; hotel: HotelConfig; room: HotelRoomConfig }

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Não foi possível carregar os hotéis.'
}

function HotelManagementContent({ trip }: { trip: Trip }) {
  const { reloadTrips } = useTrip()
  const [hotels, setHotels] = useState(() => parseHotels(trip.hotelsJson))
  const [source, setSource] = useState<HotelSource | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [hotelForm, setHotelForm] = useState<HotelConfig | 'new' | null>(null)
  const [roomForm, setRoomForm] = useState<RoomTarget | null>(null)
  const [assignment, setAssignment] = useState<RoomTarget | null>(null)
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null)
  const [autoAssigning, setAutoAssigning] = useState(false)

  useEffect(() => {
    let current = true
    void loadHotelSource(trip.id)
      .then((loaded) => {
        if (current) setSource(loaded)
      })
      .catch((error: unknown) => {
        if (current) setLoadError(errorMessage(error))
      })
    return () => {
      current = false
    }
  }, [trip.id])

  const travelers = useMemo(() => {
    const memberCpfs = new Set(trip.travelerCpfs)
    return (source?.users ?? []).filter(
      (user) => memberCpfs.has(user.cpf),
    )
  }, [source, trip.travelerCpfs])
  const conflicts = source
    ? getRoomConflicts(hotels, source.rooms, trip.travelerCpfs)
    : []

  const persistHotels = async (next: HotelConfig[], message: string) => {
    setFeedback(null)
    await saveHotelStructure(trip.id, next)
    setHotels(next)
    reloadTrips()
    setFeedback(message)
  }

  const saveHotel = async (name: string) => {
    if (hotelForm === 'new') {
      const id = createUniqueId('hotel', hotels.map((hotel) => hotel.id))
      await persistHotels(addHotel(hotels, { id, name }), 'Hotel cadastrado com sucesso.')
      return
    }
    if (hotelForm) {
      await persistHotels(
        updateHotel(hotels, hotelForm.id, name),
        'Hotel atualizado sem alterar seus quartos.',
      )
    }
  }

  const saveRoom = async (value: RoomFormValue) => {
    if (!roomForm || !source) return
    const existing = roomForm.room
    const roomId = existing
      ? existing.id
      : createUniqueId(
          `room_${trip.id}`,
          hotels.flatMap((hotel) => hotel.rooms.map((room) => room.id)),
        )
    const room: HotelRoomConfig = existing
      ? { ...existing, ...value, id: existing.id }
      : { ...value, id: roomId }
    const nextHotels = existing
      ? updateRoom(hotels, roomForm.hotel.id, existing.id, value)
      : addRoom(hotels, roomForm.hotel.id, room)
    const occupants = existing ? roomOccupants(source.rooms, existing.id) : []

    setFeedback(null)
    await saveHotelStructure(trip.id, nextHotels)
    const saved = await saveRoomRecord({
      capacity: room.capacity,
      hotelId: String(roomForm.hotel.id),
      id: String(room.id),
      name: room.name,
      occupants,
      tripId: trip.id,
      type: room.type,
    })
    setHotels(nextHotels)
    setSource({
      ...source,
      rooms: source.rooms.some((item) => item.id === saved.id)
        ? source.rooms.map((item) => item.id === saved.id ? saved : item)
        : [...source.rooms, saved],
    })
    reloadTrips()
    setFeedback(existing ? 'Quarto editado sem perder ocupantes.' : 'Quarto cadastrado com sucesso.')
  }

  const saveAssignment = async (occupants: string[]) => {
    if (!assignment?.room || !source) return
    setFeedback(null)
    const current = source.rooms.find(
      (room) => room.id === String(assignment.room?.id),
    )
    const saved = await saveRoomRecord({
      ...current,
      capacity: assignment.room.capacity,
      hotelId: String(assignment.hotel.id),
      id: String(assignment.room.id),
      name: assignment.room.name,
      occupants,
      tripId: trip.id,
      type: assignment.room.type,
    })
    setSource({
      ...source,
      rooms: source.rooms.some((room) => room.id === saved.id)
        ? source.rooms.map((room) => room.id === saved.id ? saved : room)
        : [...source.rooms, saved],
    })
    setFeedback('Distribuição persistida com sucesso.')
  }

  const confirmDelete = async () => {
    if (!deleting || !source) return
    setFeedback(null)
    if (deleting.kind === 'room') {
      const roomId = String(deleting.room.id)
      const next = removeRoom(hotels, deleting.hotel.id, deleting.room.id)
      await saveHotelStructure(trip.id, next)
      await deleteRoomRecords(trip.id, [roomId])
      setHotels(next)
      setSource({ ...source, rooms: source.rooms.filter((room) => room.id !== roomId) })
      setFeedback('Quarto e sua distribuição foram excluídos.')
    } else {
      const roomIds = deleting.hotel.rooms.map((room) => String(room.id))
      const next = removeHotel(hotels, deleting.hotel.id)
      await saveHotelStructure(trip.id, next)
      if (roomIds.length) await deleteRoomRecords(trip.id, roomIds)
      setHotels(next)
      const targets = new Set(roomIds)
      setSource({ ...source, rooms: source.rooms.filter((room) => !targets.has(room.id)) })
      setFeedback('Hotel e seus quartos foram excluídos.')
    }
    reloadTrips()
  }

  const autoAssignFamilies = async () => {
    if (!source) return
    setFeedback(null)
    setAutoAssigning(true)
    try {
      const result = assignFamiliesToRooms(
        hotels,
        source.rooms,
        source.users,
        trip.travelerCpfs,
        trip.id,
      )
      if (!result.assignedCount) {
        setFeedback('Todos os viajantes já possuem quarto ou não há vagas disponíveis.')
        return
      }
      const saved = await saveTripRoomAssignments(trip.id, result.records)
      setSource({ ...source, rooms: saved })
      setFeedback(
        `${result.assignedCount} viajante(s) acomodado(s), priorizando famílias. ${result.warnings.join(' ')}`.trim(),
      )
    } catch (error) {
      setFeedback(errorMessage(error))
    } finally {
      setAutoAssigning(false)
    }
  }

  if (loadError) return <p className="operation-page-status" role="alert">{loadError}</p>
  if (!source) return <p className="operation-page-status" role="status">Carregando hotéis...</p>

  return (
    <div className="operations-page">
      <header className="operations-intro"><div><span>Hospedagem</span><h2>Hotéis de {trip.name}</h2><p>Quartos, capacidades e distribuição dos viajantes.</p></div><button className="operation-primary" onClick={() => setHotelForm('new')} type="button">Cadastrar hotel</button></header>
      <aside className="operation-info">Os dados de hotel ficam temporariamente na viagem; as ocupações continuam no contrato separado de quartos.</aside>
      <div className="operation-auto-actions"><button disabled={autoAssigning || !hotels.some((hotel) => hotel.rooms.length) || conflicts.length > 0} onClick={() => void autoAssignFamilies()} type="button">{autoAssigning ? 'Acomodando...' : 'Acomodar famílias automaticamente'}</button></div>
      {feedback ? <p className="form-message is-success" role="status">{feedback}</p> : null}
      {conflicts.length ? <section className="operation-conflicts" role="alert"><h3>Conflitos de ocupação ({conflicts.length})</h3><ul>{conflicts.map((conflict) => <li key={conflict.key}>{conflict.message}</li>)}</ul></section> : null}

      {hotels.length ? <div className="hotel-list">{hotels.map((hotel) => (
        <section className="hotel-card" key={String(hotel.id)}>
          <header><div><h3>{hotel.name}</h3><small>{hotel.rooms.length} quarto(s)</small></div><div><button onClick={() => setHotelForm(hotel)} type="button">Editar hotel</button><button className="is-danger-link" onClick={() => setDeleting({ kind: 'hotel', hotel })} type="button">Excluir hotel</button><button className="operation-primary" onClick={() => setRoomForm({ hotel })} type="button">Adicionar quarto</button></div></header>
          {hotel.rooms.length ? <div className="room-grid">{hotel.rooms.map((room) => <RoomCard key={String(room.id)} occupants={roomOccupants(source.rooms, room.id)} onAssign={() => setAssignment({ hotel, room })} onDelete={() => setDeleting({ kind: 'room', hotel, room })} onEdit={() => setRoomForm({ hotel, room })} room={room} users={source.users} />)}</div> : <p className="operation-empty">Nenhum quarto cadastrado neste hotel.</p>}
        </section>
      ))}</div> : <section className="operation-empty-state"><h3>Nenhum hotel configurado</h3><p>Cadastre o primeiro hotel sem alterar os demais dados da viagem.</p></section>}

      {hotelForm ? <HotelForm hotel={hotelForm === 'new' ? undefined : hotelForm} onClose={() => setHotelForm(null)} onSave={saveHotel} /> : null}
      {roomForm ? <RoomForm occupantsCount={roomForm.room ? roomOccupants(source.rooms, roomForm.room.id).length : 0} onClose={() => setRoomForm(null)} onSave={saveRoom} room={roomForm.room} /> : null}
      {assignment?.room ? <RoomAssignment current={roomOccupants(source.rooms, assignment.room.id)} onClose={() => setAssignment(null)} onSave={saveAssignment} room={assignment.room} rooms={source.rooms} users={travelers} /> : null}
      {deleting ? <OperationConfirmModal confirmLabel={deleting.kind === 'hotel' ? 'Excluir hotel' : 'Excluir quarto'} description={deleting.kind === 'hotel' ? `O hotel ${deleting.hotel.name}, seus quartos e distribuições serão removidos. Os viajantes serão mantidos.` : `O quarto ${deleting.room.name} e sua distribuição serão removidos. Os demais quartos serão preservados.`} onClose={() => setDeleting(null)} onConfirm={confirmDelete} title={deleting.kind === 'hotel' ? 'Excluir hotel?' : 'Excluir quarto?'} /> : null}
    </div>
  )
}

export function HotelManagementPage() {
  const { activeTrip } = useTrip()
  if (!activeTrip) return null
  return <HotelManagementContent key={activeTrip.id} trip={activeTrip} />
}
