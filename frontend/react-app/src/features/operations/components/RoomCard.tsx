import type { SystemUser } from '../../users/model/userTypes'
import type { HotelRoomConfig } from '../model/operationTypes'

const labels: Record<string, string> = {
  double: 'Duplo',
  family: 'Familiar',
  single: 'Individual',
}

export function RoomCard({
  occupants,
  onAssign,
  onDelete,
  onEdit,
  room,
  users,
}: {
  occupants: string[]
  onAssign: () => void
  onDelete: () => void
  onEdit: () => void
  room: HotelRoomConfig
  users: SystemUser[]
}) {
  const occupantNames = occupants.map(
    (cpf) => users.find((user) => user.cpf === cpf)?.name ?? cpf,
  )
  const overCapacity = occupants.length > room.capacity
  return (
    <article className={`room-card${overCapacity ? ' has-conflict' : ''}`}>
      <header><div><h4>{room.name}</h4><small>ID: {String(room.id)} · {labels[room.type] ?? room.type}</small></div><strong>{occupants.length}/{room.capacity}</strong></header>
      {occupantNames.length ? <ul>{occupantNames.map((name, index) => <li key={`${occupants[index]}-${index}`}>{name}</li>)}</ul> : <p>Nenhum ocupante.</p>}
      {overCapacity ? <p className="operation-warning">Capacidade excedida</p> : null}
      <footer><button onClick={onAssign} type="button">Distribuir</button><button onClick={onEdit} type="button">Editar</button><button className="is-danger-link" onClick={onDelete} type="button">Excluir</button></footer>
    </article>
  )
}
