import { supabase, unwrap } from '../../../infrastructure/supabase/client'
import { stripCpf } from '../../../shared/validation/cpf'
import { listUsers } from '../../users/api/usersApi'
import type { PaymentMutation, PaymentReceipt, PaymentRecord, PaymentSource, ReceiptStatus } from '../model/paymentTypes'

type ReceiptRow = { installment: number; storage_path: string; file_name: string; mime_type: string; note: string; status: ReceiptStatus; uploaded_at: string }
type PaymentRow = { id: string; trip_id: string; traveler_id: string; total_installments: number; paid_installments: number; due_day: number; locked: boolean; version: number; payment_receipts: ReceiptRow[]; profiles: { cpf: string } | null }

const paymentSelect = 'id, trip_id, traveler_id, total_installments, paid_installments, due_day, locked, version, profiles(cpf), payment_receipts(installment,storage_path,file_name,mime_type,note,status,uploaded_at)'

async function signed(path: string) {
  const result = unwrap<{ signedUrl: string } | null>(await supabase.storage.from('payment-receipts').createSignedUrl(path, 60 * 10))
  if (!result) throw new Error('Não foi possível gerar a URL do comprovante.')
  return result.signedUrl
}

async function toPayment(row: PaymentRow): Promise<PaymentRecord> {
  const entries = await Promise.all((row.payment_receipts ?? []).map(async (receipt) => [String(receipt.installment), {
    data: await signed(receipt.storage_path), date: receipt.uploaded_at, filename: receipt.file_name,
    note: receipt.note, status: receipt.status, type: receipt.mime_type,
  }] as const))
  return {
    id: row.id, tripId: row.trip_id, userCpf: row.profiles?.cpf ?? '',
    totalInstallments: row.total_installments, paidInstallments: row.paid_installments,
    dueDay: row.due_day, locked: row.locked, receipts: Object.fromEntries(entries), version: row.version,
  }
}

async function loadPayment(id: string) {
  const row = unwrap<PaymentRow>(await supabase.from('payments').select(paymentSelect).eq('id', id).single())
  return toPayment(row)
}

export async function listPayments() {
  const rows = unwrap<PaymentRow[]>(await supabase.from('payments').select(paymentSelect).order('created_at'))
  return Promise.all(rows.map(toPayment))
}

export async function loadPaymentSource(): Promise<PaymentSource> {
  const [payments, users] = await Promise.all([listPayments(), listUsers()])
  return { payments, users }
}

async function profileId(cpf: string) {
  return (unwrap<{ id: string }>(await supabase.from('profiles').select('id').eq('cpf', cpf).single())).id
}

export async function submitTravelerReceipt(payment: PaymentRecord, installment: string, receipt: PaymentReceipt) {
  if (!receipt.data.startsWith('data:')) throw new Error('O arquivo do comprovante é inválido.')
  const blob = await (await fetch(receipt.data)).blob()
  if (blob.size > 4 * 1024 * 1024) throw new Error('Comprovante excede 4 MB.')
  const mimeType = receipt.type || blob.type
  if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(mimeType)) throw new Error('Formato de comprovante não permitido.')
  const path = `${payment.id}/${installment}-${crypto.randomUUID()}`
  unwrap(await supabase.storage.from('payment-receipts').upload(path, blob, { contentType: mimeType }))
  try {
    unwrap(await supabase.rpc('submit_payment_receipt', {
      p_file_name: receipt.filename, p_installment: Number(installment), p_mime_type: mimeType,
      p_payment_id: payment.id, p_storage_path: path,
    }))
  } catch (error) {
    await supabase.storage.from('payment-receipts').remove([path])
    throw error
  }
  return loadPayment(payment.id)
}

export async function savePayment(mutation: PaymentMutation) {
  const travelerId = await profileId(stripCpf(mutation.userCpf))
  const total = Math.min(24, Math.max(1, Math.trunc(mutation.totalInstallments) || 1))
  const id = mutation.id && /^[0-9a-f-]{36}$/i.test(mutation.id) ? mutation.id : null
  const row = unwrap<{ id: string }>(await supabase.rpc('save_payment', {
    p_payment_id: id, p_trip_id: mutation.tripId, p_traveler_id: travelerId,
    p_total_installments: total,
    p_paid_installments: Math.min(total, Math.max(0, Math.trunc(mutation.paidInstallments))),
    p_due_day: Math.min(31, Math.max(1, Math.trunc(mutation.dueDay))),
    p_locked: mutation.locked, p_expected_version: mutation.version ?? null,
  }))
  return loadPayment(row.id)
}

export async function saveOwnPaymentPlan(mutation: PaymentMutation) {
  const row = unwrap<PaymentRow>(await supabase.rpc('save_own_payment_plan', {
    p_due_day: Math.min(31, Math.max(1, Math.trunc(mutation.dueDay))),
    p_total_installments: Math.min(24, Math.max(1, Math.trunc(mutation.totalInstallments))),
    p_trip_id: mutation.tripId,
  }))
  return loadPayment(row.id)
}

export async function reviewPaymentReceipt(payment: PaymentRecord, installment: string, status: ReceiptStatus, note = '') {
  unwrap(await supabase.rpc('review_payment_receipt', {
    p_expected_version: payment.version ?? null, p_installment: Number(installment), p_note: note,
    p_payment_id: payment.id, p_status: status,
  }))
  return loadPayment(payment.id)
}
