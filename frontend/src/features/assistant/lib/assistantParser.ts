import type {
  AssistantBusDraft,
  AssistantHotelDraft,
  ParsedAssistantCommand,
} from '../model/assistantTypes'

function normalized(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim()
}

function bodyAfterCommand(input: string) {
  const colon = input.indexOf(':')
  if (colon >= 0) return input.slice(colon + 1).trim()
  return input.split(/\r?\n/).slice(1).join('\n').trim()
}

function fields(line: string) {
  const parts = line.split('|').map((part) => part.trim()).filter(Boolean)
  const result = new Map<string, string>()
  for (const part of parts.slice(1)) {
    const match = part.match(/^([^:=]+)\s*[:=]\s*(.+)$/)
    if (match) result.set(normalized(match[1]), match[2].trim())
  }
  return { name: parts[0]?.replace(/^(hotel|onibus|ônibus)\s*[:=]\s*/i, '').trim() ?? '', result }
}

function parseHotels(body: string): AssistantHotelDraft[] {
  return body.split(/\r?\n|\s*;\s*(?=[^|]+\|)/).map((line) => line.trim()).filter(Boolean).flatMap((line) => {
    const parsed = fields(line)
    if (!parsed.name) return []
    const roomField = parsed.result.get('quartos') ?? ''
    const rooms = roomField.split(',').map((room) => room.trim()).filter(Boolean).flatMap((room) => {
      const match = room.match(/^(.+?)\s*[:(]\s*(\d+)(?:\s*[:;,]\s*([^)]+))?\)?$/)
      if (!match) return []
      return [{ name: match[1].trim(), capacity: Number(match[2]), type: match[3]?.trim() || 'custom' }]
    })
    return [{
      address: parsed.result.get('endereco') ?? '',
      name: parsed.name,
      notes: parsed.result.get('observacoes') ?? parsed.result.get('notas') ?? '',
      rooms,
    }]
  })
}

function numberField(values: Map<string, string>, keys: string[], fallback: number) {
  const raw = keys.map((key) => values.get(key)).find(Boolean)
  const value = Number(raw)
  return Number.isInteger(value) && value >= 0 ? value : fallback
}

function parseBuses(body: string): AssistantBusDraft[] {
  return body.split(/\r?\n|\s*;\s*(?=[^|]+\|)/).map((line) => line.trim()).filter(Boolean).flatMap((line) => {
    const parsed = fields(line)
    if (!parsed.name) return []
    const floors = numberField(parsed.result, ['pisos'], 1) === 2 ? 2 : 1
    const total = numberField(parsed.result, ['assentos', 'capacidade'], 44)
    const floorOne = numberField(parsed.result, ['piso1', 'piso 1'], floors === 1 ? total : Math.max(1, total - 20))
    const floorTwo = floors === 2 ? numberField(parsed.result, ['piso2', 'piso 2'], Math.max(1, total - floorOne)) : 0
    return [{
      company: parsed.result.get('empresa') ?? '',
      driverName: parsed.result.get('motorista') ?? '',
      floors,
      label: parsed.name,
      plate: (parsed.result.get('placa') ?? '').toUpperCase(),
      seatsFloor1: Math.max(1, floorOne),
      seatsFloor2: floorTwo,
    }]
  })
}

export function parseAssistantCommand(input: string): ParsedAssistantCommand {
  const text = normalized(input)
  if (!text) return { clarification: 'Digite uma solicitação ou escolha uma das sugestões.' }

  if (/(quant|quais|liste|mostre).*(sem|nao possuem|não possuem).*(onibus|ônibus|assento)/.test(text)) return { intent: { kind: 'query_unassigned_seats' } }
  if (/(quant|quais|liste|mostre).*(sem|nao possuem|não possuem).*(quarto|hotel)/.test(text)) return { intent: { kind: 'query_unassigned_rooms' } }
  if (/(quais|liste|mostre).*(hoteis|hotéis).*(lotad)/.test(text)) return { intent: { kind: 'query_full_hotels' } }
  if (/(distribua|organize|acomode).*(onibus|ônibus|assento)/.test(text)) return { intent: { kind: 'distribute_seats' } }
  if (/(distribua|organize|acomode).*(quarto|hotel)/.test(text)) return { intent: { kind: 'distribute_rooms' } }

  const familyMove = text.match(/(?:mude|mova|transfira)\s+(?:a\s+)?familia\s+(.+?)\s+para\s+(?:o\s+)?onibus\s+(.+)$/)
  if (familyMove) return { intent: { kind: 'move_family_bus', family: familyMove[1].trim(), bus: familyMove[2].trim() } }

  const peopleMove = input.match(/(?:mude|mova|transfira)\s+(.+?)\s+para\s+(?:o\s+)?hotel\s+(.+)$/i)
  if (peopleMove) {
    const people = peopleMove[1].split(/,|\s+e\s+/i).map((name) => name.trim()).filter(Boolean)
    return { intent: { kind: 'move_people_hotel', people, hotel: peopleMove[2].trim() } }
  }

  if (/(cadastre|adicione|registre).*(hoteis|hotéis)/.test(text)) {
    const hotels = parseHotels(bodyAfterCommand(input))
    if (!hotels.length) return { clarification: 'Informe um hotel por linha no formato: Hotel Central | endereço=Rua A | quartos=101:2, 102:3.' }
    return { intent: { kind: 'create_hotels', hotels } }
  }

  if (/(cadastre|adicione|registre).*(onibus|ônibus)/.test(text)) {
    const buses = parseBuses(bodyAfterCommand(input))
    if (!buses.length) return { clarification: 'Informe um ônibus por linha no formato: Executivo 1 | empresa=Viação Azul | motorista=João | placa=ABC1D23 | assentos=44.' }
    return { intent: { kind: 'create_buses', buses } }
  }

  return { clarification: 'Não reconheci esse comando. Posso cadastrar hotéis e ônibus, distribuir famílias, mover grupos ou consultar pessoas sem quarto/ônibus.' }
}
