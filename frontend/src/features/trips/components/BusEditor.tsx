import type { BusConfig } from '../model/tripTypes'

interface BusEditorProps {
  buses: BusConfig[]
  disabled?: boolean
  preservedBusIds?: Array<string | number>
  onChange: (buses: BusConfig[]) => void
}

function createBus(buses: BusConfig[]): BusConfig {
  const numericIds = buses
    .map((bus) => Number(bus.id))
    .filter((id) => Number.isInteger(id) && id > 0)

  return {
    id: numericIds.length ? Math.max(...numericIds) + 1 : `bus_${Date.now()}`,
    floors: 1,
    seatsFloor1: 44,
    seatsFloor2: 0,
    seats: 44,
  }
}

export function BusEditor({
  buses,
  disabled = false,
  preservedBusIds = [],
  onChange,
}: BusEditorProps) {
  const preservedIds = new Set(preservedBusIds.map(String))
  const updateBus = (index: number, patch: Partial<BusConfig>) => {
    onChange(
      buses.map((bus, busIndex) =>
        busIndex === index ? { ...bus, ...patch } : bus,
      ),
    )
  }

  return (
    <fieldset className="bus-editor" disabled={disabled}>
      <legend>Ônibus da viagem</legend>
      <div className="bus-editor__heading">
        <p>Os identificadores existentes são mantidos para preservar assentos.</p>
        <button onClick={() => onChange([...buses, createBus(buses)])} type="button">
          Adicionar ônibus
        </button>
      </div>

      <div className="bus-editor__list">
        {buses.map((bus, index) => (
          <section className="bus-card" key={String(bus.id)}>
            <header>
              <strong>Ônibus {index + 1}</strong>
              <small>ID: {String(bus.id)}</small>
              <button
                aria-label={`Remover ônibus ${index + 1}`}
                disabled={
                  buses.length === 1 || preservedIds.has(String(bus.id))
                }
                onClick={() =>
                  onChange(buses.filter((_, busIndex) => busIndex !== index))
                }
                type="button"
              >
                {preservedIds.has(String(bus.id)) ? 'Associado' : 'Remover'}
              </button>
            </header>
            <div className="bus-card__fields">
              <label>
                <span>Pisos do ônibus {index + 1}</span>
                <select
                  aria-label={`Pisos do ônibus ${index + 1}`}
                  onChange={(event) => {
                    const floors = Number(event.target.value)
                    updateBus(index, {
                      floors,
                      seatsFloor2: floors === 2 ? bus.seatsFloor2 || 20 : 0,
                    })
                  }}
                  value={bus.floors}
                >
                  <option value="1">1 piso</option>
                  <option value="2">2 pisos</option>
                </select>
              </label>
              <label>
                <span>Assentos no primeiro piso</span>
                <input
                  aria-label={`Assentos no primeiro piso do ônibus ${index + 1}`}
                  min="1"
                  onChange={(event) =>
                    updateBus(index, { seatsFloor1: Number(event.target.value) })
                  }
                  step="1"
                  type="number"
                  value={bus.seatsFloor1}
                />
              </label>
              {bus.floors === 2 ? (
                <label>
                  <span>Assentos no segundo piso</span>
                  <input
                    aria-label={`Assentos no segundo piso do ônibus ${index + 1}`}
                    min="0"
                    onChange={(event) =>
                      updateBus(index, {
                        seatsFloor2: Number(event.target.value),
                      })
                    }
                    step="1"
                    type="number"
                    value={bus.seatsFloor2}
                  />
                </label>
              ) : null}
            </div>
          </section>
        ))}
      </div>
    </fieldset>
  )
}
