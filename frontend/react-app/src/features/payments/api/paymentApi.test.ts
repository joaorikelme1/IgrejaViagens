import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PaymentMutation } from '../model/paymentTypes'
import { savePayment } from './paymentApi'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function pathOf(input: RequestInfo | URL) {
  const value =
    input instanceof Request
      ? input.url
      : input instanceof URL
        ? input.href
        : input
  return new URL(value, 'http://localhost').pathname
}

const mutation: PaymentMutation = {
  dueDay: 15,
  id: 'payment-1',
  locked: true,
  paidInstallments: 1,
  receipts: {
    1: {
      data: 'data:image/png;base64,AA==',
      date: '09/09/2026',
      filename: 'recibo.png',
      note: '',
      status: 'approved',
      type: 'image/png',
    },
  },
  totalInstallments: 3,
  tripId: 'trip-1',
  userCpf: '11144477735',
}

describe('paymentApi', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('salva somente o pagamento alterado no endpoint granular', async () => {
    let persisted: Record<string, unknown> = {}
    const paths: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>((input, init) => {
        if (input === '/auth/csrf') {
          return Promise.resolve(jsonResponse({
            headerName: 'X-XSRF-TOKEN',
            token: 'csrf-test-token',
          }))
        }
        if (init?.method === 'PUT') {
          if (typeof init.body !== 'string') throw new Error('Corpo ausente.')
          paths.push(pathOf(input))
          persisted = JSON.parse(init.body) as Record<string, unknown>
          return Promise.resolve(jsonResponse(persisted))
        }
        return Promise.resolve(jsonResponse([]))
      }),
    )

    const saved = await savePayment(mutation)

    expect(paths).toEqual(['/payments/payment-1'])
    expect(persisted).toMatchObject({
      totalInstallments: 3,
      dueDay: 15,
    })
    const receipts = JSON.parse(String(persisted.receiptsJson)) as Record<
      string,
      Record<string, unknown>
    >
    expect(receipts['1']).toMatchObject({
      status: 'approved',
    })
    expect(saved.totalInstallments).toBe(3)
  })

  it('não confirma persistência quando o backend devolve erro', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>((input, init) =>
        Promise.resolve(input === '/auth/csrf'
          ? jsonResponse({ headerName: 'X-XSRF-TOKEN', token: 'csrf-test-token' })
          :
          init?.method === 'PUT'
            ? jsonResponse({ message: 'Falha controlada' }, 500)
            : jsonResponse([])
        ),
      ),
    )

    await expect(savePayment({ ...mutation, id: undefined })).rejects.toThrow(
      'Falha controlada',
    )
  })
})
