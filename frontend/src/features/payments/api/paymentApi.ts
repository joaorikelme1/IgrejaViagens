import { httpRequest } from '../../../lib/http'
import { stripCpf } from '../../../shared/validation/cpf'
import { listUsers } from '../../users/api/usersApi'
import type {
  PaymentMutation,
  PaymentReceipt,
  PaymentRecord,
  PaymentSource,
  ReceiptStatus,
} from '../model/paymentTypes'

type ApiRecord = Record<string, unknown>

function records(value: unknown, label: string): ApiRecord[] {
  if (!Array.isArray(value)) throw new Error(`Resposta de ${label} inválida.`)
  return value.filter(
    (item): item is ApiRecord =>
      typeof item === 'object' && item !== null && !Array.isArray(item),
  )
}

function readString(value: unknown, fallback = '') {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : fallback
}

function readNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function readStatus(value: unknown): ReceiptStatus {
  if (value === 'approved' || value === 'rejected') return value
  return 'pending'
}

function parseReceipts(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return {}

  try {
    const parsed: unknown = JSON.parse(value)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {}
    }

    return Object.fromEntries(
      Object.entries(parsed).flatMap(([installment, receipt]) => {
        if (
          typeof receipt !== 'object' ||
          receipt === null ||
          Array.isArray(receipt)
        ) {
          return []
        }
        const source = receipt as ApiRecord
        const parsedReceipt: PaymentReceipt = {
          data: readString(source.data),
          date: readString(source.date),
          filename: readString(
            source.filename,
            readString(source.fileName, 'Comprovante'),
          ),
          note: readString(source.note),
          status: readStatus(source.status),
          type: readString(source.type),
        }
        return [[installment, parsedReceipt]]
      }),
    )
  } catch {
    return {}
  }
}

export function toPayment(value: unknown): PaymentRecord | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }
  const source = value as ApiRecord
  const userCpf = stripCpf(
    readString(source.userCpf, readString(source.cpf)),
  )
  const tripId = readString(source.tripId)
  if (!userCpf || !tripId) return null

  return {
    dueDay: readNumber(source.dueDay),
    id: readString(source.id, `${userCpf}_${tripId}`),
    locked: source.locked === true,
    paidInstallments: readNumber(source.paidInstallments),
    receipts: parseReceipts(source.receiptsJson),
    totalInstallments: readNumber(source.totalInstallments),
    tripId,
    userCpf,
  }
}

export async function listPayments() {
  const response = await httpRequest<unknown>('/payments')
  return records(response, 'pagamentos')
    .map(toPayment)
    .filter((payment): payment is PaymentRecord => payment !== null)
}

export async function loadPaymentSource(): Promise<PaymentSource> {
  const [payments, users] = await Promise.all([listPayments(), listUsers()])
  return { payments, users }
}

function normalizeMutation(mutation: PaymentMutation) {
  const totalInstallments = Math.min(
    24,
    Math.max(1, Math.trunc(mutation.totalInstallments) || 1),
  )
  return {
    id:
      mutation.id ||
      `${stripCpf(mutation.userCpf)}_${readString(mutation.tripId)}`,
    userCpf: stripCpf(mutation.userCpf),
    tripId: readString(mutation.tripId),
    totalInstallments,
    paidInstallments: Math.min(
      totalInstallments,
      Math.max(0, Math.trunc(mutation.paidInstallments) || 0),
    ),
    dueDay: Math.min(31, Math.max(1, Math.trunc(mutation.dueDay) || 10)),
    locked: mutation.locked,
    receiptsJson: JSON.stringify(mutation.receipts),
  }
}

export async function savePayment(mutation: PaymentMutation) {
  const normalized = normalizeMutation(mutation)
  const persisted = await httpRequest<unknown>(
    `/payments/${encodeURIComponent(normalized.id)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalized),
    },
  )
  const saved = toPayment(persisted)
  if (!saved) throw new Error('O backend não confirmou o pagamento persistido.')
  return saved
}
