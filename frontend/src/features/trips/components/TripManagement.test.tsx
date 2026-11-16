import { describe, expect, it } from 'vitest'
import { createEmptyTripForm, suggestArrecadationGoal, tripFormToMutation } from '../forms/tripForm'

describe('formulário de viagem para persistência Supabase', () => {
  it('normaliza ônibus e meta antes da criação da viagem', () => {
    const form = { ...createEmptyTripForm(), name: 'Retiro', destination: 'Campinas', departurePlace: 'Igreja', departureTime: '08:00', date: '2027-01-01', maxPeople: '10', price: '50', arrecadationGoal: '500' }
    expect(tripFormToMutation(form)).toMatchObject({ maxPeople: 10, price: 50, arrecadationGoal: 500 })
    expect(suggestArrecadationGoal(form)).toBe(500)
  })
})
