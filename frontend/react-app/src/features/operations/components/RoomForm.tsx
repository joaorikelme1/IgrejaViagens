import { useState, type FormEvent } from 'react'
import type { HotelRoomConfig } from '../model/operationTypes'

const capacities: Record<string, number> = { single: 1, double: 2, family: 4 }

export interface RoomFormValue {
  capacity: number
  name: string
  type: string
}

export function RoomForm({
  occupantsCount,
  onClose,
  onSave,
  room,
}: {
  occupantsCount: number
  onClose: () => void
  onSave: (value: RoomFormValue) => Promise<void>
  room?: HotelRoomConfig
}) {
  const initialType = room && capacities[room.type] ? room.type : room?.type ?? 'double'
  const [name, setName] = useState(room?.name ?? '')
  const [type, setType] = useState(initialType)
  const [capacity, setCapacity] = useState(room?.capacity ?? capacities[initialType] ?? 2)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedName = name.trim()
    const normalizedCapacity = Math.min(100, Math.max(1, Math.trunc(capacity) || 1))
    if (!normalizedName) {
      setError('Informe o número ou nome do quarto.')
      return
    }
    if (normalizedCapacity < occupantsCount) {
      setError(`O quarto possui ${occupantsCount} ocupante(s). Remova ocupantes antes de reduzir a capacidade.`)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave({ capacity: normalizedCapacity, name: normalizedName, type })
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível salvar o quarto.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="operation-overlay">
      <section aria-labelledby="room-form-title" aria-modal="true" className="operation-modal" role="dialog">
        <header className="operation-modal__header"><div><h2 id="room-form-title">{room ? 'Editar quarto' : 'Cadastrar quarto'}</h2><p>A capacidade nunca remove ocupantes automaticamente.</p></div><button aria-label="Fechar formulário de quarto" disabled={saving} onClick={onClose} type="button">×</button></header>
        <form onSubmit={(event) => void submit(event)}>
          <div className="operation-modal__body operation-form-grid">
            {error ? <p className="form-message is-error operation-wide" role="alert">{error}</p> : null}
            <label className="operation-field operation-wide">Número ou nome<input disabled={saving} onChange={(event) => setName(event.currentTarget.value)} value={name} /></label>
            {room ? <small className="operation-id operation-wide">ID preservado: {String(room.id)}</small> : null}
            <label className="operation-field">Tipo<select disabled={saving} onChange={(event) => { const next = event.currentTarget.value; setType(next); if (capacities[next]) setCapacity(capacities[next]) }} value={capacities[type] ? type : 'custom'}><option value="single">Individual</option><option value="double">Duplo</option><option value="family">Familiar</option><option value="custom">Personalizado</option></select></label>
            <label className="operation-field">Capacidade<input disabled={saving || Boolean(capacities[type])} max="100" min="1" onChange={(event) => setCapacity(Number(event.currentTarget.value))} type="number" value={capacity} /></label>
          </div>
          <footer className="operation-modal__footer"><button disabled={saving} onClick={onClose} type="button">Cancelar</button><button className="is-primary" disabled={saving} type="submit">{saving ? 'Salvando...' : 'Salvar quarto'}</button></footer>
        </form>
      </section>
    </div>
  )
}
