import { useMemo, useState } from 'react'
import { maskCpf } from '../../../shared/validation/cpf'
import type { SystemUser } from '../../users/model/userTypes'
import { assertRoomCapacity } from '../lib/hotelOperations'
import type { HotelRoomConfig, RoomRecord } from '../model/operationTypes'

export function RoomAssignment({
  current,
  onClose,
  onSave,
  room,
  rooms,
  users,
}: {
  current: string[]
  onClose: () => void
  onSave: (occupants: string[]) => Promise<void>
  room: HotelRoomConfig
  rooms: RoomRecord[]
  users: SystemUser[]
}) {
  const [selected, setSelected] = useState(() => new Set(current))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const otherRooms = useMemo(() => {
    const result = new Map<string, string>()
    rooms.forEach((record) => {
      if (record.id === String(room.id)) return
      record.occupants.forEach((cpf) => result.set(cpf, record.id))
    })
    return result
  }, [room.id, rooms])

  const submit = async () => {
    try {
      const occupants = assertRoomCapacity(room.capacity, [...selected])
      setSaving(true)
      setError(null)
      await onSave(occupants)
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível distribuir os viajantes.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="operation-overlay">
      <section aria-labelledby="room-assignment-title" aria-modal="true" className="operation-modal" role="dialog">
        <header className="operation-modal__header"><div><h2 id="room-assignment-title">Ocupantes de {room.name}</h2><p>{selected.size}/{room.capacity} pessoa(s) selecionada(s).</p></div><button aria-label="Fechar distribuição de quarto" disabled={saving} onClick={onClose} type="button">×</button></header>
        <div className="operation-modal__body assignment-list">
          {error ? <p className="form-message is-error" role="alert">{error}</p> : null}
          {users.length ? users.map((user) => {
            const otherRoom = otherRooms.get(user.cpf)
            const checked = selected.has(user.cpf)
            return <label className={otherRoom && !checked ? 'is-blocked' : ''} key={user.cpf}><input checked={checked} disabled={saving || Boolean(otherRoom && !checked)} onChange={(event) => setSelected((value) => { const next = new Set(value); if (event.currentTarget.checked) next.add(user.cpf); else next.delete(user.cpf); return next })} type="checkbox" /><span><strong>{user.name}</strong><small>{maskCpf(user.cpf)}{otherRoom ? ` · já está no quarto ${otherRoom}` : ''}</small></span></label>
          }) : <p className="operation-empty">Nenhum viajante associado à viagem.</p>}
        </div>
        <footer className="operation-modal__footer"><button disabled={saving} onClick={onClose} type="button">Cancelar</button><button className="is-primary" disabled={saving} onClick={() => void submit()} type="button">{saving ? 'Persistindo...' : 'Salvar ocupantes'}</button></footer>
      </section>
    </div>
  )
}
