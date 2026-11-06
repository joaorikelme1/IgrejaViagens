import { useEffect, useMemo, useState } from 'react'
import { AppIcon } from '../../../shared/components/AppIcon'
import { useTrip } from '../../trips/hooks/useTrip'
import { listUsers } from '../../users/api/usersApi'
import type { SystemUser } from '../../users/model/userTypes'
import {
  applyAiPlan,
  deleteTravelerPlanningPreference,
  discardAiPlan,
  generateAiPlan,
  getAiPlanningStatus,
  getAiUsage,
  listAiPlans,
  listTravelerPlanningPreferences,
  saveTravelerPlanningPreference,
} from '../api/aiPlanningApi'
import { TravelerPreferencesPanel } from '../components/TravelerPreferencesPanel'
import type {
  AiPlan,
  AiPlanningFocus,
  AiPlanningStatus,
  AiUsage,
  TravelerPlanningPreference,
  TravelerPlanningPreferenceMutation,
} from '../model/aiPlanningTypes'
import './aiPlanning.css'

const focusLabels: Record<AiPlanningFocus, string> = {
  ALL: 'Hospedagem e transporte',
  ROOMS: 'Somente hospedagem',
  SEATS: 'Somente transporte',
}

const statusLabels: Record<AiPlan['status'], string> = {
  DRAFT: 'Em processamento',
  GENERATING: 'Gerando',
  GENERATED: 'Pronto para revisar',
  FAILED: 'Falhou',
  STALE: 'Desatualizado',
  APPLIED: 'Aplicado',
  DISCARDED: 'Descartado',
}

function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Não foi possível concluir a operação.'
}

function dateTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(date)
}

function label(labels: Record<string, string>, alias: string) {
  return labels[alias] ?? alias
}

function PlanPreview({ plan }: { plan: AiPlan }) {
  const result = plan.result
  if (plan.status === 'DRAFT' || plan.status === 'GENERATING') {
    return (
      <section className="ai-empty-preview" role="status">
        <AppIcon name="sparkles" />
        <h3>O planejador está preparando a proposta</h3>
        <p>Você pode sair desta página. O histórico continuará acompanhando o processamento.</p>
      </section>
    )
  }
  if (!result) {
    return (
      <section className="ai-empty-preview">
        <h3>Plano sem prévia</h3>
        <p>Esta tentativa não produziu uma proposta aplicável.</p>
        {plan.errorCode ? <small>Código técnico: {plan.errorCode}</small> : null}
        {plan.providerRequestId ? <small>Solicitação do provedor: {plan.providerRequestId}</small> : null}
      </section>
    )
  }

  return (
    <div className="ai-preview">
      <section className="ai-summary-card">
        <span>Resumo da proposta</span>
        <h3>{result.summary}</h3>
        <div className="ai-metrics">
          <div><strong>{result.roomCreations.length}</strong><span>quartos novos</span></div>
          <div><strong>{result.roomAssignments.length}</strong><span>acomodações</span></div>
          <div><strong>{result.seatAssignments.length}</strong><span>assentos</span></div>
        </div>
      </section>

      {result.warnings.length ? (
        <section className="ai-warning-card" role="alert">
          <h3><AppIcon name="info" /> Pontos de atenção</h3>
          <ul>{result.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
        </section>
      ) : null}

      {result.roomCreations.length ? (
        <section className="ai-proposal-section">
          <header><h3>Quartos propostos</h3><span>{result.roomCreations.length}</span></header>
          <div className="ai-proposal-list">
            {result.roomCreations.map((room) => (
              <article key={room.key}>
                <div><strong>{room.name}</strong><span>{label(plan.hotelLabels, room.hotel)}</span></div>
                <p>{room.type} · capacidade para {room.capacity}</p>
                {room.reason ? <small>{room.reason}</small> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {result.roomAssignments.length ? (
        <section className="ai-proposal-section">
          <header><h3>Distribuição nos quartos</h3><span>{result.roomAssignments.length}</span></header>
          <div className="ai-proposal-list">
            {result.roomAssignments.map((assignment) => (
              <article key={`${assignment.traveler}-${assignment.room}`}>
                <div><strong>{label(plan.travelerLabels, assignment.traveler)}</strong><span>{label(plan.roomLabels, assignment.room)}</span></div>
                {assignment.reason ? <small>{assignment.reason}</small> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {result.seatAssignments.length ? (
        <section className="ai-proposal-section">
          <header><h3>Distribuição nos ônibus</h3><span>{result.seatAssignments.length}</span></header>
          <div className="ai-proposal-list">
            {result.seatAssignments.map((assignment) => (
              <article key={`${assignment.traveler}-${assignment.bus}-${assignment.floor}-${assignment.seatNumber}`}>
                <div><strong>{label(plan.travelerLabels, assignment.traveler)}</strong><span>{label(plan.busLabels, assignment.bus)}</span></div>
                <p>Piso {assignment.floor} · assento {assignment.seatNumber}</p>
                {assignment.reason ? <small>{assignment.reason}</small> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

function AiPlanningContent({
  travelerCpfs,
  tripId,
  tripName,
}: {
  travelerCpfs: string[]
  tripId: string
  tripName: string
}) {
  const { reloadTrips } = useTrip()
  const [provider, setProvider] = useState<AiPlanningStatus | null>(null)
  const [plans, setPlans] = useState<AiPlan[]>([])
  const [usage, setUsage] = useState<AiUsage | null>(null)
  const [preferences, setPreferences] = useState<TravelerPlanningPreference[]>([])
  const [travelers, setTravelers] = useState<SystemUser[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [focus, setFocus] = useState<AiPlanningFocus>('ALL')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [applying, setApplying] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const selected = useMemo(
    () => plans.find((plan) => plan.id === selectedId) ?? plans[0] ?? null,
    [plans, selectedId],
  )

  const load = async () => {
    const [status, history, currentUsage] = await Promise.all([
      getAiPlanningStatus(),
      listAiPlans(tripId),
      getAiUsage(tripId),
    ])
    setProvider(status)
    setPlans(history)
    setUsage(currentUsage)
    setSelectedId((current) => current ?? history[0]?.id ?? null)
  }

  useEffect(() => {
    let active = true
    Promise.all([
      getAiPlanningStatus(),
      listAiPlans(tripId),
      listTravelerPlanningPreferences(tripId),
      listUsers(),
      getAiUsage(tripId),
    ])
      .then(([status, history, storedPreferences, users, currentUsage]) => {
        if (!active) return
        setProvider(status)
        setPlans(history)
        setPreferences(storedPreferences)
        const members = new Set(travelerCpfs)
        setTravelers(users.filter((user) => members.has(user.cpf)))
        setUsage(currentUsage)
        setSelectedId(history[0]?.id ?? null)
      })
      .catch((cause: unknown) => {
        if (active) setError(message(cause))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [travelerCpfs, tripId])

  const savePreference = async (
    userCpf: string,
    preference: TravelerPlanningPreferenceMutation,
  ) => {
    const saved = await saveTravelerPlanningPreference(tripId, userCpf, preference)
    setPreferences((current) => [
      ...current.filter((item) => item.userCpf !== saved.userCpf),
      saved,
    ])
  }

  const deletePreference = async (userCpf: string) => {
    await deleteTravelerPlanningPreference(tripId, userCpf)
    setPreferences((current) => current.filter((item) => item.userCpf !== userCpf))
  }

  const generate = async () => {
    setGenerating(true)
    setError(null)
    setFeedback(null)
    setAcknowledged(false)
    try {
      const plan = await generateAiPlan(tripId, focus)
      setPlans((current) => [plan, ...current.filter((item) => item.id !== plan.id)])
      setSelectedId(plan.id)
      setFeedback('Proposta calculada. Revise todos os itens antes de aplicar.')
      setUsage(await getAiUsage(tripId))
    } catch (cause) {
      setError(message(cause))
      await load().catch(() => undefined)
    } finally {
      setGenerating(false)
    }
  }

  const apply = async () => {
    if (!selected || !acknowledged) return
    setApplying(true)
    setError(null)
    setFeedback(null)
    try {
      const applied = await applyAiPlan(selected.id)
      await load()
      reloadTrips()
      setAcknowledged(false)
      setFeedback(
        `Plano aplicado: ${applied.roomsCreated} quarto(s) criado(s), ` +
        `${applied.travelersAssignedToRooms} acomodação(ões) e ` +
        `${applied.travelersAssignedToSeats} assento(s).`,
      )
    } catch (cause) {
      setError(message(cause))
    } finally {
      setApplying(false)
    }
  }

  const discard = async () => {
    if (!selected) return
    setError(null)
    setFeedback(null)
    try {
      const discarded = await discardAiPlan(selected.id)
      setPlans((current) => current.map((plan) => plan.id === discarded.id ? discarded : plan))
      setAcknowledged(false)
      setFeedback('Plano descartado sem alterar a viagem.')
    } catch (cause) {
      setError(message(cause))
    }
  }

  if (loading) return <p className="ai-page-status" role="status">Preparando o assistente...</p>
  if (error && !provider) return <p className="ai-page-status" role="alert">{error}</p>

  return (
    <div className="ai-page">
      <header className="ai-hero">
        <div className="ai-hero__icon"><AppIcon name="sparkles" /></div>
        <div>
          <span>Planejador operacional local</span>
          <h2>Assistente de planejamento</h2>
          <p>Calcula quartos e assentos para {tripName} com regras locais e só altera dados depois da sua confirmação.</p>
        </div>
      </header>

      {!provider?.available ? (
        <section className="ai-unavailable" role="status">
          <div><AppIcon name="key" /></div>
          <div><h3>Planejador desativado</h3><p>Defina AI_ENABLED=true no servidor. O recurso funciona localmente e não utiliza API externa.</p></div>
        </section>
      ) : (
        <section className="ai-generator">
          <div>
            <label htmlFor="ai-focus">O que deseja organizar?</label>
            <select id="ai-focus" onChange={(event) => setFocus(event.target.value as AiPlanningFocus)} value={focus}>
              {Object.entries(focusLabels).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
            </select>
            <small>Processamento local · sem API e sem custo por uso</small>
          </div>
          <button disabled={generating || plans.some((plan) => plan.status === 'GENERATING')} onClick={() => void generate()} type="button">
            <AppIcon name="sparkles" /> {generating ? 'Analisando a viagem...' : 'Gerar nova proposta'}
          </button>
          {usage ? <div className="ai-usage"><span><strong>{usage.requestsToday}</strong> / {usage.maxRequestsPerDay} propostas hoje</span><span><strong>Sem cobrança</strong> de API externa</span></div> : null}
        </section>
      )}

      {error ? <p className="form-message is-error" role="alert">{error}</p> : null}
      {feedback ? <p className="form-message is-success" role="status">{feedback}</p> : null}

      <TravelerPreferencesPanel
        onDelete={deletePreference}
        onSave={savePreference}
        preferences={preferences}
        users={travelers}
      />

      <div className="ai-workspace">
        <aside className="ai-history" aria-label="Histórico de planos">
          <header><h3>Histórico</h3><span>{plans.length}</span></header>
          {plans.length ? plans.map((plan) => (
            <button className={selected?.id === plan.id ? 'is-selected' : ''} key={plan.id} onClick={() => { setSelectedId(plan.id); setAcknowledged(false) }} type="button">
              <div><strong>{focusLabels[plan.focus] ?? plan.focus}</strong><span className={`ai-status is-${plan.status.toLowerCase()}`}>{statusLabels[plan.status]}</span></div>
              <small>{dateTime(plan.createdAt)}</small>
            </button>
          )) : <p>Nenhuma proposta gerada para esta viagem.</p>}
        </aside>

        <main className="ai-plan-panel">
          {selected ? (
            <>
              <header className="ai-plan-header">
                <div><span>Proposta de {dateTime(selected.createdAt)}</span><h2>{focusLabels[selected.focus] ?? selected.focus}</h2><small>Calculado localmente</small></div>
                <span className={`ai-status is-${selected.status.toLowerCase()}`}>{statusLabels[selected.status]}</span>
              </header>
              {!selected.currentSnapshot && selected.status === 'GENERATED' ? (
                <p className="ai-stale-warning" role="alert">A viagem mudou após esta análise. Gere uma nova proposta para trabalhar com os dados atuais.</p>
              ) : null}
              <PlanPreview plan={selected} />
              {selected.status === 'GENERATED' ? (
                <footer className="ai-approval">
                  <label>
                    <input checked={acknowledged} disabled={!selected.currentSnapshot} onChange={(event) => setAcknowledged(event.target.checked)} type="checkbox" />
                    <span>Revisei a proposta e autorizo a criação e as atribuições listadas.</span>
                  </label>
                  <div>
                    <button className="ai-secondary-action" onClick={() => void discard()} type="button">Descartar</button>
                    <button className="ai-primary-action" disabled={!acknowledged || !selected.currentSnapshot || applying} onClick={() => void apply()} type="button">{applying ? 'Aplicando...' : 'Aplicar plano'}</button>
                  </div>
                </footer>
              ) : null}
              {selected.status === 'GENERATING' ? (
                <footer className="ai-approval">
                  <span>Esta proposta pertence a uma versão anterior do planejador.</span>
                  <div><button className="ai-secondary-action" onClick={() => void discard()} type="button">Cancelar geração</button></div>
                </footer>
              ) : null}
            </>
          ) : (
            <section className="ai-empty-preview"><AppIcon name="sparkles" /><h3>Crie a primeira proposta</h3><p>O assistente respeitará capacidades, ocupações atuais, famílias e preferências registradas.</p></section>
          )}
        </main>
      </div>
    </div>
  )
}

export function AiPlanningPage() {
  const { activeTrip } = useTrip()
  if (!activeTrip) return null
  return (
    <AiPlanningContent
      key={activeTrip.id}
      travelerCpfs={activeTrip.travelerCpfs}
      tripId={activeTrip.id}
      tripName={activeTrip.name}
    />
  )
}
