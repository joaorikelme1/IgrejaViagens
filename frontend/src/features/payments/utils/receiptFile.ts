import type { PaymentReceipt } from '../model/paymentTypes'

export const MAX_RECEIPT_BYTES = 4 * 1024 * 1024

export function validateReceiptFile(file: File) {
  const isImage = [
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
  ].includes(file.type)
  const isPdf = file.type === 'application/pdf'
  if (!isImage && !isPdf) {
    throw new Error('Selecione uma imagem ou arquivo PDF.')
  }
  if (file.size > MAX_RECEIPT_BYTES) {
    throw new Error('O comprovante deve ter no máximo 4 MB.')
  }
}

export function readReceiptFile(file: File) {
  validateReceiptFile(file)
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('Não foi possível ler o comprovante.'))
    })
    reader.addEventListener('error', () =>
      reject(new Error('Não foi possível ler o comprovante.')),
    )
    reader.readAsDataURL(file)
  })
}

export function safeReceiptData(receipt: PaymentReceipt) {
  const value = receipt.data.trim()
  if (
    receipt.type === 'application/pdf' &&
    value.startsWith('data:application/pdf;base64,')
  ) {
    return { kind: 'pdf' as const, value }
  }
  if (
    receipt.type.startsWith('image/') &&
    /^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(value)
  ) {
    return { kind: 'image' as const, value }
  }
  return null
}
