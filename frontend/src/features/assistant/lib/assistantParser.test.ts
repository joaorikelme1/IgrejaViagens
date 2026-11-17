import { describe, expect, it } from 'vitest'
import { parseAssistantCommand } from './assistantParser'

describe('assistantParser', () => {
  it('reconhece consultas e distribuições em linguagem natural', () => {
    expect(parseAssistantCommand('Quantas pessoas ainda não possuem ônibus definido?')).toEqual({ intent: { kind: 'query_unassigned_seats' } })
    expect(parseAssistantCommand('Organize essas pessoas nos quartos dos hotéis')).toEqual({ intent: { kind: 'distribute_rooms' } })
    expect(parseAssistantCommand('Atribua quartos e assentos no onibus a pessoas que ainda não tem quarto e assento')).toEqual({ intent: { kind: 'distribute_allocations' } })
    expect(parseAssistantCommand('Aloque em quartos e ônibus todos que estão sem')).toEqual({ intent: { kind: 'distribute_allocations' } })
    expect(parseAssistantCommand('Quem ainda não tem quarto nem assento?')).toEqual({ intent: { kind: 'query_unassigned_allocations' } })
  })

  it('interpreta cadastro de hotéis em lote', () => {
    const parsed = parseAssistantCommand('Cadastre estes hotéis:\nHotel Central | endereço=Rua A | quartos=101:2, 102:3:family\nHotel Sul | endereço=Rua B | quartos=201:4')
    expect(parsed.intent?.kind).toBe('create_hotels')
    if (parsed.intent?.kind !== 'create_hotels') return
    expect(parsed.intent.hotels).toHaveLength(2)
    expect(parsed.intent.hotels[0]).toMatchObject({ name: 'Hotel Central', address: 'Rua A' })
    expect(parsed.intent.hotels[0].rooms).toEqual([
      { name: '101', capacity: 2, type: 'custom' },
      { name: '102', capacity: 3, type: 'family' },
    ])
  })

  it('interpreta ônibus e movimentações', () => {
    const buses = parseAssistantCommand('Cadastre estes ônibus:\nExecutivo 1 | empresa=Azul | motorista=João | placa=abc1d23 | assentos=44')
    expect(buses.intent?.kind).toBe('create_buses')
    if (buses.intent?.kind === 'create_buses') expect(buses.intent.buses[0]).toMatchObject({ label: 'Executivo 1', company: 'Azul', driverName: 'João', plate: 'ABC1D23', seatsFloor1: 44 })
    expect(parseAssistantCommand('Mude a família Silva para o ônibus 3')).toEqual({ intent: { kind: 'move_family_bus', family: 'silva', bus: '3' } })
  })

  it('solicita dados quando o comando está incompleto', () => {
    expect(parseAssistantCommand('Cadastre estes hotéis').clarification).toMatch(/formato/i)
    expect(parseAssistantCommand('Distribua as pessoas').clarification).toMatch(/assentos, quartos ou ambos/i)
  })
})
