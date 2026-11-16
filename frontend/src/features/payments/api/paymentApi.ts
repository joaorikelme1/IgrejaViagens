import { supabase, unwrap } from '../../../infrastructure/supabase/client'
import { stripCpf } from '../../../shared/validation/cpf'
import { listUsers } from '../../users/api/usersApi'
import type { PaymentMutation, PaymentReceipt, PaymentRecord, PaymentSource, ReceiptStatus } from '../model/paymentTypes'

type PaymentRow = { id: string; trip_id: string; traveler_id: string; total_installments: number; paid_installments: number; due_day: number; locked: boolean; payment_receipts: { installment: number; storage_path: string; file_name: string; mime_type: string; note: string; status: ReceiptStatus; uploaded_at: string }[]; profiles: { cpf: string } | null }

async function signed(path: string) {
  const result = unwrap<{ signedUrl: string } | null>(await supabase.storage.from('payment-receipts').createSignedUrl(path, 60 * 10))
  if (!result) throw new Error('Não foi possível gerar a URL do comprovante.')
  return result.signedUrl
}

async function toPayment(row: PaymentRow): Promise<PaymentRecord> {
  const entries = await Promise.all((row.payment_receipts ?? []).map(async (receipt) => [String(receipt.installment), { data: await signed(receipt.storage_path), date: receipt.uploaded_at, filename: receipt.file_name, note: receipt.note, status: receipt.status, type: receipt.mime_type }] as const))
  return { id: row.id, tripId: row.trip_id, userCpf: row.profiles?.cpf ?? '', totalInstallments: row.total_installments, paidInstallments: row.paid_installments, dueDay: row.due_day, locked: row.locked, receipts: Object.fromEntries(entries) }
}

export async function listPayments() {
  const rows = unwrap<PaymentRow[]>(await supabase.from('payments').select('id, trip_id, traveler_id, total_installments, paid_installments, due_day, locked, profiles(cpf), payment_receipts(installment,storage_path,file_name,mime_type,note,status,uploaded_at)').order('created_at'))
  return Promise.all(rows.map(toPayment))
}

export async function loadPaymentSource(): Promise<PaymentSource> { const [payments, users] = await Promise.all([listPayments(), listUsers()]); return { payments, users } }

async function profileId(cpf: string) { return (unwrap<{ id: string }>(await supabase.from('profiles').select('id').eq('cpf', cpf).single())).id }

async function uploadReceipts(paymentId: string, receipts: Record<string, PaymentReceipt>) {
  for (const [installment, receipt] of Object.entries(receipts)) {
    let path = `pending/${paymentId}/${installment}`
    if (receipt.data.startsWith('data:')) {
      const blob = await (await fetch(receipt.data)).blob()
      if (blob.size > 5_000_000) throw new Error('Comprovante excede 5 MB.')
      path = `${paymentId}/${installment}-${crypto.randomUUID()}`
      unwrap(await supabase.storage.from('payment-receipts').upload(path, blob, { contentType: receipt.type || blob.type, upsert: true }))
    }
    unwrap(await supabase.from('payment_receipts').upsert({ payment_id: paymentId, installment: Number(installment), storage_path: path, file_name: receipt.filename, mime_type: receipt.type || 'application/octet-stream', note: receipt.note, status: receipt.status }, { onConflict: 'payment_id,installment' }))
  }
}

export async function savePayment(mutation: PaymentMutation) {
  const cpf = stripCpf(mutation.userCpf); const travelerId = await profileId(cpf)
  const total = Math.min(24, Math.max(1, Math.trunc(mutation.totalInstallments) || 1))
  const id = mutation.id && /^[0-9a-f-]{36}$/i.test(mutation.id) ? mutation.id : null
  const row = unwrap<{ id: string }>(await supabase.rpc('save_payment', { p_payment_id: id, p_trip_id: mutation.tripId, p_traveler_id: travelerId, p_total_installments: total, p_paid_installments: Math.min(total, Math.max(0, Math.trunc(mutation.paidInstallments))), p_due_day: Math.min(31, Math.max(1, Math.trunc(mutation.dueDay))), p_locked: mutation.locked, p_expected_version: null }))
  await uploadReceipts(row.id, mutation.receipts)
  const saved = unwrap<PaymentRow>(await supabase.from('payments').select('id, trip_id, traveler_id, total_installments, paid_installments, due_day, locked, profiles(cpf), payment_receipts(installment,storage_path,file_name,mime_type,note,status,uploaded_at)').eq('id', row.id).single())
  return toPayment(saved)
}
