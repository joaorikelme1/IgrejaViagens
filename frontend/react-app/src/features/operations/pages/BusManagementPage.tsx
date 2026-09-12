import { useEffect, useMemo, useState } from 'react'
import { useTrip } from '../../trips/hooks/useTrip'
import type { BusConfig, Trip } from '../../trips/model/tripTypes'
import {
  deleteSeats,
  loadTransportSource,
  saveBusStructure,
  saveSeatRecord,
} from '../api/operationsApi'
import { BusEditorModal } from '../components/BusEditorModal'
import { OperationConfirmModal } from '../components/OperationConfirmModal'
import { SeatAssignment } from '../components/SeatAssignment'
import { SeatMap } from '../components/SeatMap'
import {
  assertBusResizeKeepsSeats,
  createBus,
  getSeatConflicts,
  removeBus,
  updateBus,
} from '../lib/transportOperations'
import { createUniqueId } from '../lib/hotelOperations'
import type { SeatRecord, TransportSource } from '../model/operationTypes'
import './operations.css'

type EditingBus = { bus: BusConfig; isNew: boolean }
type SeatTarget = { busId: string; floor: number; seatNumber: number }
type DeleteTarget =
  | { kind: 'bus'; bus: BusConfig }
  | { kind: 'seat'; seat: SeatRecord }

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Não foi possível carregar o transporte.'
}

function BusManagementContent({ trip }: { trip: Trip }) {
  const { reloadTrips } = useTrip()
  const [buses, setBuses] = useState(() => [...trip.buses])
  const [source, setSource] = useState<TransportSource | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [editing, setEditing] = useState<EditingBus | null>(null)
  const [assigning, setAssigning] = useState<SeatTarget | null>(null)
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null)

  useEffect(() => {
    let current = true
    void loadTransportSource(trip.id)
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
    const members = new Set(trip.travelerCpfs)
    return (source?.users ?? []).filter(
      (user) => user.role === 'traveler' && members.has(user.cpf),
    )
  }, [source, trip.travelerCpfs])
  const conflicts = source
    ? getSeatConflicts(buses, source.seats, trip.travelerCpfs)
    : []

  const saveBus = async (bus: BusConfig) => {
    if (!editing || !source) return
    let next: BusConfig[]
    if (editing.isNew) {
      next = [...buses, bus]
    } else {
      assertBusResizeKeepsSeats(
        editing.bus,
        bus,
        source.seats.filter((seat) => seat.tripId === trip.id),
      )
      next = updateBus(buses, editing.bus.id, bus)
    }
    setFeedback(null)
    await saveBusStructure(trip.id, next)
    setBuses(next)
    reloadTrips()
    setFeedback(editing.isNew ? 'Ônibus cadastrado com sucesso.' : 'Ônibus editado sem perder assentos.')
  }

  const assignSeat = async (cpf: string) => {
    if (!assigning || !source) return
    setFeedback(null)
    const id = createUniqueId(
      `seat_${trip.id}_${assigning.busId}_${assigning.floor}_${assigning.seatNumber}`,
      source.seats.map((seat) => seat.id),
    )
    const saved = await saveSeatRecord({
      busId: assigning.busId,
      floor: assigning.floor,
      id,
      seatNumber: assigning.seatNumber,
      tripId: trip.id,
      userCpf: cpf,
    })
    setSource({ ...source, seats: [...source.seats, saved] })
    setFeedback(`Assento ${assigning.seatNumber} atribuído após persistência.`)
  }

  const confirmDelete = async () => {
    if (!deleting || !source) return
    setFeedback(null)
    if (deleting.kind === 'seat') {
      const target = deleting.seat
      await deleteSeats(
        trip.id,
        (seat) =>
          seat.busId === target.busId &&
          seat.floor === target.floor &&
          seat.seatNumber === target.seatNumber,
      )
      setSource({
        ...source,
        seats: source.seats.filter(
          (seat) =>
            !(
              seat.busId === target.busId &&
              seat.floor === target.floor &&
              seat.seatNumber === target.seatNumber
            ),
        ),
      })
      setFeedback(`Assento ${target.seatNumber} liberado após persistência.`)
    } else {
      const busId = String(deleting.bus.id)
      const next = removeBus(buses, deleting.bus.id)
      await saveBusStructure(trip.id, next)
      await deleteSeats(trip.id, (seat) => seat.busId === busId)
      setBuses(next)
      setSource({ ...source, seats: source.seats.filter((seat) => seat.busId !== busId) })
      reloadTrips()
      setFeedback('Ônibus e suas atribuições foram excluídos.')
    }
  }

  if (loadError) return <p className="operation-page-status" role="alert">{loadError}</p>
  if (!source) return <p className="operation-page-status" role="status">Carregando transporte...</p>

  return (
    <div className="operations-page">
      <header className="operations-intro"><div><span>Transporte</span><h2>Ônibus de {trip.name}</h2><p>Configuração dos veículos e distribuição de assentos por piso.</p></div><button className="operation-primary" onClick={() => setEditing({ bus: createBus(buses), isNew: true })} type="button">Cadastrar ônibus</button></header>
      <aside className="operation-info">O primeiro assento do primeiro piso permanece reservado ao motorista. Assentos nunca são descartados silenciosamente ao editar a capacidade.</aside>
      {feedback ? <p className="form-message is-success" role="status">{feedback}</p> : null}
      {conflicts.length ? <section className="operation-conflicts" role="alert"><h3>Inconsistências de assentos ({conflicts.length})</h3><ul>{conflicts.map((conflict) => <li key={conflict.key}>{conflict.message}</li>)}</ul></section> : null}

      {buses.length ? <div className="bus-list">{buses.map((bus) => {
        const busSeats = source.seats.filter((seat) => seat.busId === String(bus.id))
        return <section className="transport-bus-card" key={String(bus.id)}><header><div><h3>Ônibus {String(bus.id)}</h3><small>{bus.floors} piso(s) · {bus.seats} assentos · {busSeats.length} atribuição(ões)</small></div><div><button onClick={() => setEditing({ bus, isNew: false })} type="button">Editar ônibus</button><button className="is-danger-link" onClick={() => setDeleting({ kind: 'bus', bus })} type="button">Excluir ônibus</button></div></header><SeatMap bus={bus} onSeat={(floor, seatNumber, occupant) => { if (occupant) setDeleting({ kind: 'seat', seat: occupant }); else setAssigning({ busId: String(bus.id), floor, seatNumber }) }} seats={busSeats} users={source.users} /></section>
      })}</div> : <section className="operation-empty-state"><h3>Nenhum ônibus configurado</h3><p>Cadastre o primeiro veículo sem alterar os demais dados da viagem.</p></section>}

      {editing ? <BusEditorModal bus={editing.bus} isNew={editing.isNew} onClose={() => setEditing(null)} onSave={saveBus} /> : null}
      {assigning ? <SeatAssignment busId={assigning.busId} floor={assigning.floor} onClose={() => setAssigning(null)} onSave={assignSeat} seatNumber={assigning.seatNumber} users={travelers} /> : null}
      {deleting ? <OperationConfirmModal confirmLabel={deleting.kind === 'bus' ? 'Excluir ônibus' : 'Liberar assento'} description={deleting.kind === 'bus' ? `O ônibus ${String(deleting.bus.id)} e todas as atribuições ligadas a ele serão removidos. Os viajantes serão mantidos.` : `O assento ${deleting.seat.seatNumber} do piso ${deleting.seat.floor} será liberado. O viajante será mantido.`} onClose={() => setDeleting(null)} onConfirm={confirmDelete} title={deleting.kind === 'bus' ? 'Excluir ônibus?' : 'Liberar assento?'} /> : null}
    </div>
  )
}

export function BusManagementPage() {
  const { activeTrip } = useTrip()
  if (!activeTrip) return null
  return <BusManagementContent key={activeTrip.id} trip={activeTrip} />
}
