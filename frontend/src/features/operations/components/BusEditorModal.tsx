import { useState, type FormEvent } from 'react'
import type { BusConfig } from '../../trips/model/tripTypes'

export function BusEditorModal({
  bus,
  isNew,
  onClose,
  onSave,
}: {
  bus: BusConfig
  isNew: boolean
  onClose: () => void
  onSave: (bus: BusConfig) => Promise<void>
}) {
  const [floors, setFloors] = useState(bus.floors === 2 ? 2 : 1)
  const [floorOne, setFloorOne] = useState(Math.max(1, bus.seatsFloor1))
  const [floorTwo, setFloorTwo] = useState(Math.max(1, bus.seatsFloor2 || 20))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const seatsFloor1 = Math.min(100, Math.max(1, Math.trunc(floorOne) || 1))
    const seatsFloor2 = floors === 2
      ? Math.min(100, Math.max(1, Math.trunc(floorTwo) || 1))
      : 0
    setSaving(true)
    setError(null)
    try {
      await onSave({
        ...bus,
        floors,
        id: bus.id,
        seats: seatsFloor1 + seatsFloor2,
        seatsFloor1,
        seatsFloor2,
      })
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível salvar o ônibus.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="operation-overlay">
      <section aria-labelledby="bus-form-title" aria-modal="true" className="operation-modal" role="dialog">
        <header className="operation-modal__header"><div><h2 id="bus-form-title">{isNew ? 'Cadastrar ônibus' : 'Editar ônibus'}</h2><p>O ID existente e todos os assentos válidos serão preservados.</p></div><button aria-label="Fechar formulário de ônibus" disabled={saving} onClick={onClose} type="button">×</button></header>
        <form onSubmit={(event) => void submit(event)}>
          <div className="operation-modal__body operation-form-grid">
            {error ? <p className="form-message is-error operation-wide" role="alert">{error}</p> : null}
            <small className="operation-id operation-wide">ID: {String(bus.id)}</small>
            <label className="operation-field">Pisos<select disabled={saving} onChange={(event) => setFloors(Number(event.currentTarget.value) === 2 ? 2 : 1)} value={floors}><option value="1">1 piso</option><option value="2">2 pisos</option></select></label>
            <label className="operation-field">Assentos no piso 1<input disabled={saving} max="100" min="1" onChange={(event) => setFloorOne(Number(event.currentTarget.value))} type="number" value={floorOne} /></label>
            {floors === 2 ? <label className="operation-field operation-wide">Assentos no piso 2<input disabled={saving} max="100" min="1" onChange={(event) => setFloorTwo(Number(event.currentTarget.value))} type="number" value={floorTwo} /></label> : null}
          </div>
          <footer className="operation-modal__footer"><button disabled={saving} onClick={onClose} type="button">Cancelar</button><button className="is-primary" disabled={saving} type="submit">{saving ? 'Salvando...' : 'Salvar ônibus'}</button></footer>
        </form>
      </section>
    </div>
  )
}
