import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { AppIcon } from '../../../shared/components/AppIcon'
import { useAuth } from '../../auth/hooks/useAuth'
import { loadHotelSource, loadTransportSource } from '../../operations/api/operationsApi'
import { parseHotels } from '../../operations/lib/hotelOperations'
import { useTrip } from '../../trips/hooks/useTrip'
import { interpretAssistantCommand } from '../api/assistantApi'
import { buildAssistantPlan, executeAssistantOperation } from '../lib/assistantPlanner'
import type { AssistantContext, AssistantMessage, AssistantPlan } from '../model/assistantTypes'
import './adminAssistant.css'

const suggestions = [
  'Quantas pessoas ainda não possuem ônibus definido?',
  'Quais passageiros ainda não possuem quarto?',
  'Quais hotéis estão lotados?',
  'Distribua as pessoas pelos ônibus disponíveis',
  'Organize as pessoas nos quartos dos hotéis',
  'Atribua quartos e assentos a quem ainda não possui',
]

function message(role: AssistantMessage['role'], text: string, extra: Partial<AssistantMessage> = {}): AssistantMessage {
  return { id: crypto.randomUUID(), role, text, createdAt: new Date().toISOString(), ...extra }
}

function loadHistory(key: string) {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(value) ? value.slice(-40) as AssistantMessage[] : []
  } catch {
    return []
  }
}

export function AdminAssistantPage() {
  const { user } = useAuth()
  const { activeTrip, reloadTrips } = useTrip()
  const [context, setContext] = useState<AssistantContext | null>(null)
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [input, setInput] = useState('')
  const [pending, setPending] = useState<AssistantPlan | null>(null)
  const [processing, setProcessing] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const historyKey = `igreja-viagens:assistant:${activeTrip?.id ?? 'none'}`

  useEffect(() => {
    if (!activeTrip) return
    const stored = loadHistory(historyKey)
    setMessages(stored.length ? stored : [message('assistant', `Olá! Estou pronto para administrar a viagem ${activeTrip.name}. Eu trabalho com regras locais e sempre apresento uma prévia antes de alterar dados.`)])
  }, [activeTrip, historyKey])

  useEffect(() => {
    if (!activeTrip) return
    let current = true
    setLoadError(null)
    Promise.all([loadHotelSource(activeTrip.id), loadTransportSource(activeTrip.id)])
      .then(([hotel, transport]) => {
        if (!current) return
        setContext({
          buses: activeTrip.buses,
          hotels: parseHotels(activeTrip.hotelsJson),
          rooms: hotel.rooms,
          seats: transport.seats,
          trip: activeTrip,
          users: hotel.users,
        })
      })
      .catch((error: unknown) => {
        if (current) setLoadError(error instanceof Error ? error.message : 'Não foi possível carregar os dados administrativos.')
      })
    return () => { current = false }
  }, [activeTrip])

  useEffect(() => {
    if (!messages.length) return
    localStorage.setItem(historyKey, JSON.stringify(messages.slice(-40)))
    if (typeof endRef.current?.scrollIntoView === 'function') endRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [historyKey, messages])

  const indicators = useMemo(() => {
    if (!context) return { travelers: 0, withoutRoom: 0, withoutSeat: 0 }
    const roomed = new Set(context.rooms.flatMap((room) => room.occupants))
    const seated = new Set(context.seats.map((seat) => seat.userCpf))
    return {
      travelers: context.trip.travelerCpfs.length,
      withoutRoom: context.trip.travelerCpfs.filter((cpf) => !roomed.has(cpf)).length,
      withoutSeat: context.trip.travelerCpfs.filter((cpf) => !seated.has(cpf)).length,
    }
  }, [context])

  const submit = async (event?: FormEvent) => {
    event?.preventDefault()
    const command = input.trim()
    if (!command || !context || processing) return
    setMessages((current) => [...current, message('user', command)])
    setInput('')
    setPending(null)
    setProcessing(true)
    try {
      const parsed = await interpretAssistantCommand(command)
      if (parsed.clarification) {
        setMessages((current) => [...current, message('assistant', parsed.clarification, { tone: 'warning' })])
        return
      }
      if (!parsed.intent) return
      const plan = buildAssistantPlan(parsed.intent, context)
      setMessages((current) => [...current, message('assistant', plan.summary, { details: plan.details, warnings: plan.warnings, tone: plan.warnings.length ? 'warning' : 'default' })])
      if (plan.operation) setPending(plan)
    } catch (error) {
      setMessages((current) => [...current, message('assistant', error instanceof Error ? error.message : 'Não foi possível consultar a IA.', { tone: 'warning' })])
    } finally {
      setProcessing(false)
    }
  }

  const confirm = async () => {
    if (!pending?.operation || !context) return
    if (user?.role !== 'admin') {
      setMessages((current) => [...current, message('assistant', 'Somente administradores podem executar operações do assistente.', { tone: 'warning' })])
      setPending(null)
      return
    }
    setProcessing(true)
    try {
      await executeAssistantOperation(context.trip.id, pending.operation, user.role)
      const operation = pending.operation
      setContext((current) => current ? {
        ...current,
        buses: operation.kind === 'save_buses' ? operation.buses : current.buses,
        hotels: operation.kind === 'save_hotels' ? operation.hotels : current.hotels,
        rooms: operation.kind === 'save_rooms' ? operation.rooms : current.rooms,
        seats: operation.kind === 'save_seats' ? operation.seats : current.seats,
        ...(operation.kind === 'save_allocations' ? { rooms: operation.rooms, seats: operation.seats } : {}),
      } : current)
      reloadTrips()
      setMessages((current) => [...current, message('assistant', `${pending.title} concluído com sucesso.`, { tone: 'success' })])
      setPending(null)
    } catch (error) {
      setMessages((current) => [...current, message('assistant', error instanceof Error ? error.message : 'Não foi possível executar a operação.', { tone: 'warning' })])
    } finally {
      setProcessing(false)
    }
  }

  if (!activeTrip) return null

  return (
    <div className="assistant-page">
      <header className="assistant-hero">
        <div className="assistant-hero__identity"><span className="assistant-avatar"><AppIcon name="assistant" /></span><div><span>Assistente administrativo</span><h2>Olá, posso organizar a viagem por você</h2><p>Comandos determinísticos, prévia obrigatória e execução segura no Supabase.</p></div></div>
        <button onClick={() => { setMessages([message('assistant', `Histórico limpo. Como posso ajudar na viagem ${activeTrip.name}?`)]); setPending(null) }} type="button">Limpar conversa</button>
      </header>

      <section aria-label="Resumo operacional" className="assistant-indicators">
        <article><span>Viajantes</span><strong>{indicators.travelers}</strong></article>
        <article><span>Sem ônibus</span><strong>{indicators.withoutSeat}</strong></article>
        <article><span>Sem quarto</span><strong>{indicators.withoutRoom}</strong></article>
        <article><span>Viagem ativa</span><strong>{activeTrip.name}</strong></article>
      </section>

      {loadError ? <p className="form-message is-error" role="alert">{loadError}</p> : null}

      <div className="assistant-workspace">
        <section aria-label="Conversa com o assistente" className="assistant-chat">
          <div className="assistant-messages" aria-live="polite">
            {messages.map((item) => <article className={`assistant-message is-${item.role} ${item.tone ? `is-${item.tone}` : ''}`} key={item.id}><div className="assistant-message__meta"><strong>{item.role === 'assistant' ? 'Assistente' : 'Você'}</strong><time>{new Date(item.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</time></div><p>{item.text}</p>{item.details?.length ? <ul>{item.details.map((detail) => <li key={detail}>{detail}</li>)}</ul> : null}{item.warnings?.length ? <div className="assistant-warnings">{item.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div> : null}</article>)}
            {processing ? <article className="assistant-message is-assistant"><div className="assistant-processing"><span /><span /><span /></div><p>Executando a operação e validando os dados...</p></article> : null}
            <div ref={endRef} />
          </div>

          {pending ? <aside className="assistant-confirmation"><div><span>Prévia pronta</span><strong>{pending.title}</strong><p>Revise os itens acima. Nenhuma alteração foi realizada ainda.</p></div><div><button disabled={processing} onClick={() => { setPending(null); setMessages((current) => [...current, message('assistant', 'Operação cancelada. Nenhum dado foi alterado.')]) }} type="button">Cancelar</button><button className="is-primary" disabled={processing} onClick={() => void confirm()} type="button">Confirmar e executar</button></div></aside> : null}

          <form className="assistant-composer" onSubmit={(event) => void submit(event)}>
            <textarea aria-label="Solicitação ao assistente" disabled={!context || processing} onChange={(event) => setInput(event.currentTarget.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void submit() } }} placeholder="Ex.: Distribua as pessoas pelos ônibus disponíveis" rows={3} value={input} />
            <div><small>Enter para enviar · Shift+Enter para nova linha</small><button className="is-primary" disabled={!input.trim() || !context || processing} type="submit">Enviar comando <AppIcon name="arrowRight" /></button></div>
          </form>
        </section>

        <aside className="assistant-guide">
          <div><span>Comandos rápidos</span><h3>O que posso fazer</h3><p>Escolha uma sugestão ou escreva com suas próprias palavras.</p></div>
          <div className="assistant-suggestions">{suggestions.map((suggestion) => <button key={suggestion} onClick={() => setInput(suggestion)} type="button">{suggestion}</button>)}</div>
          <details><summary>Cadastro em lote</summary><p>Use uma linha por item:</p><code>Cadastre estes hotéis:{'\n'}Hotel Central | endereço=Rua A | quartos=101:2, 102:3</code><code>Cadastre estes ônibus:{'\n'}Executivo 1 | empresa=Viação Azul | motorista=João | placa=ABC1D23 | assentos=44</code></details>
          <details><summary>Movimentações</summary><code>Mude a família Silva para o ônibus 3</code><code>Transfira Ana Silva e João Silva para o hotel Central</code></details>
          <div className="assistant-local-note"><AppIcon name="lock" /><p><strong>Sem inteligência artificial</strong><span>Todo comando é interpretado por regras locais e permissões administrativas.</span></p></div>
        </aside>
      </div>
    </div>
  )
}
