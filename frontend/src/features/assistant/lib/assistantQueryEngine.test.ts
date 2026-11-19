import { describe, expect, it } from 'vitest'
import {
  executeAssistantQuery,
  parseLocalAssistantQuery,
  queryFromUnknown,
  type AssistantQuery,
  type AssistantTripSnapshot,
} from '../../../../../supabase/functions/_shared/assistantQueryEngine'

const tripId = '10000000-0000-0000-0000-000000000001'
const otherTripId = '10000000-0000-0000-0000-000000000002'
const ids = {
  ana: '20000000-0000-0000-0000-000000000001',
  beto: '20000000-0000-0000-0000-000000000002',
  carla: '20000000-0000-0000-0000-000000000003',
  diego: '20000000-0000-0000-0000-000000000004',
  eva: '20000000-0000-0000-0000-000000000005',
  fabio: '20000000-0000-0000-0000-000000000006',
  gabi: '20000000-0000-0000-0000-000000000007',
  hugo: '20000000-0000-0000-0000-000000000008',
  foreign: '20000000-0000-0000-0000-000000000009',
}

function payment(id: string, paid: number, total = 4, receiptStatus: 'approved' | 'pending' = 'approved') {
  return {
    id: `payment-${id}`,
    paidInstallments: paid,
    receipts: Array.from({ length: Math.max(1, paid) }, (_, index) => ({ installment: index + 1, status: receiptStatus })),
    totalInstallments: total,
    travelerId: id,
    tripId,
  }
}

const snapshot: AssistantTripSnapshot = {
  price: 1000,
  tripId,
  tripName: 'Retiro',
  travelers: [
    [ids.ana, 'Ana', 'active'], [ids.beto, 'Beto', 'active'], [ids.carla, 'Carla', 'active'],
    [ids.diego, 'Diego', 'active'], [ids.eva, 'Eva', 'active'], [ids.fabio, 'Fábio', 'active'],
    [ids.gabi, 'Gabi', 'active'], [ids.hugo, 'Hugo', 'cancelled'],
  ].map(([id, name, status]) => ({ birthdate: '1990-01-01', id, name, status: status as 'active' | 'cancelled', tripId })),
  payments: [
    payment(ids.ana, 4), payment(ids.beto, 0, 4, 'pending'), payment(ids.carla, 2),
    payment(ids.eva, 5), payment(ids.fabio, 4), payment(ids.gabi, 1), payment(ids.hugo, 4),
  ],
  rooms: [
    { hotelId: 'hotel-1', hotelName: 'Central', id: 'room-1', name: '101', occupants: [ids.beto, ids.carla], tripId },
    { hotelId: 'hotel-1', hotelName: 'Central', id: 'room-2', name: '102', occupants: [ids.eva, ids.hugo], tripId },
  ],
  seats: [
    { busId: 'bus-1', busLabel: 'Executivo', floor: 1, id: 'seat-1', seatNumber: 1, travelerId: ids.ana, tripId },
    { busId: 'bus-1', busLabel: 'Executivo', floor: 1, id: 'seat-2', seatNumber: 2, travelerId: ids.carla, tripId },
    { busId: 'bus-1', busLabel: 'Executivo', floor: 1, id: 'seat-3', seatNumber: 3, travelerId: ids.eva, tripId },
    { busId: 'bus-1', busLabel: 'Executivo', floor: 1, id: 'seat-4', seatNumber: 4, travelerId: ids.gabi, tripId },
  ],
  structures: { buses: [{ id: 'bus-1', label: 'Executivo', capacity: 44 }], hotels: [{ id: 'hotel-1', name: 'Central' }] },
}

function run(query: AssistantQuery, source = snapshot) {
  return executeAssistantQuery(query, source)
}

function names(result: ReturnType<typeof run>) {
  return result.context.travelerIds
}

describe('motor de consultas do assistente', () => {
  it('1. identifica viajantes que quitaram a viagem', () => {
    expect(names(run({ kind: 'traveler_filter', where: { field: 'paymentStatus', operator: 'eq', value: 'complete' } }))).toEqual([ids.ana, ids.fabio])
  })

  it('2. identifica viajantes sem pagamento confirmado', () => {
    const result = run({ kind: 'traveler_filter', where: { field: 'paymentStatus', operator: 'in', value: ['unpaid', 'unconfigured'] } })
    expect(names(result)).toEqual([ids.beto, ids.diego])
  })

  it('3. identifica pagamentos parciais', () => {
    expect(names(run({ kind: 'traveler_filter', where: { field: 'paymentStatus', operator: 'eq', value: 'partial' } }))).toEqual([ids.carla, ids.gabi])
  })

  it.each([
    ['none', [ids.diego, ids.fabio]],
    ['hotel_only', [ids.beto]],
    ['seat_only', [ids.ana, ids.gabi]],
    ['both', [ids.carla, ids.eva]],
  ] as const)('4–7. classifica alocação %s sem categorias contraditórias', (state, expected) => {
    expect(names(run({ kind: 'traveler_filter', where: { field: 'allocationState', operator: 'eq', value: state } }))).toEqual(expected)
  })

  it('8. cruza hotel confirmado com saldo financeiro pendente', () => {
    const result = run({ kind: 'traveler_filter', where: { all: [
      { field: 'hasHotel', operator: 'eq', value: true },
      { field: 'balance', operator: 'gt', value: 0 },
    ] } })
    expect(names(result)).toEqual([ids.beto, ids.carla])
  })

  it('9–10. calcula arrecadação e saldo pendente com valores confirmados', () => {
    const answer = run({ kind: 'financial_summary' }).answer
    expect(answer).toContain('Valor total previsto: R$ 7.000,00')
    expect(answer).toContain('Valor efetivamente confirmado: R$ 4.000,00')
    expect(answer).toContain('Saldo pendente: R$ 3.250,00')
  })

  it('11. identifica pagamento acima do valor devido', () => {
    expect(names(run({ kind: 'traveler_filter', where: { field: 'paymentStatus', operator: 'eq', value: 'overpaid' } }))).toEqual([ids.eva])
  })

  it('12. ignora cancelados por padrão e inclui quando solicitado', () => {
    const query: AssistantQuery = { kind: 'traveler_filter', where: { field: 'paymentStatus', operator: 'eq', value: 'complete' } }
    expect(names(run(query))).not.toContain(ids.hugo)
    expect(names(run({ ...query, excludeCancelled: false }))).toContain(ids.hugo)
  })

  it('13. encontra assentos duplicados e viajantes com mais de um assento', () => {
    const duplicated: AssistantTripSnapshot = {
      ...snapshot,
      seats: [
        ...snapshot.seats,
        { ...snapshot.seats[0], id: 'seat-duplicate-position', travelerId: ids.beto },
        { ...snapshot.seats[0], id: 'seat-duplicate-traveler', seatNumber: 5 },
      ],
    }
    const result = run({ kind: 'seat_duplicates' }, duplicated)
    expect(result.answer).toContain('atribuído 2 vezes')
    expect(result.answer).toContain('Ana possui 2 assentos')
  })

  it('14. tolera erros ortográficos em perguntas', () => {
    const query = parseLocalAssistantQuery('Quem ja quito a viajem mas ta sem acento?')
    expect(query).not.toBeNull()
    expect(names(run(query!))).toEqual([ids.fabio])
  })

  it('15. aplica múltiplas condições AND e XOR corretamente', () => {
    const query = parseLocalAssistantQuery('Quais viajantes possuem pagamento pendente, hotel confirmado e assento selecionado ao mesmo tempo?')
    expect(names(run(query!))).toEqual([ids.carla])
    const xor = parseLocalAssistantQuery('Quem escolheu hotel ou assento, mas não os dois?')
    expect(names(run(xor!))).toEqual([ids.ana, ids.beto, ids.gabi])
  })

  it('aplica OR e NOT como operadores estruturados', () => {
    const orResult = run({ kind: 'traveler_filter', where: { any: [
      { field: 'paymentStatus', operator: 'eq', value: 'complete' },
      { field: 'hasHotel', operator: 'eq', value: true },
    ] } })
    expect(names(orResult)).toEqual([ids.ana, ids.beto, ids.carla, ids.eva, ids.fabio])
    const notResult = run({ kind: 'traveler_filter', where: { not: { field: 'hasSeat', operator: 'eq', value: true } } })
    expect(names(notResult)).toEqual([ids.beto, ids.diego, ids.fabio])
  })

  it('16. mantém o grupo anterior em perguntas complementares', () => {
    const first = parseLocalAssistantQuery('Quais são os cinco viajantes que mais estão devendo?')!
    const firstResult = run(first)
    const followUp = parseLocalAssistantQuery('Desses cinco, quais já escolheram hotel?')!
    const second = executeAssistantQuery(followUp, snapshot, firstResult.context)
    expect(names(second)).toEqual([ids.beto, ids.carla])
  })

  it('17. perguntas diferentes geram consultas e resultados diferentes', () => {
    const unpaid = run(parseLocalAssistantQuery('Quem ainda não pagou?')!)
    const paidWithoutSeat = run(parseLocalAssistantQuery('Quem pagou tudo mas ainda não escolheu assento?')!)
    expect(names(unpaid)).not.toEqual(names(paidWithoutSeat))
    expect(names(paidWithoutSeat)).toEqual([ids.fabio])
  })

  it('18. nunca retorna viajante pertencente a outra viagem', () => {
    const contaminated: AssistantTripSnapshot = {
      ...snapshot,
      travelers: [...snapshot.travelers, { birthdate: '1990-01-01', id: ids.foreign, name: 'Outra viagem', status: 'active', tripId: otherTripId }],
    }
    expect(names(run({ entity: 'travelers', kind: 'structure_list' }, contaminated))).not.toContain(ids.foreign)
  })

  it.each([
    'Quem ainda não pagou?',
    'Quais pessoas estão sem nenhum pagamento?',
    'Tem alguém que não pagou nada ainda?',
    'Me mostra os viajantes que estão zerados financeiramente.',
  ])('interpreta perguntas equivalentes: %s', (question) => {
    expect(names(run(parseLocalAssistantQuery(question)!))).toEqual([ids.beto, ids.diego])
  })

  it('interpreta hotel confirmado com menos da metade paga', () => {
    const query = parseLocalAssistantQuery('Quais viajantes tem hotel confirmado, mas pagaram menos da metade do valor?')
    expect(names(run(query!))).toEqual([ids.beto])
  })

  it('identifica quem não possui pagamento, hotel nem assento', () => {
    const query = parseLocalAssistantQuery('Quais viajantes não possuem nenhuma informação de pagamento, hotel ou assento?')
    expect(names(run(query!))).toEqual([ids.diego])
  })

  it('valida a consulta produzida pelo modelo e rejeita campos não permitidos', () => {
    expect(queryFromUnknown({
      kind: 'traveler_filter',
      tripId: otherTripId,
      where: { field: 'hasHotel', operator: 'eq', value: true },
    })).toEqual({ kind: 'traveler_filter', where: { field: 'hasHotel', operator: 'eq', value: true } })
    expect(queryFromUnknown({
      kind: 'traveler_filter',
      where: { field: 'sql', operator: 'eq', value: 'drop table' },
    })).toBeNull()
    expect(queryFromUnknown({
      kind: 'traveler_filter',
      where: { field: 'paymentStatus', operator: 'eq', value: 'cancelled' },
    })).toBeNull()
  })

  it('não confunde comandos de alteração com consultas', () => {
    expect(parseLocalAssistantQuery('Distribua as pessoas pelos ônibus disponíveis')).toBeNull()
    expect(parseLocalAssistantQuery('Mude a família Silva para o ônibus 3')).toBeNull()
    expect(parseLocalAssistantQuery('Quais hotéis estão lotados?')).toBeNull()
  })

  it('separa as quatro categorias solicitadas no levantamento de alocações', () => {
    const query = parseLocalAssistantQuery('Quem não escolheu assento e hotel ao mesmo tempo, e quem escolheu só um dos dois?')
    const answer = run(query!).answer
    expect(answer).toContain('Sem assento e sem hotel (2)')
    expect(answer).toContain('Com assento, mas sem hotel (2)')
    expect(answer).toContain('Com hotel, mas sem assento (1)')
    expect(answer).toContain('Com ambos (2)')
  })

  it('não mistura contexto anterior de outra viagem', () => {
    const query = parseLocalAssistantQuery('Desses cinco, quais já escolheram hotel?')!
    const result = executeAssistantQuery(query, snapshot, { queryKind: 'traveler_filter', travelerIds: [ids.beto], tripId: otherTripId })
    expect(result.context.travelerIds).toEqual([])
    expect(result.answer).toContain('Não há um grupo anterior válido')
  })
})
