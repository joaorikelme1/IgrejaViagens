import { stripCpf } from '../../../shared/validation/cpf'
import {
  saveBusStructure,
  saveHotelStructure,
  saveTripAllocations,
  saveTripRoomAssignments,
  saveTripSeatAssignments,
} from '../../operations/api/operationsApi'
import {
  assignFamiliesToRooms,
  assignFamiliesToSeats,
  buildFamilyGroups,
  familiesForTravelers,
} from '../../operations/lib/familyAssignments'
import type { HotelConfig } from '../../operations/model/operationTypes'
import type { BusConfig } from '../../trips/model/tripTypes'
import { busDisplayName } from '../../trips/lib/busDisplayName'
import type { UserRole } from '../../auth/model/authTypes'
import type {
  AssistantContext,
  AssistantIntent,
  AssistantOperation,
  AssistantPlan,
} from '../model/assistantTypes'

function normalized(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim()
}

function travelerUsers(context: AssistantContext) {
  const members = new Set(context.trip.travelerCpfs.map(stripCpf))
  return context.users.filter((user) => members.has(stripCpf(user.cpf)))
}

function namesForCpfs(context: AssistantContext, cpfs: string[]) {
  const byCpf = new Map(context.users.map((user) => [stripCpf(user.cpf), user.name]))
  return cpfs.map((cpf) => byCpf.get(stripCpf(cpf)) ?? cpf)
}

function busName(bus: BusConfig, index = 0) {
  return busDisplayName(bus, index)
}

function hotelCapacity(hotel: HotelConfig) {
  return hotel.rooms.reduce((total, room) => total + room.capacity, 0)
}

function findBus(buses: BusConfig[], query: string) {
  const key = normalized(query)
  const exact = buses.find((bus) => normalized(String(bus.id)) === key || normalized(bus.label ?? '') === key)
  if (exact) return exact
  const ordinal = Number(key)
  if (Number.isInteger(ordinal) && ordinal > 0) return buses[ordinal - 1]
  return buses.find((bus) => normalized(bus.label ?? '').includes(key))
}

function findHotel(hotels: HotelConfig[], query: string) {
  const key = normalized(query)
  return hotels.find((hotel) => normalized(String(hotel.id)) === key || normalized(hotel.name) === key)
    ?? hotels.find((hotel) => normalized(hotel.name).includes(key))
}

function clarification(title: string, summary: string, details: string[] = [], warnings: string[] = []): AssistantPlan {
  return { title, summary, details, warnings }
}

export function buildAssistantPlan(intent: AssistantIntent, context: AssistantContext): AssistantPlan {
  const travelers = travelerUsers(context)
  const travelerCpfs = travelers.map((user) => user.cpf)

  if (intent.kind === 'query_unassigned_seats') {
    const assigned = new Set(context.seats.map((seat) => stripCpf(seat.userCpf)))
    const pending = travelers.filter((user) => !assigned.has(stripCpf(user.cpf)))
    return clarification('Passageiros sem ônibus', pending.length ? `${pending.length} pessoa(s) ainda não possuem assento definido.` : 'Todos os viajantes possuem assento definido.', pending.map((user) => user.name))
  }

  if (intent.kind === 'query_unassigned_rooms') {
    const assigned = new Set(context.rooms.flatMap((room) => room.occupants.map(stripCpf)))
    const pending = travelers.filter((user) => !assigned.has(stripCpf(user.cpf)))
    return clarification('Passageiros sem quarto', pending.length ? `${pending.length} pessoa(s) ainda não possuem quarto definido.` : 'Todos os viajantes possuem quarto definido.', pending.map((user) => user.name))
  }

  if (intent.kind === 'query_unassigned_allocations') {
    const seated = new Set(context.seats.map((seat) => stripCpf(seat.userCpf)))
    const roomed = new Set(context.rooms.flatMap((room) => room.occupants.map(stripCpf)))
    const withoutSeat = travelers.filter((user) => !seated.has(stripCpf(user.cpf)))
    const withoutRoom = travelers.filter((user) => !roomed.has(stripCpf(user.cpf)))
    return clarification(
      'Pendências de acomodação e transporte',
      `${withoutRoom.length} pessoa(s) sem quarto e ${withoutSeat.length} pessoa(s) sem assento.`,
      [
        `Sem quarto: ${withoutRoom.length ? withoutRoom.map((user) => user.name).join(', ') : 'ninguém'}`,
        `Sem assento: ${withoutSeat.length ? withoutSeat.map((user) => user.name).join(', ') : 'ninguém'}`,
      ],
    )
  }

  if (intent.kind === 'query_full_hotels') {
    const full = context.hotels.flatMap((hotel) => {
      const roomIds = new Set(hotel.rooms.map((room) => String(room.id)))
      const occupied = context.rooms.filter((room) => roomIds.has(room.id)).reduce((total, room) => total + room.occupants.length, 0)
      const capacity = hotelCapacity(hotel)
      return capacity > 0 && occupied >= capacity ? [`${hotel.name}: ${occupied}/${capacity}`] : []
    })
    return clarification('Hotéis lotados', full.length ? `${full.length} hotel(is) estão sem vagas.` : 'Nenhum hotel está lotado.', full)
  }

  if (intent.kind === 'distribute_seats') {
    if (!context.buses.length) return clarification('Transporte não configurado', 'Cadastre ao menos um ônibus antes da distribuição.')
    const result = assignFamiliesToSeats(context.buses, context.seats, context.users, travelerCpfs, context.trip.id)
    return {
      title: 'Distribuir passageiros pelos ônibus',
      summary: `${result.assignedCount} pessoa(s) serão acomodadas, priorizando famílias e assentos próximos.`,
      details: [`Assentos após a operação: ${result.records.length}`, `Ônibus disponíveis: ${context.buses.length}`],
      warnings: result.warnings,
      operation: result.assignedCount ? { kind: 'save_seats', seats: result.records } : undefined,
    }
  }

  if (intent.kind === 'distribute_rooms') {
    if (!context.hotels.some((hotel) => hotel.rooms.length)) return clarification('Hospedagem não configurada', 'Cadastre quartos antes da distribuição.')
    const result = assignFamiliesToRooms(context.hotels, context.rooms, context.users, travelerCpfs, context.trip.id)
    return {
      title: 'Organizar passageiros nos quartos',
      summary: `${result.assignedCount} pessoa(s) serão acomodadas, mantendo famílias juntas quando houver capacidade.`,
      details: [`Quartos disponíveis: ${context.hotels.reduce((total, hotel) => total + hotel.rooms.length, 0)}`],
      warnings: result.warnings,
      operation: result.assignedCount ? { kind: 'save_rooms', rooms: result.records } : undefined,
    }
  }

  if (intent.kind === 'distribute_allocations') {
    const blockers: string[] = []
    if (!context.buses.length) blockers.push('Cadastre ao menos um ônibus.')
    if (!context.hotels.some((hotel) => hotel.rooms.length)) blockers.push('Cadastre ao menos um quarto de hotel.')
    if (blockers.length) {
      return clarification(
        'Configuração incompleta',
        'Não é possível distribuir quartos e assentos enquanto a estrutura da viagem estiver incompleta.',
        blockers,
      )
    }

    const roomResult = assignFamiliesToRooms(
      context.hotels,
      context.rooms,
      context.users,
      travelerCpfs,
      context.trip.id,
    )
    const seatResult = assignFamiliesToSeats(
      context.buses,
      context.seats,
      context.users,
      travelerCpfs,
      context.trip.id,
    )
    const changed = roomResult.assignedCount + seatResult.assignedCount
    return {
      title: 'Distribuir quartos e assentos',
      summary: `${roomResult.assignedCount} pessoa(s) receberão quarto e ${seatResult.assignedCount} pessoa(s) receberão assento, preservando as alocações existentes.`,
      details: [
        `Ocupações de quartos após a operação: ${roomResult.records.reduce((total, room) => total + room.occupants.length, 0)}`,
        `Assentos após a operação: ${seatResult.records.length}`,
        'Famílias serão mantidas juntas ou próximas sempre que houver capacidade.',
      ],
      warnings: [...new Set([...roomResult.warnings, ...seatResult.warnings])],
      operation: changed
        ? { kind: 'save_allocations', rooms: roomResult.records, seats: seatResult.records }
        : undefined,
    }
  }

  if (intent.kind === 'create_hotels') {
    const hotels: HotelConfig[] = intent.hotels.map((hotel) => ({
      address: hotel.address,
      id: crypto.randomUUID(),
      name: hotel.name,
      notes: hotel.notes,
      rooms: hotel.rooms.map((room) => ({ ...room, id: crypto.randomUUID() })),
    }))
    const roomCount = hotels.reduce((total, hotel) => total + hotel.rooms.length, 0)
    return {
      title: 'Cadastrar hotéis em lote',
      summary: `${hotels.length} hotel(is) e ${roomCount} quarto(s) serão adicionados à viagem.`,
      details: hotels.map((hotel) => `${hotel.name}${hotel.address ? ` · ${hotel.address}` : ''} · ${hotel.rooms.length} quarto(s)`),
      warnings: hotels.some((hotel) => hotel.rooms.length === 0) ? ['Hotéis sem quartos poderão ser complementados depois.'] : [],
      operation: { kind: 'save_hotels', hotels: [...context.hotels, ...hotels] },
    }
  }

  if (intent.kind === 'create_buses') {
    const buses: BusConfig[] = intent.buses.map((bus) => ({
      ...bus,
      id: crypto.randomUUID(),
      seats: bus.seatsFloor1 + bus.seatsFloor2,
    }))
    return {
      title: 'Cadastrar ônibus em lote',
      summary: `${buses.length} ônibus serão adicionados, totalizando ${buses.reduce((total, bus) => total + bus.seats, 0)} assentos.`,
      details: buses.map((bus) => `${bus.label} · ${bus.company || 'empresa não informada'} · ${bus.seats} assentos`),
      warnings: [],
      operation: { kind: 'save_buses', buses: [...context.buses, ...buses] },
    }
  }

  if (intent.kind === 'move_family_bus') {
    const targetBus = findBus(context.buses, intent.bus)
    if (!targetBus) return clarification('Ônibus não encontrado', `Não encontrei “${intent.bus}”.`, context.buses.map(busName))
    const familyMatches = travelers.filter((user) => normalized(user.name).split(' ').includes(normalized(intent.family)) || normalized(user.name).includes(normalized(intent.family)))
    if (!familyMatches.length) return clarification('Família não encontrada', `Não encontrei integrantes da família “${intent.family}” nesta viagem.`)
    const selected = new Set(familyMatches.map((user) => user.cpf))
    const familyCpfs = [...new Set(buildFamilyGroups(context.users, travelerCpfs).filter((group) => group.some((cpf) => selected.has(cpf))).flat())]
    const remaining = context.seats.filter((seat) => !familyCpfs.includes(stripCpf(seat.userCpf)))
    const result = assignFamiliesToSeats([targetBus], remaining, context.users, familyCpfs, context.trip.id)
    if (result.assignedCount < familyCpfs.length) {
      return clarification('Não há assentos suficientes', `A família possui ${familyCpfs.length} integrante(s), mas ${busName(targetBus, context.buses.indexOf(targetBus))} não possui vagas suficientes.`, ['Libere assentos nesse ônibus ou escolha outro veículo.'], result.warnings)
    }
    return {
      title: `Mover família para ${busName(targetBus, context.buses.indexOf(targetBus))}`,
      summary: `${familyCpfs.length} integrante(s) serão movidos para assentos próximos no mesmo ônibus.`,
      details: namesForCpfs(context, familyCpfs),
      warnings: result.warnings,
      operation: { kind: 'save_seats', seats: result.records },
    }
  }

  const targetHotel = findHotel(context.hotels, intent.hotel)
  if (!targetHotel) return clarification('Hotel não encontrado', `Não encontrei “${intent.hotel}”.`, context.hotels.map((hotel) => hotel.name))
  const resolved = intent.people.map((name) => {
    const key = normalized(name)
    const matches = travelers.filter((user) => normalized(user.name) === key || normalized(user.name).includes(key))
    return { name, matches }
  })
  const ambiguous = resolved.filter((item) => item.matches.length !== 1)
  if (ambiguous.length) return clarification('Preciso identificar as pessoas', 'Use nomes mais completos para evitar ambiguidades.', ambiguous.map((item) => `${item.name}: ${item.matches.length} correspondência(s)`))
  const selectedCpfs = resolved.map((item) => item.matches[0].cpf)
  const familyCpfs = familiesForTravelers(context.users, travelerCpfs, selectedCpfs)
  const targetRoomIds = new Set(targetHotel.rooms.map((room) => String(room.id)))
  const withoutFamily = context.rooms.map((room) => ({ ...room, occupants: room.occupants.filter((cpf) => !familyCpfs.includes(stripCpf(cpf))) }))
  const targetCurrent = withoutFamily.filter((room) => targetRoomIds.has(room.id))
  const result = assignFamiliesToRooms([targetHotel], targetCurrent, context.users, familyCpfs, context.trip.id)
  if (result.assignedCount < familyCpfs.length) {
    return clarification('Não há quartos suficientes', `${targetHotel.name} não possui vagas para todo o grupo familiar.`, [`Capacidade total: ${hotelCapacity(targetHotel)}`, 'Cadastre quartos ou escolha outro hotel.'], result.warnings)
  }
  const rooms = [...withoutFamily.filter((room) => !targetRoomIds.has(room.id)), ...result.records]
  return {
    title: `Transferir grupo para ${targetHotel.name}`,
    summary: `${familyCpfs.length} pessoa(s) serão transferidas, preservando os respectivos grupos familiares.`,
    details: namesForCpfs(context, familyCpfs),
    warnings: result.warnings,
    operation: { kind: 'save_rooms', rooms },
  }
}

export async function executeAssistantOperation(
  tripId: string,
  operation: AssistantOperation,
  actorRole: UserRole,
) {
  if (actorRole !== 'admin') {
    throw new Error('Somente administradores podem executar operações do assistente.')
  }
  if (operation.kind === 'save_hotels') await saveHotelStructure(tripId, operation.hotels)
  if (operation.kind === 'save_buses') await saveBusStructure(tripId, operation.buses)
  if (operation.kind === 'save_rooms') await saveTripRoomAssignments(tripId, operation.rooms)
  if (operation.kind === 'save_seats') await saveTripSeatAssignments(tripId, operation.seats)
  if (operation.kind === 'save_allocations') await saveTripAllocations(tripId, operation.rooms, operation.seats)
}
