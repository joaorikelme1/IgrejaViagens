import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  executeAssistantQuery,
  parseLocalAssistantQuery,
  queryFromUnknown,
  type AssistantQuery,
  type AssistantQueryContext,
  type AssistantTripSnapshot,
} from '../_shared/assistantQueryEngine.ts'

type GenericRow = Record<string, unknown>
type Database = {
  public: {
    CompositeTypes: Record<string, never>
    Enums: Record<string, string>
    Functions: Record<string, { Args: GenericRow; Returns: unknown }>
    Tables: Record<string, { Insert: GenericRow; Relationships: []; Row: GenericRow; Update: GenericRow }>
    Views: Record<string, { Relationships: []; Row: GenericRow }>
  }
}
type AdminClient = ReturnType<typeof createClient<Database>>

const headers = {
  'content-type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers })

const simpleKinds = new Set([
  'query_unassigned_seats',
  'query_unassigned_rooms',
  'query_unassigned_allocations',
  'query_full_hotels',
  'distribute_seats',
  'distribute_rooms',
  'distribute_allocations',
])

function text(value: unknown, max = 160) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function intentFrom(value: unknown) {
  if (!value || typeof value !== 'object') return null
  const intent = value as Record<string, unknown>
  const kind = text(intent.kind, 60)
  if (simpleKinds.has(kind)) return { kind }
  if (kind === 'move_family_bus') {
    const family = text(intent.family)
    const bus = text(intent.bus)
    return family && bus ? { kind, family, bus } : null
  }
  if (kind === 'move_people_hotel') {
    const hotel = text(intent.hotel)
    const people = Array.isArray(intent.people)
      ? intent.people.map((person) => text(person)).filter(Boolean).slice(0, 50)
      : []
    return hotel && people.length ? { kind, hotel, people } : null
  }
  if (kind === 'create_hotels' && Array.isArray(intent.hotels)) {
    const hotels = intent.hotels.slice(0, 20).flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const hotel = item as Record<string, unknown>
      const name = text(hotel.name)
      if (!name) return []
      const rooms = Array.isArray(hotel.rooms) ? hotel.rooms.slice(0, 200).flatMap((room) => {
        if (!room || typeof room !== 'object') return []
        const value = room as Record<string, unknown>
        const capacity = Number(value.capacity)
        const roomName = text(value.name)
        return roomName && Number.isInteger(capacity) && capacity > 0 && capacity <= 50
          ? [{ capacity, name: roomName, type: text(value.type) || 'custom' }]
          : []
      }) : []
      return [{ address: text(hotel.address), name, notes: text(hotel.notes, 500), rooms }]
    })
    return hotels.length ? { kind, hotels } : null
  }
  if (kind === 'create_buses' && Array.isArray(intent.buses)) {
    const buses = intent.buses.slice(0, 20).flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const bus = item as Record<string, unknown>
      const floors = Number(bus.floors) === 2 ? 2 : 1
      const floorOne = Number(bus.seatsFloor1)
      const floorTwo = floors === 2 ? Number(bus.seatsFloor2) : 0
      const label = text(bus.label)
      return label && Number.isInteger(floorOne) && floorOne > 0 && floorOne <= 100
        && Number.isInteger(floorTwo) && floorTwo >= 0 && floorTwo <= 100
        ? [{ company: text(bus.company), driverName: text(bus.driverName), floors, label, plate: text(bus.plate, 12).toUpperCase(), seatsFloor1: floorOne, seatsFloor2: floorTwo }]
        : []
    })
    return buses.length ? { kind, buses } : null
  }
  return null
}

function previousContextFrom(value: unknown, tripId: string): AssistantQueryContext | null {
  if (!value || typeof value !== 'object') return null
  const context = value as Record<string, unknown>
  if (context.tripId !== tripId || !Array.isArray(context.travelerIds)) return null
  const travelerIds = context.travelerIds.filter((id): id is string => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id)).slice(0, 2000)
  const kind = text(context.queryKind, 40) as AssistantQueryContext['queryKind']
  return { queryKind: kind || 'traveler_filter', travelerIds, tripId }
}

function normalized(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
}

function localOperation(command: string) {
  const value = normalized(command)
  const seat = /(onibus|assento|poltrona|transporte)/.test(value)
  const room = /(hotel|quarto|hospedagem)/.test(value)
  if (room && /lotad|sem vagas?/.test(value)) return { kind: 'query_full_hotels' }
  const acts = /(atribua|aloque|distribua|organize|acomode|coloque|defina|reserve)/.test(value)
  if (!acts) return null
  if (seat && room) return { kind: 'distribute_allocations' }
  if (seat) return { kind: 'distribute_seats' }
  if (room) return { kind: 'distribute_rooms' }
  return null
}

const systemPrompt = `Você interpreta solicitações administrativas em português. Responda SOMENTE JSON válido e nunca responda a pergunta diretamente.

Para consultas, gere {"query":{...}} usando exclusivamente este esquema:
- kind: traveler_filter | allocation_breakdown | financial_summary | seat_duplicates | structure_list
- scope: trip | previous. Use previous somente para referências como "desses cinco", "deles" ou "desse grupo".
- where: árvore opcional com {"all":[...]}, {"any":[...]}, {"xor":[...]}, {"not":...} ou predicado {"field":"...","operator":"...","value":...}.
- fields permitidos: active, allocationState, balance, hasHotel, hasPayment, hasSeat, paidPercentage, paymentStatus, pendingReceipt, profileComplete.
- operators: eq, neq, lt, lte, gt, gte, in.
- paymentStatus: complete, partial, unpaid, unconfigured, overpaid.
- allocationState: none, hotel_only, seat_only, both.
- fields de saída: name, financial, hotel, seat, missingProfile.
- sort opcional: debt_desc, paid_desc, name. limit entre 1 e 100.
- structure_list exige entity: travelers, buses, hotels ou rooms.
- excludeCancelled é true por padrão.

Traduza AND para all, OR para any, "somente um dos dois" para xor ou allocationState in [hotel_only,seat_only], e negação para not ou boolean false. "Pagou menos da metade" usa paidPercentage lt 50. "Quitou" usa paymentStatus complete. "Pagamento pendente" ou "devendo" usa balance gt 0. Não inclua tripId: o backend fixa a viagem.

Para alterações, use {"intent":{"kind":"..."}} com uma destas intenções: query_unassigned_seats, query_unassigned_rooms, query_unassigned_allocations, query_full_hotels, distribute_seats, distribute_rooms, distribute_allocations, create_hotels, create_buses, move_family_bus, move_people_hotel. Para create_hotels inclua hotels com name, address, notes e rooms [{name,capacity,type}]. Para create_buses inclua buses com label, company, driverName, plate, floors, seatsFloor1, seatsFloor2.

Se faltarem dados indispensáveis, use {"clarification":"pergunta curta"}. Tolere erros ortográficos, ausência de acentos, abreviações e linguagem informal.`

async function interpretWithGroq(command: string, previousCount: number) {
  const apiKey = Deno.env.get('GROQ_API_KEY')
  if (!apiKey) return null
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: Deno.env.get('GROQ_MODEL') || 'openai/gpt-oss-20b',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Há ${previousCount} viajante(s) no último resultado válido desta mesma viagem.\nSolicitação: ${command}` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
      max_completion_tokens: 1800,
    }),
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok) {
    console.error('Groq request failed', response.status, (await response.text()).slice(0, 500))
    return null
  }
  const completion = await response.json()
  const content = completion?.choices?.[0]?.message?.content
  try { return JSON.parse(content) as Record<string, unknown> } catch { return null }
}

async function allRows(
  admin: AdminClient,
  table: string,
  select: string,
  tripId: string,
) {
  const rows: Record<string, unknown>[] = []
  const pageSize = 1000
  const orderColumn = table === 'trip_travelers' ? 'traveler_id' : table === 'room_occupants' ? 'room_id' : 'id'
  for (let from = 0; from < 20_000; from += pageSize) {
    const result = await admin.from(table).select(select).eq('trip_id', tripId).order(orderColumn).range(from, from + pageSize - 1)
    if (result.error) throw result.error
    const page = (result.data ?? []) as unknown as Record<string, unknown>[]
    rows.push(...page)
    if (page.length < pageSize) return rows
  }
  throw new Error(`A consulta de ${table} excedeu o limite operacional de 20.000 registros.`)
}

async function loadSnapshot(admin: AdminClient, tripId: string) {
  const tripResult = await admin.from('trips').select('id,name,price').eq('id', tripId).maybeSingle()
  if (tripResult.error) throw tripResult.error
  if (!tripResult.data) return null
  const [members, seats, occupants, buses, hotels, rooms, payments] = await Promise.all([
    allRows(admin, 'trip_travelers', 'traveler_id,profiles(name,birthdate,married,spouse_name,has_kids,child_names)', tripId),
    allRows(admin, 'seat_assignments', 'id,traveler_id,bus_id,floor,seat_number', tripId),
    allRows(admin, 'room_occupants', 'room_id,traveler_id', tripId),
    allRows(admin, 'buses', 'id,label,seats_floor1,seats_floor2', tripId),
    allRows(admin, 'hotels', 'id,name', tripId),
    allRows(admin, 'rooms', 'id,hotel_id,name', tripId),
    allRows(admin, 'payments', 'id,traveler_id,total_installments,paid_installments,payment_receipts(installment,status)', tripId),
  ])
  const hotelNames = new Map(hotels.map((hotel) => [String(hotel.id), text(hotel.name)]))
  const busNames = new Map(buses.map((bus, index) => [String(bus.id), text(bus.label) || `Ônibus ${index + 1}`]))
  const occupantsByRoom = new Map<string, string[]>()
  occupants.forEach((occupant) => {
    const roomId = String(occupant.room_id)
    occupantsByRoom.set(roomId, [...(occupantsByRoom.get(roomId) ?? []), String(occupant.traveler_id)])
  })
  const snapshot: AssistantTripSnapshot = {
    price: Number(tripResult.data.price) || 0,
    tripId,
    tripName: text(tripResult.data.name) || 'Viagem',
    travelers: members.map((member) => {
      const profile = member.profiles as Record<string, unknown> | null
      return {
        birthdate: typeof profile?.birthdate === 'string' ? profile.birthdate : null,
        childNames: Array.isArray(profile?.child_names) ? profile.child_names.filter((name): name is string => typeof name === 'string') : [],
        hasKids: profile?.has_kids === true,
        id: String(member.traveler_id),
        married: profile?.married === true,
        name: text(profile?.name) || 'Viajante sem nome',
        spouseName: text(profile?.spouse_name),
        status: 'active',
        tripId,
      }
    }),
    payments: payments.map((payment) => ({
      id: String(payment.id),
      paidInstallments: Number(payment.paid_installments) || 0,
      receipts: Array.isArray(payment.payment_receipts) ? payment.payment_receipts.flatMap((item) => {
        const receipt = item as Record<string, unknown>
        const status = receipt.status
        return status === 'approved' || status === 'pending' || status === 'rejected'
          ? [{ installment: Number(receipt.installment) || 0, status }]
          : []
      }) : [],
      totalInstallments: Number(payment.total_installments) || 0,
      travelerId: String(payment.traveler_id),
      tripId,
    })),
    rooms: rooms.map((room) => ({
      hotelId: String(room.hotel_id),
      hotelName: hotelNames.get(String(room.hotel_id)) || 'Hotel não identificado',
      id: String(room.id),
      name: text(room.name) || 'Quarto sem nome',
      occupants: occupantsByRoom.get(String(room.id)) ?? [],
      tripId,
    })),
    seats: seats.map((seat) => ({
      busId: String(seat.bus_id),
      busLabel: busNames.get(String(seat.bus_id)),
      floor: Number(seat.floor) || 1,
      id: String(seat.id),
      seatNumber: Number(seat.seat_number) || 0,
      travelerId: String(seat.traveler_id),
      tripId,
    })),
    structures: {
      buses: buses.map((bus, index) => ({ id: String(bus.id), label: text(bus.label) || `Ônibus ${index + 1}`, capacity: (Number(bus.seats_floor1) || 0) + (Number(bus.seats_floor2) || 0) })),
      hotels: hotels.map((hotel) => ({ id: String(hotel.id), name: text(hotel.name) || 'Hotel sem nome' })),
    },
  }
  return snapshot
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers })
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  try {
    const authorization = request.headers.get('Authorization')
    if (!authorization) return json({ error: 'Não autenticado.' }, 401)
    const admin = createClient<Database>(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const token = authorization.replace(/^Bearer\s+/i, '')
    const { data: user, error: userError } = await admin.auth.getUser(token)
    if (userError || !user.user) return json({ error: 'Não autenticado.' }, 401)
    const { data: profile, error: profileError } = await admin.from('profiles').select('role').eq('id', user.user.id).maybeSingle()
    if (profileError) throw profileError
    if (profile?.role !== 'admin') return json({ error: 'Sem permissão.' }, 403)

    const body = await request.json()
    const command = text(body?.command, 4000)
    const tripId = text(body?.tripId, 36)
    if (!command) return json({ error: 'Informe um comando para o assistente.' }, 400)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tripId)) return json({ error: 'Viagem inválida.' }, 400)
    const previousContext = previousContextFrom(body?.previousContext, tripId)

    let query: AssistantQuery | null = parseLocalAssistantQuery(command)
    let interpreted: Record<string, unknown> | null = null
    if (!query) {
      interpreted = await interpretWithGroq(command, previousContext?.travelerIds.length ?? 0)
      query = queryFromUnknown(interpreted?.query)
    }
    if (query) {
      const snapshot = await loadSnapshot(admin, tripId)
      if (!snapshot) return json({ error: 'Viagem não encontrada.' }, 404)
      return json(executeAssistantQuery(query, snapshot, previousContext))
    }

    const intent = intentFrom(interpreted?.intent) ?? localOperation(command)
    if (intent) return json({ intent })
    const clarification = text(interpreted?.clarification, 500)
    return json({ clarification: clarification || 'Não consegui transformar esse pedido em uma consulta segura. Reformule informando os critérios e o resultado desejado.' })
  } catch (error) {
    console.error('Assistant request failed', error)
    return json({ error: 'Não foi possível consultar o assistente agora. Tente novamente.' }, 500)
  }
})
