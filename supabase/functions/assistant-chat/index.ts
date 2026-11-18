import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
      ? intent.people.map((person) => text(person)).filter(Boolean).slice(0, 20)
      : []
    return hotel && people.length ? { kind, hotel, people } : null
  }
  if (kind === 'create_hotels' && Array.isArray(intent.hotels)) {
    const hotels = intent.hotels.slice(0, 10).flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const hotel = item as Record<string, unknown>
      const name = text(hotel.name)
      if (!name) return []
      const rooms = Array.isArray(hotel.rooms) ? hotel.rooms.slice(0, 100).flatMap((room) => {
        if (!room || typeof room !== 'object') return []
        const value = room as Record<string, unknown>
        const capacity = Number(value.capacity)
        const roomName = text(value.name)
        return roomName && Number.isInteger(capacity) && capacity > 0 && capacity <= 20
          ? [{ capacity, name: roomName, type: text(value.type) || 'custom' }]
          : []
      }) : []
      return [{ address: text(hotel.address), name, notes: text(hotel.notes, 500), rooms }]
    })
    return hotels.length ? { kind, hotels } : null
  }
  if (kind === 'create_buses' && Array.isArray(intent.buses)) {
    const buses = intent.buses.slice(0, 10).flatMap((item) => {
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

const systemPrompt = `Você interpreta comandos para o assistente administrativo de viagens. Responda SOMENTE JSON válido, sem markdown. Nunca afirme que executou uma ação. Escolha somente uma intenção permitida: query_unassigned_seats, query_unassigned_rooms, query_unassigned_allocations, query_full_hotels, distribute_seats, distribute_rooms, distribute_allocations, create_hotels, create_buses, move_family_bus ou move_people_hotel. Para uma intenção, use {"intent":{"kind":"..."}}. Para dados insuficientes ou pedido fora do escopo, use {"clarification":"pergunta curta em português"}. Regra essencial: pedidos que mencionam apenas ônibus, assento, poltrona ou transporte usam a intenção de assentos; pedidos que mencionam apenas quarto, hotel ou hospedagem usam a intenção de quartos; use a intenção de alocações somente se o pedido mencionar explicitamente os dois. Para create_hotels, inclua hotels com name, address, notes e rooms [{name,capacity,type}]. Para create_buses, inclua buses com label, company, driverName, plate, floors, seatsFloor1 e seatsFloor2. Não invente nomes, veículos, hotéis ou capacidades ausentes.`

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers })
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  try {
    const authorization = request.headers.get('Authorization')
    if (!authorization) return json({ error: 'Não autenticado.' }, 401)
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const token = authorization.replace(/^Bearer\s+/i, '')
    const { data: user, error: userError } = await admin.auth.getUser(token)
    if (userError || !user.user) return json({ error: 'Não autenticado.' }, 401)
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.user.id)
      .maybeSingle()
    if (profileError) throw profileError
    if (profile?.role !== 'admin') return json({ error: 'Sem permissão.' }, 403)

    const body = await request.json()
    const command = text(body?.command, 4000)
    if (!command) return json({ error: 'Informe um comando para o assistente.' }, 400)
    const apiKey = Deno.env.get('GROQ_API_KEY')
    if (!apiKey) return json({ error: 'A IA ainda não foi configurada. Defina o segredo GROQ_API_KEY no Supabase.' }, 503)

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: Deno.env.get('GROQ_MODEL') || 'openai/gpt-oss-20b',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: command },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_completion_tokens: 1200,
      }),
      signal: AbortSignal.timeout(25_000),
    })
    if (!response.ok) {
      console.error('Groq request failed', response.status, (await response.text()).slice(0, 500))
      return json({ error: 'A Groq não conseguiu interpretar o comando. Tente novamente.' }, 502)
    }
    const completion = await response.json()
    const content = completion?.choices?.[0]?.message?.content
    let parsed: unknown
    try { parsed = JSON.parse(content) } catch { return json({ error: 'A IA retornou uma resposta inválida. Tente novamente.' }, 502) }
    const intent = intentFrom((parsed as Record<string, unknown>)?.intent)
    if (intent) return json({ intent })
    const clarification = text((parsed as Record<string, unknown>)?.clarification, 500)
    return clarification
      ? json({ clarification })
      : json({ clarification: 'Não consegui interpretar esse pedido. Pode reformular?' })
  } catch (error) {
    console.error('Assistant request failed', error)
    return json({ error: 'Não foi possível consultar a IA agora. Tente novamente.' }, 500)
  }
})
