import { afterEach, describe, expect, it, vi } from 'vitest'
import type { UserMutation } from '../model/userTypes'
import { listUsers, updateUser } from './usersApi'

const mutation: UserMutation = {
  birthdate: '1990-05-10',
  childCpfs: ['52998224725'],
  firstLogin: false,
  hasKids: true,
  kids: ['Lia', 'Caio'],
  married: true,
  name: 'Ana Atualizada',
  role: 'admin',
  spouseName: 'Bruno',
  spouseCpf: '12345678909',
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('usersApi', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('descarta senha antes de devolver usuários para o estado React', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse([
            {
              cpf: '11144477735',
              name: 'Tiago',
              role: 'traveler',
              password: 'segredo-retornado-pelo-backend',
            },
          ]),
        ),
      ),
    )

    const users = await listUsers()

    expect(users).toHaveLength(1)
    expect(users[0]).not.toHaveProperty('password')
    expect(JSON.stringify(users)).not.toContain('segredo-retornado-pelo-backend')
  })

  it('edita por endpoint granular preservando campos desconhecidos do servidor', async () => {
    let persisted: Record<string, unknown> | null = null
    const fetchMock = vi.fn<typeof fetch>((input, init) => {
      if (input === '/auth/csrf') {
        return Promise.resolve(jsonResponse({
          headerName: 'X-XSRF-TOKEN',
          token: 'csrf-test-token',
        }))
      }
      if (init?.method === 'PUT') {
        if (typeof init.body !== 'string') throw new Error('Corpo não informado.')
        persisted = JSON.parse(init.body) as Record<string, unknown>
        return Promise.resolve(jsonResponse(persisted))
      }
      return Promise.resolve(
        jsonResponse([
          {
            cpf: '11144477735',
            name: 'Ana',
            role: 'traveler',
            password: 'valor-preservado-sem-ir-ao-estado',
            serverMetadata: { version: 7 },
          },
        ]),
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const updated = await updateUser('111.444.777-35', mutation)

    expect(persisted).toMatchObject({
      cpf: '11144477735',
      childCpfs: ['52998224725'],
      name: 'Ana Atualizada',
      spouseName: 'Bruno',
      spouseCpf: '12345678909',
      kids: ['Lia', 'Caio'],
      serverMetadata: { version: 7 },
    })
    expect(updated).not.toHaveProperty('password')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
