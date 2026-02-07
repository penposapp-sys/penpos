import { api } from './apiClient.js'

const normalizeSystem = (value) => (String(value || '').trim().toLowerCase() === 'canteen' ? 'canteen' : 'kermes')

const buildReceiptContent = (receipt) => {
  const lines = []
  lines.push('PENPOS')
  lines.push('')
  lines.push(`Sipariş: ${String(receipt?.id || '')}`)
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
  if (!oid) throw new Error('Sipariş bulunamadı')
  if (sys !== 'kermes') throw new Error('Bu ekran için fiş yazdırma henüz desteklenmiyor')

  const receiptRes = await api(`/api/pos/orders/${encodeURIComponent(oid)}/receipt`, { silent: true })
  const receipt = receiptRes?.receipt || null
  if (!receipt) throw new Error(receiptRes?.message || 'Fiş verisi alınamadı')

  const profilesRes = await api(`/api/printing/profiles?system=${encodeURIComponent(sys)}`, { silent: true })
  const profiles = Array.isArray(profilesRes?.profiles) ? profilesRes.profiles : []
  const receiptProfile = profiles.find(p => String(p.code || '') === 'receipt' && p.isActive === true) || null
  if (!receiptProfile?.id) throw new Error('Fiş profili bulunamadı (Yazıcı Ayarları > Fiş aktif olmalı)')

  const content = buildReceiptContent(receipt)
  const res = await api('/api/printing/jobs', {
    method: 'POST',
    data: {
      system: sys,
      type: 'receipt',
      profileId: String(receiptProfile.id),
      payload: { type: 'raw', content },
      meta: { orderId: String(receipt.id), copies }
    },
    silent: true
  })
  if (!res?.success) throw new Error(res?.message || 'Kuyruğa alınamadı')
  return { ok: true, queuedWithoutStation: res?.queuedWithoutStation === true }
}

