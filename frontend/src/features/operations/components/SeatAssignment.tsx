import { useState } from 'react'
import { maskCpf } from '../../../shared/validation/cpf'
import type { SystemUser } from '../../users/model/userTypes'

export function SeatAssignment({
  busId,
  floor,
  onClose,
  onSave,
  seatNumber,
  users,
}: {
  busId: string
  floor: number
  onClose: () => void
  onSave: (cpf: string) => Promise<void>
  seatNumber: number
  users: SystemUser[]
}) {
  const [savingCpf, setSavingCpf] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const save = async (cpf: string) => {
    setSavingCpf(cpf)
    setError(null)
    try {
      await onSave(cpf)
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível atribuir o assento.')
    } finally {
      setSavingCpf(null)
    }
  }

  return (
    <div className="operation-overlay">
      <section aria-labelledby="seat-assignment-title" aria-modal="true" className="operation-modal" role="dialog">
        <header className="operation-modal__header"><div><h2 id="seat-assignment-title">Atribuir assento {seatNumber}</h2><p>Ônibus {busId} · piso {floor}</p></div><button aria-label="Fechar atribuição de assento" disabled={savingCpf !== null} onClick={onClose} type="button">×</button></header>
        <div className="operation-modal__body assignment-list">
          {error ? <p className="form-message is-error" role="alert">{error}</p> : null}
          {users.length ? users.map((user) => <button disabled={savingCpf !== null} key={user.cpf} onClick={() => void save(user.cpf)} type="button"><span><strong>{user.name}</strong><small>{maskCpf(user.cpf)}</small></span><b>{savingCpf === user.cpf ? 'Persistindo...' : 'Selecionar'}</b></button>) : <p className="operation-empty">Nenhum viajante associado à viagem.</p>}
        </div>
        <footer className="operation-modal__footer"><button disabled={savingCpf !== null} onClick={onClose} type="button">Cancelar</button></footer>
      </section>
    </div>
  )
}
