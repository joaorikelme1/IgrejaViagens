import type { BusConfig } from '../../trips/model/tripTypes'
import type { SystemUser } from '../../users/model/userTypes'
import { busFloorCapacity, seatAt } from '../lib/transportOperations'
import type { SeatRecord } from '../model/operationTypes'

export function SeatMap({
  bus,
  onSeat,
  seats,
  users,
}: {
  bus: BusConfig
  onSeat: (floor: number, seatNumber: number, occupant: SeatRecord | null) => void
  seats: SeatRecord[]
  users: SystemUser[]
}) {
  return <div className="seat-floors">{Array.from({ length: bus.floors }, (_, index) => index + 1).map((floor) => {
    const capacity = busFloorCapacity(bus, floor)
    return <section className="seat-floor" key={floor}><h4>{bus.floors === 2 ? `${floor}º piso` : 'Mapa de assentos'}</h4><div className="seat-front">Frente do ônibus</div>{capacity > 0 ? <div className="seat-map">{Array.from({ length: capacity }, (_, index) => index + 1).map((seatNumber) => {
      const driver = floor === 1 && seatNumber === 1
      const occupant = seatAt(seats, bus.id, floor, seatNumber) ?? null
      const name = occupant ? users.find((user) => user.cpf === occupant.userCpf)?.name ?? occupant.userCpf : ''
      return <button aria-label={driver ? 'Assento 1 reservado ao motorista' : occupant ? `Assento ${seatNumber}, ocupado por ${name}` : `Assento ${seatNumber}, livre`} className={driver ? 'is-driver' : occupant ? 'is-occupied' : 'is-free'} disabled={driver} key={seatNumber} onClick={() => onSeat(floor, seatNumber, occupant)} title={driver ? 'Motorista' : occupant ? name : 'Livre'} type="button">{driver ? 'M' : seatNumber}</button>
    })}</div> : <p className="operation-empty">Piso sem assentos configurados.</p>}</section>
  })}</div>
}
