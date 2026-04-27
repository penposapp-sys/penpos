import { api } from './apiClient.js'

const normalizeSystem = (value) => (String(value || '').trim().toLowerCase() === 'canteen' ? 'canteen' : 'kermes')

const buildReceiptContent = (receipt) => {
  const lines = []
  lines.push('PENPOS')
  lines.push('')
  lines.push(`Siparis: ${String(receipt?.id || '')}`)
  lines.push(`Tarih: ${new Date(receipt?.createdAt || Date.now()).toLocaleString('tr-TR')}`)
  lines.push('')
  for (const it of (receipt?.items || [])) {
    const name = String(it?.nameSnapshot || '').trim()
    const qty = Number(it?.qty || 0)
    const subtotal = Number(it?.subtotal || 0)
    lines.push(`${name} x${qty} = ${subtotal.toFixed(2)} TL`)
  }
  lines.push('')
  lines.push(`Toplam: ${Number(receipt?.totals?.grandTotal || 0).toFixed(2)} TL`)
  return lines.join('\n') + '\n'
}

export const enqueueReceiptPrint = async ({ system, orderId, copyCount = 1 } = {}) => {
  const sys = normalizeSystem(system)
  const oid = String(orderId || '').trim()
  const copies = Math.max(1, Math.min(10, Number(copyCount || 1)))
  if (!oid) throw new Error('Siparis bulunamadi')
  if (sys !== 'kermes') throw new Error('Bu ekran icin fis yazdirma henuz desteklenmiyor')

  const receiptRes = await api(`/api/pos/orders/${encodeURIComponent(oid)}/receipt`, { silent: true })
  const receipt = receiptRes?.receipt || null
  if (!receipt) throw new Error(receiptRes?.message || 'Fis verisi alinamadi')

  const content = buildReceiptContent(receipt)
  const res = await api('/api/printing/jobs', {
    method: 'POST',
    data: {
      system: sys,
      type: 'receipt',
      payload: { type: 'raw', content },
      meta: { orderId: String(receipt.id), copies }
    },
    silent: true
  })
  if (!res?.success) throw new Error(res?.message || 'Kuyruga alinamadi')
  return { ok: true, queuedWithoutStation: res?.queuedWithoutStation === true }
}

