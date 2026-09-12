import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearActiveTripId,
  readActiveTripId,
  writeActiveTripId,
} from './activeTripStorage'

describe('persistência da viagem ativa', () => {
  beforeEach(() => sessionStorage.clear())

  it('persiste somente o identificador da viagem', () => {
    writeActiveTripId('trip-1')

    expect(readActiveTripId()).toBe('trip-1')
    expect(sessionStorage.length).toBe(1)
    expect(sessionStorage.getItem('igreja-viagens:active-trip-id')).toBe(
      'trip-1',
    )

    clearActiveTripId()
    expect(readActiveTripId()).toBeNull()
  })
})
