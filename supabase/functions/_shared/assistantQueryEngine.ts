export type FinancialStatus = 'complete' | 'partial' | 'unpaid' | 'unconfigured' | 'overpaid'

export interface AssistantTravelerSnapshot {
  birthdate?: string | null
  childNames?: string[]
  hasKids?: boolean
  id: string
  married?: boolean
  name: string
  spouseName?: string
  status?: 'active' | 'cancelled'
  tripId: string
}

export interface AssistantPaymentSnapshot {
  id: string
  paidInstallments: number
  receipts: Array<{ installment: number; status: 'approved' | 'pending' | 'rejected' }>
  totalInstallments: number
  travelerId: string
  tripId: string
}

export interface AssistantSeatSnapshot {
  busLabel?: string
  busId: string
  floor: number
  id: string
  seatNumber: number
  travelerId: string
  tripId: string
}

export interface AssistantRoomSnapshot {
  hotelId: string
  hotelName: string
  id: string
  name: string
  occupants: string[]
  tripId: string
}

export interface AssistantStructureSnapshot {
  buses: Array<{ id: string; label: string; capacity: number }>
  hotels: Array<{ id: string; name: string }>
}

export interface AssistantTripSnapshot {
  price: number
  tripId: string
  tripName: string
  travelers: AssistantTravelerSnapshot[]
  payments: AssistantPaymentSnapshot[]
  rooms: AssistantRoomSnapshot[]
  seats: AssistantSeatSnapshot[]
  structures?: AssistantStructureSnapshot
}

export type QueryField =
  | 'active'
  | 'allocationState'
  | 'balance'
  | 'hasHotel'
  | 'hasPayment'
  | 'hasSeat'
  | 'paidPercentage'
  | 'paymentStatus'
  | 'pendingReceipt'
  | 'profileComplete'

export type QueryOperator = 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte' | 'in'

export type QueryCondition =
  | { field: QueryField; operator: QueryOperator; value: unknown }
  | { all: QueryCondition[] }
  | { any: QueryCondition[] }
  | { not: QueryCondition }
  | { xor: QueryCondition[] }

export type QueryResultField = 'financial' | 'hotel' | 'missingProfile' | 'name' | 'seat'

export interface AssistantQuery {
  entity?: 'buses' | 'hotels' | 'rooms' | 'travelers'
  excludeCancelled?: boolean
  fields?: QueryResultField[]
  kind: 'allocation_breakdown' | 'financial_summary' | 'seat_duplicates' | 'structure_list' | 'traveler_filter'
  limit?: number
  scope?: 'previous' | 'trip'
  sort?: 'debt_desc' | 'name' | 'paid_desc'
  where?: QueryCondition
}

export interface AssistantQueryContext {
  queryKind: AssistantQuery['kind']
  travelerIds: string[]
  tripId: string
}

export interface AssistantQueryResult {
  answer: string
  context: AssistantQueryContext
}

interface TravelerView {
  active: boolean
  allocationState: 'both' | 'hotel_only' | 'none' | 'seat_only'
  approvedReceipts: number
  balance: number
  confirmedAmount: number
  financialStatus: FinancialStatus
  hasHotel: boolean
  hasPayment: boolean
  hasSeat: boolean
  hotelLabel: string
  id: string
  missingProfile: string[]
  name: string
  paidPercentage: number
  paidInstallments: number
  pendingReceipts: number
  seatLabel: string
}

const queryFields = new Set<QueryField>([
  'active', 'allocationState', 'balance', 'hasHotel', 'hasPayment', 'hasSeat',
  'paidPercentage', 'paymentStatus', 'pendingReceipt', 'profileComplete',
])
const queryOperators = new Set<QueryOperator>(['eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'in'])
const resultFields = new Set<QueryResultField>(['financial', 'hotel', 'missingProfile', 'name', 'seat'])
const queryKinds = new Set<AssistantQuery['kind']>([
  'allocation_breakdown', 'financial_summary', 'seat_duplicates', 'structure_list', 'traveler_filter',
])
const financialStatuses = new Set<FinancialStatus>(['complete', 'partial', 'unpaid', 'unconfigured', 'overpaid'])
const allocationStates = new Set(['both', 'hotel_only', 'none', 'seat_only'])

function plainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function validPredicateValue(field: QueryField, operator: QueryOperator, value: unknown) {
  const values = operator === 'in' ? value : [value]
  if (!Array.isArray(values) || values.length === 0 || values.length > 10) return false
  const equalityOperator = operator === 'eq' || operator === 'neq' || operator === 'in'
  if (field === 'paymentStatus') return equalityOperator && values.every((item) => typeof item === 'string' && financialStatuses.has(item as FinancialStatus))
  if (field === 'allocationState') return equalityOperator && values.every((item) => typeof item === 'string' && allocationStates.has(item))
  if (field === 'balance' || field === 'paidPercentage') return operator !== 'in' && values.every((item) => typeof item === 'number' && Number.isFinite(item))
  return equalityOperator && values.every((item) => typeof item === 'boolean')
}

function conditionFromUnknown(value: unknown, depth = 0): QueryCondition | null {
  if (!plainObject(value) || depth > 4) return null
  if (typeof value.field === 'string' && queryFields.has(value.field as QueryField)
    && typeof value.operator === 'string' && queryOperators.has(value.operator as QueryOperator)
    && validPredicateValue(value.field as QueryField, value.operator as QueryOperator, value.value)) {
    return { field: value.field as QueryField, operator: value.operator as QueryOperator, value: value.value }
  }
  for (const logic of ['all', 'any', 'xor'] as const) {
    if (Array.isArray(value[logic]) && value[logic].length > 0 && value[logic].length <= 12) {
      const conditions = value[logic].map((item) => conditionFromUnknown(item, depth + 1))
      if (conditions.every((item): item is QueryCondition => item !== null)) return { [logic]: conditions } as QueryCondition
    }
  }
  if ('not' in value) {
    const condition = conditionFromUnknown(value.not, depth + 1)
    if (condition) return { not: condition }
  }
  return null
}

export function queryFromUnknown(value: unknown): AssistantQuery | null {
  if (!plainObject(value) || typeof value.kind !== 'string' || !queryKinds.has(value.kind as AssistantQuery['kind'])) return null
  const query: AssistantQuery = { kind: value.kind as AssistantQuery['kind'] }
  if (value.scope === 'previous' || value.scope === 'trip') query.scope = value.scope
  if (value.excludeCancelled === false || value.excludeCancelled === true) query.excludeCancelled = value.excludeCancelled
  if (value.sort === 'debt_desc' || value.sort === 'name' || value.sort === 'paid_desc') query.sort = value.sort
  if (Number.isInteger(value.limit)) query.limit = Math.min(100, Math.max(1, Number(value.limit)))
  if (value.entity === 'buses' || value.entity === 'hotels' || value.entity === 'rooms' || value.entity === 'travelers') query.entity = value.entity
  if (Array.isArray(value.fields)) {
    query.fields = [...new Set(value.fields.filter((field): field is QueryResultField => typeof field === 'string' && resultFields.has(field as QueryResultField)))]
  }
  if ('where' in value) {
    const where = conditionFromUnknown(value.where)
    if (!where) return null
    query.where = where
  }
  return query
}

function normalized(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9%]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function distance(left: string, right: string) {
  const rows = Array.from({ length: left.length + 1 }, (_, index) => index)
  for (let column = 1; column <= right.length; column += 1) {
    let previous = rows[0]
    rows[0] = column
    for (let row = 1; row <= left.length; row += 1) {
      const current = rows[row]
      rows[row] = Math.min(rows[row] + 1, rows[row - 1] + 1, previous + (left[row - 1] === right[column - 1] ? 0 : 1))
      previous = current
    }
  }
  return rows[left.length]
}

function hasConcept(text: string, terms: string[]) {
  const words = text.split(' ')
  return terms.some((term) => words.some((word) => word === term || (term.length >= 5 && distance(word, term) <= 1)))
}

const predicate = (field: QueryField, value: unknown, operator: QueryOperator = 'eq'): QueryCondition => ({ field, operator, value })

export function parseLocalAssistantQuery(command: string): AssistantQuery | null {
  const text = normalized(command)
  if (!text) return null
  if (/\b(cadastre|adicione|registre|distribua|organize|acomode|atribua|aloque|coloque|defina|reserve|mude|mova|transfira)\b/.test(text)) return null
  const payment = hasConcept(text, ['pagamento', 'pagamentos', 'pagou', 'pagaram', 'pagar', 'pago', 'pagos', 'parcela', 'parcelas', 'quitou', 'quitaram', 'quitado', 'quito', 'financeiro', 'financeiramente', 'devendo', 'divida', 'debito', 'arrecadacao'])
  const seat = hasConcept(text, ['assento', 'assentos', 'acento', 'acentos', 'onibus', 'poltrona', 'transporte'])
  const hotel = hasConcept(text, ['hotel', 'hoteis', 'quarto', 'quartos', 'hospedagem'])
  const followUp = /\b(desses|destes|dessas|destas|deles|delas|desse grupo|dessas pessoas|dos cinco)\b/.test(text)
  const scope: AssistantQuery['scope'] = followUp ? 'previous' : 'trip'

  if (hotel && /lotad|sem vagas?/.test(text)) return null

  if (seat && hasConcept(text, ['duplicado', 'duplicados', 'repetido', 'conflito', 'inconsistencia'])) {
    return { kind: 'seat_duplicates', scope }
  }
  if (payment && (hasConcept(text, ['arrecadacao', 'levantamento', 'resumo', 'balanco'])
    || /\b(soma|somar|total).*(recebid|pag)/.test(text)
    || /quanto.*(falta|resta).*receber/.test(text))) {
    return { kind: 'financial_summary', excludeCancelled: true, scope }
  }
  if (seat && hotel && ((/ao mesmo tempo/.test(text) && /(so|somente|apenas) um/.test(text))
    || /categor/.test(text))) {
    return { kind: 'allocation_breakdown', scope }
  }
  if (/\b(liste|listar|mostre|mostrar|quais|relacione)\b/.test(text)) {
    if (hasConcept(text, ['viajante', 'viajantes', 'pessoa', 'pessoas', 'passageiro', 'passageiros']) && !payment && !seat && !hotel) {
      return { entity: 'travelers', kind: 'structure_list', scope }
    }
    if (hasConcept(text, ['onibus']) && !payment && !hotel) return { entity: 'buses', kind: 'structure_list', scope }
    if (hotel && !followUp && !payment && !seat && !/nao|sem/.test(text)) return { entity: /quarto/.test(text) ? 'rooms' : 'hotels', kind: 'structure_list', scope }
  }

  const conditions: QueryCondition[] = []
  const fields = new Set<QueryResultField>(['name'])
  const bothMissing = seat && hotel && (
    /(?:nao (?:tem|possui|escolheu)|sem) (?:assento|acento|onibus|hotel|quarto).*(?:e|nem).*(?:assento|acento|onibus|hotel|quarto)/.test(text)
    || /nem (?:assento|acento|onibus|hotel|quarto).*nem (?:assento|acento|onibus|hotel|quarto)/.test(text)
  )
  const xorAllocation = seat && hotel && (/(so|somente|apenas) um/.test(text) || /nao (?:os )?dois/.test(text))
  if (xorAllocation) {
    conditions.push(predicate('allocationState', ['hotel_only', 'seat_only'], 'in'))
    fields.add('hotel'); fields.add('seat')
  } else if (bothMissing) {
    conditions.push(predicate('hasHotel', false), predicate('hasSeat', false))
    fields.add('hotel'); fields.add('seat')
  } else {
    const noSeat = seat && /(?:sem|nao (?:tem|possui|possuiu|escolheu|selecionou))[^.?!]{0,35}(?:assento|acento|onibus|poltrona)/.test(text)
    const noHotel = hotel && /(?:sem|nao (?:tem|possui|possuiu|escolheu|reservou))[^.?!]{0,35}(?:hotel|quarto|hospedagem)/.test(text)
    if (seat) { conditions.push(predicate('hasSeat', !noSeat)); fields.add('seat') }
    if (hotel) { conditions.push(predicate('hasHotel', !noHotel)); fields.add('hotel') }
  }

  if (payment) {
    fields.add('financial')
    if (/comprovantes? pendentes?|aguardando aprovacao/.test(text)) {
      conditions.push(predicate('pendingReceipt', true))
    } else if (/menos (?:que |de |da |do )?(?:a )?metade|abaixo (?:de |dos )?50|menor (?:que |de )?50/.test(text)) {
      conditions.push(predicate('paidPercentage', 50, 'lt'))
    } else if (/mais (?:que |de )?(?:a )?metade|acima (?:de |dos )?50|maior (?:que |de )?50/.test(text)) {
      conditions.push(predicate('paidPercentage', 50, 'gt'))
    } else if (/quitad|\bquito\b|pagou tudo|pago tudo|pagamento integral|100 ?%/.test(text)) {
      conditions.push(predicate('paymentStatus', 'complete'))
    } else if (/pagamento parcial|pagou parcialmente|parciais?/.test(text)) {
      conditions.push(predicate('paymentStatus', 'partial'))
    } else if (/nao pagou|sem nenhum pagamento|pagou nada|zerad[oa]s? financeir|nenhum pagamento confirmado/.test(text)) {
      conditions.push(predicate('paymentStatus', ['unpaid', 'unconfigured'], 'in'))
    } else if (/pagamento pendente|pagamentos pendentes|esta devendo|estao devendo|mais devem|mais devendo|saldo pendente/.test(text)) {
      conditions.push(predicate('balance', 0, 'gt'))
    } else if (/sem (?:informacao|informacoes|dados) de pagamento|sem pagamento configurado/.test(text)) {
      conditions.push(predicate('hasPayment', false))
    }
  }

  const noInformation = /nenhuma (?:informacao|informacoes)|sem (?:qualquer|nenhuma) informacao/.test(text)
  if (noInformation) {
    conditions.length = 0
    conditions.push(predicate('hasPayment', false), predicate('hasHotel', false), predicate('hasSeat', false))
    fields.add('financial'); fields.add('hotel'); fields.add('seat')
  }
  if (/cadastro incompleto|informacoes? (?:nao preenchidas|faltando)|dados incompletos/.test(text)) {
    conditions.push(predicate('profileComplete', false)); fields.add('missingProfile')
  }

  if (!conditions.length) return null
  const isOr = !noInformation && /\bou\b/.test(text) && !xorAllocation && !/\bnem\b/.test(text)
  const query: AssistantQuery = {
    excludeCancelled: !/inclu[ai].*cancelad/.test(text),
    fields: [...fields],
    kind: 'traveler_filter',
    scope,
    where: conditions.length === 1 ? conditions[0] : isOr ? { any: conditions } : { all: conditions },
  }
  if (/cinco|\b5\b/.test(text) && /mais (?:estao )?(?:devendo|devem)|maiores? (?:dividas?|saldos?)/.test(text)) {
    query.limit = 5
    query.sort = 'debt_desc'
  }
  return query
}

function money(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function roundMoney(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100
}

function travelerViews(snapshot: AssistantTripSnapshot): TravelerView[] {
  const payments = new Map(snapshot.payments.filter((item) => item.tripId === snapshot.tripId).map((item) => [item.travelerId, item]))
  const seatsByTraveler = new Map<string, AssistantSeatSnapshot[]>()
  snapshot.seats.filter((item) => item.tripId === snapshot.tripId).forEach((item) => seatsByTraveler.set(item.travelerId, [...(seatsByTraveler.get(item.travelerId) ?? []), item]))
  const roomsByTraveler = new Map<string, AssistantRoomSnapshot[]>()
  snapshot.rooms.filter((item) => item.tripId === snapshot.tripId).forEach((room) => room.occupants.forEach((id) => roomsByTraveler.set(id, [...(roomsByTraveler.get(id) ?? []), room])))
  const due = Math.max(0, Number(snapshot.price) || 0)

  return snapshot.travelers.filter((item) => item.tripId === snapshot.tripId).map((traveler) => {
    const payment = payments.get(traveler.id)
    const total = Math.max(0, Math.trunc(payment?.totalInstallments ?? 0))
    const paid = Math.max(0, Math.trunc(payment?.paidInstallments ?? 0))
    const confirmedAmount = payment && total > 0 ? roundMoney(due * (paid / total)) : 0
    const balance = roundMoney(Math.max(0, due - confirmedAmount))
    const financialStatus: FinancialStatus = !payment
      ? 'unconfigured'
      : confirmedAmount > due
        ? 'overpaid'
        : confirmedAmount <= 0 && due > 0
          ? 'unpaid'
          : confirmedAmount >= due
            ? 'complete'
            : 'partial'
    const seats = seatsByTraveler.get(traveler.id) ?? []
    const rooms = roomsByTraveler.get(traveler.id) ?? []
    const missingProfile: string[] = []
    if (!traveler.name.trim()) missingProfile.push('nome')
    if (!traveler.birthdate) missingProfile.push('data de nascimento')
    if (traveler.married && !traveler.spouseName?.trim()) missingProfile.push('cônjuge')
    if (traveler.hasKids && !(traveler.childNames ?? []).length) missingProfile.push('filhos')
    const hasSeat = seats.length > 0
    const hasHotel = rooms.length > 0
    return {
      active: traveler.status !== 'cancelled',
      allocationState: hasHotel && hasSeat ? 'both' : hasHotel ? 'hotel_only' : hasSeat ? 'seat_only' : 'none',
      approvedReceipts: payment?.receipts.filter((receipt) => receipt.status === 'approved').length ?? 0,
      balance,
      confirmedAmount,
      financialStatus,
      hasHotel,
      hasPayment: Boolean(payment),
      hasSeat,
      hotelLabel: rooms.map((room) => `${room.hotelName} · ${room.name}`).join('; '),
      id: traveler.id,
      missingProfile,
      name: traveler.name || 'Viajante sem nome',
      paidPercentage: due > 0 ? (confirmedAmount / due) * 100 : confirmedAmount > 0 ? 100 : 0,
      paidInstallments: paid,
      pendingReceipts: payment?.receipts.filter((receipt) => receipt.status === 'pending').length ?? 0,
      seatLabel: seats.map((seat) => `${seat.busLabel || `ônibus ${seat.busId}`}, piso ${seat.floor}, assento ${seat.seatNumber}`).join('; '),
    }
  })
}

function valueFor(view: TravelerView, field: QueryField): unknown {
  const values: Record<QueryField, unknown> = {
    active: view.active,
    allocationState: view.allocationState,
    balance: view.balance,
    hasHotel: view.hasHotel,
    hasPayment: view.hasPayment,
    hasSeat: view.hasSeat,
    paidPercentage: view.paidPercentage,
    paymentStatus: view.financialStatus,
    pendingReceipt: view.pendingReceipts > 0,
    profileComplete: view.missingProfile.length === 0,
  }
  return values[field]
}

function matchesPredicate(view: TravelerView, condition: Extract<QueryCondition, { field: QueryField }>) {
  const actual = valueFor(view, condition.field)
  if (condition.operator === 'in') return Array.isArray(condition.value) && condition.value.includes(actual)
  if (condition.operator === 'eq') return actual === condition.value
  if (condition.operator === 'neq') return actual !== condition.value
  if (typeof actual !== 'number' || typeof condition.value !== 'number') return false
  if (condition.operator === 'lt') return actual < condition.value
  if (condition.operator === 'lte') return actual <= condition.value
  if (condition.operator === 'gt') return actual > condition.value
  return actual >= condition.value
}

function matches(view: TravelerView, condition: QueryCondition): boolean {
  if ('field' in condition) return matchesPredicate(view, condition)
  if ('all' in condition) return condition.all.every((item) => matches(view, item))
  if ('any' in condition) return condition.any.some((item) => matches(view, item))
  if ('not' in condition) return !matches(view, condition.not)
  return condition.xor.filter((item) => matches(view, item)).length === 1
}

function lineFor(view: TravelerView, fields: QueryResultField[]) {
  const details: string[] = []
  if (fields.includes('financial')) details.push(`${money(view.confirmedAmount)} recebido; ${money(view.balance)} pendente; ${Math.round(view.paidPercentage)}%`)
  if (fields.includes('hotel')) details.push(view.hasHotel ? `hotel: ${view.hotelLabel}` : 'sem hotel')
  if (fields.includes('seat')) details.push(view.hasSeat ? `assento: ${view.seatLabel}` : 'sem assento')
  if (fields.includes('missingProfile')) details.push(view.missingProfile.length ? `faltando: ${view.missingProfile.join(', ')}` : 'cadastro completo')
  return `- ${view.name}${details.length ? ` — ${details.join(' · ')}` : ''}`
}

function category(title: string, views: TravelerView[]) {
  return [`${title} (${views.length})`, ...(views.length ? views.map((view) => `- ${view.name}`) : ['- Nenhum viajante.'])].join('\n')
}

export function sanitizePreviousTravelerIds(snapshot: AssistantTripSnapshot, context: AssistantQueryContext | null | undefined) {
  if (!context || context.tripId !== snapshot.tripId) return []
  const members = new Set(snapshot.travelers.filter((item) => item.tripId === snapshot.tripId).map((item) => item.id))
  return [...new Set(context.travelerIds.filter((id) => members.has(id)))].slice(0, 2000)
}

export function executeAssistantQuery(
  query: AssistantQuery,
  snapshot: AssistantTripSnapshot,
  previousContext?: AssistantQueryContext | null,
): AssistantQueryResult {
  const allViews = travelerViews(snapshot)
  const previousIds = new Set(sanitizePreviousTravelerIds(snapshot, previousContext))
  let scoped = query.scope === 'previous' ? allViews.filter((view) => previousIds.has(view.id)) : allViews
  if (query.scope === 'previous' && previousIds.size === 0) {
    return { answer: 'Não há um grupo anterior válido nesta conversa. Faça primeiro a consulta que define as pessoas.', context: { queryKind: query.kind, travelerIds: [], tripId: snapshot.tripId } }
  }
  if (query.excludeCancelled !== false) scoped = scoped.filter((view) => view.active)

  if (query.kind === 'financial_summary') {
    const expected = roundMoney(scoped.reduce((total) => total + Math.max(0, snapshot.price), 0))
    const received = roundMoney(scoped.reduce((total, view) => total + view.confirmedAmount, 0))
    const pending = roundMoney(scoped.reduce((total, view) => total + view.balance, 0))
    const inconsistencies = scoped.filter((view) => view.approvedReceipts !== 0 && view.approvedReceipts !== view.paidInstallments)
    const answer = [
      `Levantamento financeiro — ${snapshot.tripName}`,
      '',
      `- Viajantes ativos considerados: ${scoped.length}`,
      `- Valor total previsto: ${money(expected)}`,
      `- Valor efetivamente confirmado: ${money(received)}`,
      `- Saldo pendente: ${money(pending)}`,
      `- Percentual arrecadado: ${expected > 0 ? ((received / expected) * 100).toFixed(1) : '0,0'}%`,
      `- Inconsistências entre parcelas e comprovantes aprovados: ${inconsistencies.length}`,
    ].join('\n')
    return { answer, context: { queryKind: query.kind, travelerIds: scoped.map((view) => view.id), tripId: snapshot.tripId } }
  }

  if (query.kind === 'allocation_breakdown') {
    const none = scoped.filter((view) => view.allocationState === 'none')
    const seatOnly = scoped.filter((view) => view.allocationState === 'seat_only')
    const hotelOnly = scoped.filter((view) => view.allocationState === 'hotel_only')
    const both = scoped.filter((view) => view.allocationState === 'both')
    return {
      answer: ['Situação de hotel e assento', '', category('Sem assento e sem hotel', none), '', category('Com assento, mas sem hotel', seatOnly), '', category('Com hotel, mas sem assento', hotelOnly), '', category('Com ambos', both)].join('\n'),
      context: { queryKind: query.kind, travelerIds: [...none, ...seatOnly, ...hotelOnly, ...both].map((view) => view.id), tripId: snapshot.tripId },
    }
  }

  if (query.kind === 'seat_duplicates') {
    const seats = snapshot.seats.filter((item) => item.tripId === snapshot.tripId)
    const byPosition = new Map<string, AssistantSeatSnapshot[]>()
    const byTraveler = new Map<string, AssistantSeatSnapshot[]>()
    seats.forEach((seat) => {
      const key = `${seat.busId}:${seat.floor}:${seat.seatNumber}`
      byPosition.set(key, [...(byPosition.get(key) ?? []), seat])
      byTraveler.set(seat.travelerId, [...(byTraveler.get(seat.travelerId) ?? []), seat])
    })
    const positionDuplicates = [...byPosition.entries()].filter(([, values]) => values.length > 1)
    const travelerDuplicates = [...byTraveler.entries()].filter(([, values]) => values.length > 1)
    const names = new Map(allViews.map((view) => [view.id, view.name]))
    const lines = [
      ...positionDuplicates.map(([key, values]) => `- Assento ${key.replaceAll(':', ' · ')} atribuído ${values.length} vezes.`),
      ...travelerDuplicates.map(([id, values]) => `- ${names.get(id) ?? id} possui ${values.length} assentos.`),
    ]
    return { answer: lines.length ? `Inconsistências de assentos (${lines.length})\n\n${lines.join('\n')}` : 'Inconsistências de assentos\n\nNenhum assento duplicado foi encontrado.', context: { queryKind: query.kind, travelerIds: travelerDuplicates.map(([id]) => id), tripId: snapshot.tripId } }
  }

  if (query.kind === 'structure_list') {
    const structures = snapshot.structures ?? { buses: [], hotels: [] }
    if (query.entity === 'buses') return { answer: structures.buses.length ? `Ônibus (${structures.buses.length})\n\n${structures.buses.map((bus) => `- ${bus.label} — ${bus.capacity} assentos`).join('\n')}` : 'Ônibus\n\nNenhum ônibus cadastrado.', context: { queryKind: query.kind, travelerIds: [], tripId: snapshot.tripId } }
    if (query.entity === 'hotels') return { answer: structures.hotels.length ? `Hotéis (${structures.hotels.length})\n\n${structures.hotels.map((hotel) => `- ${hotel.name}`).join('\n')}` : 'Hotéis\n\nNenhum hotel cadastrado.', context: { queryKind: query.kind, travelerIds: [], tripId: snapshot.tripId } }
    if (query.entity === 'rooms') return { answer: snapshot.rooms.length ? `Quartos (${snapshot.rooms.length})\n\n${snapshot.rooms.map((room) => `- ${room.hotelName} · ${room.name} — ${room.occupants.length} ocupante(s)`).join('\n')}` : 'Quartos\n\nNenhum quarto cadastrado.', context: { queryKind: query.kind, travelerIds: [], tripId: snapshot.tripId } }
    return { answer: scoped.length ? `Viajantes (${scoped.length})\n\n${scoped.map((view) => `- ${view.name}`).join('\n')}` : 'Viajantes\n\nNenhum viajante encontrado.', context: { queryKind: query.kind, travelerIds: scoped.map((view) => view.id), tripId: snapshot.tripId } }
  }

  let result = query.where ? scoped.filter((view) => matches(view, query.where!)) : scoped
  if (query.sort === 'debt_desc') result = [...result].sort((left, right) => right.balance - left.balance || left.name.localeCompare(right.name, 'pt-BR'))
  else if (query.sort === 'paid_desc') result = [...result].sort((left, right) => right.confirmedAmount - left.confirmedAmount || left.name.localeCompare(right.name, 'pt-BR'))
  else result = [...result].sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))
  if (query.limit) result = result.slice(0, query.limit)
  const fields: QueryResultField[] = query.fields?.length ? query.fields : ['name']
  const answer = result.length
    ? `Viajantes encontrados (${result.length})\n\n${result.map((view) => lineFor(view, fields)).join('\n')}`
    : 'Viajantes encontrados (0)\n\nNenhum viajante corresponde aos critérios solicitados.'
  return { answer, context: { queryKind: query.kind, travelerIds: result.map((view) => view.id), tripId: snapshot.tripId } }
}
