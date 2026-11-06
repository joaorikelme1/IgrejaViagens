import { useMemo, useState } from 'react'
import type { SystemUser } from '../../users/model/userTypes'
import type {
  MobilityRequirement,
  SeatRegion,
  TravelerPlanningPreference,
  TravelerPlanningPreferenceMutation,
} from '../model/aiPlanningTypes'

interface TravelerPreferencesPanelProps {
  onDelete: (userCpf: string) => Promise<void>
  onSave: (
    userCpf: string,
    preference: TravelerPlanningPreferenceMutation,
  ) => Promise<void>
  preferences: TravelerPlanningPreference[]
  users: SystemUser[]
}

const mobilityLabels: Record<MobilityRequirement, string> = {
  NONE: 'Sem requisito de mobilidade',
  PREFER_LOWER_FLOOR: 'Preferir piso inferior',
  REQUIRE_LOWER_FLOOR: 'Exigir piso inferior',
}

const regionLabels: Record<SeatRegion, string> = {
  ANY: 'Qualquer região',
  FRONT: 'Frente',
  MIDDLE: 'Meio',
  BACK: 'Fundo',
}

function emptyPreference(): TravelerPlanningPreferenceMutation {
  return {
    mobilityRequirement: 'NONE',
    seatRegion: 'ANY',
    preferredBusFloor: null,
    preferredRoomType: null,
    includeInAiPlanning: true,
    companionCpfs: [],
    separatedFromCpfs: [],
    version: null,
  }
}

function mutationOf(
  preference: TravelerPlanningPreference | undefined,
): TravelerPlanningPreferenceMutation {
  if (!preference) return emptyPreference()
  return {
    mobilityRequirement: preference.mobilityRequirement,
    seatRegion: preference.seatRegion,
    preferredBusFloor: preference.preferredBusFloor,
    preferredRoomType: preference.preferredRoomType,
    includeInAiPlanning: preference.includeInAiPlanning,
    companionCpfs: [...preference.companionCpfs],
    separatedFromCpfs: [...preference.separatedFromCpfs],
    version: preference.version,
  }
}

function preferenceSummary(preference: TravelerPlanningPreference | undefined) {
  if (!preference) return 'Usará as regras padrão do planejamento.'
  if (!preference.includeInAiPlanning) return 'Excluído das sugestões automáticas.'
  const details: string[] = []
  if (preference.mobilityRequirement !== 'NONE') {
    details.push(mobilityLabels[preference.mobilityRequirement])
  }
  if (preference.seatRegion !== 'ANY') {
    details.push(`Assento: ${regionLabels[preference.seatRegion].toLowerCase()}`)
  }
  if (preference.preferredRoomType) {
    details.push(`Quarto: ${preference.preferredRoomType}`)
  }
  if (preference.companionCpfs.length) {
    details.push(`${preference.companionCpfs.length} companhia(s)`)
  }
  if (preference.separatedFromCpfs.length) {
    details.push(`${preference.separatedFromCpfs.length} separação(ões)`)
  }
  return details.length ? details.join(' · ') : 'Participa com as regras padrão.'
}

export function TravelerPreferencesPanel({
  onDelete,
  onSave,
  preferences,
  users,
}: TravelerPreferencesPanelProps) {
  const [editingCpf, setEditingCpf] = useState<string | null>(null)
  const [draft, setDraft] = useState<TravelerPlanningPreferenceMutation>(() => emptyPreference())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const preferenceByCpf = useMemo(
    () => new Map(preferences.map((preference) => [preference.userCpf, preference])),
    [preferences],
  )
  const userByCpf = useMemo(
    () => new Map(users.map((user) => [user.cpf, user])),
    [users],
  )
  const editingUser = editingCpf ? userByCpf.get(editingCpf) : undefined

  const edit = (user: SystemUser) => {
    setEditingCpf(user.cpf)
    setDraft(mutationOf(preferenceByCpf.get(user.cpf)))
    setError(null)
  }

  const toggleRelated = (
    cpf: string,
    field: 'companionCpfs' | 'separatedFromCpfs',
    checked: boolean,
  ) => {
    const opposite = field === 'companionCpfs' ? 'separatedFromCpfs' : 'companionCpfs'
    setDraft((current) => ({
      ...current,
      [field]: checked
        ? [...new Set([...current[field], cpf])]
        : current[field].filter((value) => value !== cpf),
      [opposite]: checked
        ? current[opposite].filter((value) => value !== cpf)
        : current[opposite],
    }))
  }

  const save = async () => {
    if (!editingCpf) return
    setSaving(true)
    setError(null)
    try {
      await onSave(editingCpf, draft)
      setEditingCpf(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar as preferências.')
    } finally {
      setSaving(false)
    }
  }

  const reset = async () => {
    if (!editingCpf) return
    setSaving(true)
    setError(null)
    try {
      await onDelete(editingCpf)
      setEditingCpf(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível restaurar o padrão.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="ai-preferences">
      <header>
        <div><span>Regras individuais</span><h3>Preferências dos viajantes</h3></div>
        <small>{preferences.filter((item) => !item.includeInAiPlanning).length} excluído(s) do planejamento</small>
      </header>
      <p>Defina requisitos que o plano deverá respeitar. Dados pessoais continuam no servidor; o modelo recebe apenas aliases.</p>
      <div className="ai-preference-grid">
        {users.map((user) => {
          const preference = preferenceByCpf.get(user.cpf)
          return (
            <button key={user.cpf} onClick={() => edit(user)} type="button">
              <div><strong>{user.name}</strong><span className={preference?.includeInAiPlanning === false ? 'is-excluded' : ''}>{preference?.includeInAiPlanning === false ? 'Manual' : preference ? 'Personalizado' : 'Padrão'}</span></div>
              <p>{preferenceSummary(preference)}</p>
            </button>
          )
        })}
      </div>

      {editingCpf && editingUser ? (
        <div className="ai-preference-backdrop" role="presentation">
          <section aria-labelledby="preference-title" aria-modal="true" className="ai-preference-editor" role="dialog">
            <header><div><span>Preferências operacionais</span><h2 id="preference-title">{editingUser.name}</h2></div><button aria-label="Fechar preferências" disabled={saving} onClick={() => setEditingCpf(null)} type="button">×</button></header>
            <label className="ai-preference-toggle"><input checked={draft.includeInAiPlanning} onChange={(event) => setDraft((current) => ({ ...current, includeInAiPlanning: event.target.checked }))} type="checkbox" /><span><strong>Incluir no planejamento automático</strong><small>Desative quando a organização desta pessoa deva ser totalmente manual.</small></span></label>

            <div className="ai-preference-fields">
              <label>Mobilidade<select disabled={!draft.includeInAiPlanning} onChange={(event) => setDraft((current) => ({ ...current, mobilityRequirement: event.target.value as MobilityRequirement }))} value={draft.mobilityRequirement}>{Object.entries(mobilityLabels).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>
              <label>Região do assento<select disabled={!draft.includeInAiPlanning} onChange={(event) => setDraft((current) => ({ ...current, seatRegion: event.target.value as SeatRegion }))} value={draft.seatRegion}>{Object.entries(regionLabels).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>
              <label>Piso preferido<select disabled={!draft.includeInAiPlanning} onChange={(event) => setDraft((current) => ({ ...current, preferredBusFloor: event.target.value ? Number(event.target.value) : null }))} value={draft.preferredBusFloor ?? ''}><option value="">Sem preferência</option><option value="1">Piso 1</option><option value="2">Piso 2</option></select></label>
              <label>Tipo de quarto preferido<input disabled={!draft.includeInAiPlanning} maxLength={100} onChange={(event) => setDraft((current) => ({ ...current, preferredRoomType: event.target.value || null }))} placeholder="Ex.: casal, térreo, acessível" value={draft.preferredRoomType ?? ''} /></label>
            </div>

            <div className="ai-related-preferences">
              <fieldset disabled={!draft.includeInAiPlanning}><legend>Manter por perto</legend>{users.filter((user) => user.cpf !== editingCpf).map((user) => <label key={user.cpf}><input checked={draft.companionCpfs.includes(user.cpf)} onChange={(event) => toggleRelated(user.cpf, 'companionCpfs', event.target.checked)} type="checkbox" />{user.name}</label>)}</fieldset>
              <fieldset disabled={!draft.includeInAiPlanning}><legend>Manter separado</legend>{users.filter((user) => user.cpf !== editingCpf).map((user) => <label key={user.cpf}><input checked={draft.separatedFromCpfs.includes(user.cpf)} onChange={(event) => toggleRelated(user.cpf, 'separatedFromCpfs', event.target.checked)} type="checkbox" />{user.name}</label>)}</fieldset>
            </div>

            {error ? <p className="form-message is-error" role="alert">{error}</p> : null}
            <footer><button className="ai-secondary-action" disabled={saving || !preferenceByCpf.has(editingCpf)} onClick={() => void reset()} type="button">Restaurar padrão</button><div><button className="ai-secondary-action" disabled={saving} onClick={() => setEditingCpf(null)} type="button">Cancelar</button><button className="ai-primary-action" disabled={saving} onClick={() => void save()} type="button">{saving ? 'Salvando...' : 'Salvar preferências'}</button></div></footer>
          </section>
        </div>
      ) : null}
    </section>
  )
}
