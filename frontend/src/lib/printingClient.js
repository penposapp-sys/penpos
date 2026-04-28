import { api } from './apiClient.js'

const normalizeSystem = (value) => (String(value || '').trim().toLowerCase() === 'canteen' ? 'canteen' : 'kermes')

const RECEIPT_WIDTH = 42
const ESC = '\x1B'
const GS = '\x1D'

const cmd = {
  init: ESC + '@',
  alignLeft: ESC + 'a' + '\x00',
  alignCenter: ESC + 'a' + '\x01',
  boldOn: ESC + 'E' + '\x01',
  boldOff: ESC + 'E' + '\x00',
  normalSize: GS + '!' + '\x00',
  cut: GS + 'V' + '\x41' + '\x03'
}

const toPrintAscii = (value) => String(value || '')
  .replace(/İ/g, 'I')
  .replace(/İ/g, 'I')
  .replace(/ı/g, 'i')
  .replace(/Ş/g, 'S')
  .replace(/ş/g, 's')
  .replace(/Ğ/g, 'G')
  .replace(/ğ/g, 'g')
  .replace(/Ü/g, 'U')
  .replace(/ü/g, 'u')
  .replace(/Ö/g, 'O')
  .replace(/ö/g, 'o')
  .replace(/Ç/g, 'C')
  .replace(/ç/g, 'c')

const money = (value) => `${Number(value || 0).toFixed(2)} TL`

const splitDateTime = (value) => {
  const date = value ? new Date(value) : new Date()
  const full = date.toLocaleString('tr-TR')
  const [datePart = full, timePart = ''] = full.split(' ')
  return { datePart, timePart }
}

const line = (char = '-') => `${String(char || '-').repeat(RECEIPT_WIDTH)}\n`

const center = (text) => {
  const value = toPrintAscii(text).trim()
  if (!value) return '\n'
  if (value.length >= RECEIPT_WIDTH) return `${value}\n`
  const left = Math.floor((RECEIPT_WIDTH - value.length) / 2)
  return `${' '.repeat(left)}${value}\n`
}

const right = (text) => {
  const value = toPrintAscii(text).trim()
  if (!value) return '\n'
  if (value.length >= RECEIPT_WIDTH) return `${value}\n`
  return `${' '.repeat(RECEIPT_WIDTH - value.length)}${value}\n`
}

const wrapText = (text, width = RECEIPT_WIDTH) => {
  const src = toPrintAscii(text).trim()
  if (!src) return ['']
  const words = src.split(/\s+/g).filter(Boolean)
  const lines = []
  let current = ''
  for (const word of words) {
    if (!current) {
      current = word
      continue
    }
    if ((current + ' ' + word).length <= width) {
      current += ' ' + word
      continue
    }
    lines.push(current)
    current = word
  }
  if (current) lines.push(current)
  return lines.length > 0 ? lines : ['']
}

const pairRow = (left, rightText, width = RECEIPT_WIDTH) => {
  const leftValue = toPrintAscii(left).trim()
  const rightValue = toPrintAscii(rightText).trim()
  if (!leftValue) return right(rightValue)
  if (leftValue.length + rightValue.length + 1 <= width) {
    return `${leftValue}${' '.repeat(width - leftValue.length - rightValue.length)}${rightValue}\n`
  }
  return `${leftValue}\n${right(rightValue)}`
}

const itemRow = ({ name, qty, subtotal, note }) => {
  const rightValue = money(subtotal)
  const qtyLabel = `x${Math.max(1, Number(qty || 1))}`
  const leftLines = wrapText(name, RECEIPT_WIDTH - rightValue.length - 1)
  let out = `${leftLines[0]}${' '.repeat(Math.max(1, RECEIPT_WIDTH - leftLines[0].length - rightValue.length))}${rightValue}\n`
  for (let i = 1; i < leftLines.length; i++) out += `${leftLines[i]}\n`
  out += `${qtyLabel}\n`
  const itemNote = toPrintAscii(note).trim()
  if (itemNote) {
    const noteLines = wrapText(`Not: ${itemNote}`, RECEIPT_WIDTH)
    for (const lineText of noteLines) out += `${lineText}\n`
  }
  return out
}

const derivePaymentType = (receipt) => {
  const payments = Array.isArray(receipt?.payments) ? receipt.payments : []
  if (payments.length > 0) {
    return payments
      .map((payment) => toPrintAscii(payment?.methodLabel || payment?.method || '').trim())
      .filter(Boolean)
      .join(', ')
  }
  return toPrintAscii(receipt?.paymentMethod || '').trim() || (String(receipt?.paymentStatus || '') === 'paid' ? 'Odendi' : 'Bekliyor')
}

const deriveReceiptStatus = (receipt) => {
  if (String(receipt?.status || '') === 'cancelled') return 'IPTAL'
  return String(receipt?.paymentStatus || '') === 'paid' ? 'ODENDI' : 'ODENMEDI'
}

const buildReceiptContent = (receipt) => {
  const businessName = String(receipt?.businessName || 'PENPOS').trim()
  const receiptNo = receipt?.receiptNo || String(receipt?.id || '').slice(-8).toUpperCase() || '-'
  const orderNo = receipt?.orderNo || '-'
  const { datePart, timePart } = splitDateTime(receipt?.createdAt)
  const tableName = String(receipt?.tableName || '').trim()
  const cashierName = String(receipt?.createdByName || '').trim()
  const activeItems = (Array.isArray(receipt?.items) ? receipt.items : []).filter((it) => String(it?.status || '') !== 'cancelled')
  const cancelledItems = (Array.isArray(receipt?.items) ? receipt.items : []).filter((it) => String(it?.status || '') === 'cancelled')
  const subtotal = Number(receipt?.totals?.subtotal ?? receipt?.totals?.total ?? 0)
  const grandTotal = Number(receipt?.totals?.grandTotal ?? receipt?.netTotal ?? 0)
  const discountTotal = Number(receipt?.discountTotal ?? receipt?.totals?.discountTotal ?? 0)
  const discountPercent = Number(receipt?.discountPercent || 0)
  const paidTotal = Number(receipt?.paidTotal ?? receipt?.totals?.paidTotal ?? 0)
  const balanceDue = Number(receipt?.balanceDue ?? receipt?.totals?.balanceDue ?? Math.max(0, grandTotal - paidTotal))
  const displayBalance = Number(receipt?.displayBalance ?? 0)
  const lines = []

  lines.push(center('HOS GELDINIZ').trimEnd())
  lines.push(line('=').trimEnd())
  lines.push(pairRow('Fis No:', String(receiptNo)).trimEnd())
  if (String(orderNo).trim() && String(orderNo).trim() !== '-') {
    lines.push(pairRow('Siparis No:', String(orderNo)).trimEnd())
  }
  if (tableName) lines.push(pairRow('Masa:', tableName).trimEnd())
  lines.push(pairRow('Tarih:', datePart).trimEnd())
  if (timePart) lines.push(pairRow('Saat:', timePart).trimEnd())
  if (cashierName) lines.push(pairRow('Kasiyer:', cashierName).trimEnd())
  lines.push(pairRow('Durum:', deriveReceiptStatus(receipt)).trimEnd())
  lines.push(line('-').trimEnd())

  for (const item of activeItems) {
    lines.push(itemRow({
      name: item?.nameSnapshot || '',
      qty: item?.qty || 1,
      subtotal: item?.subtotal || 0,
      note: item?.note || ''
    }).trimEnd())
    lines.push('')
  }

  if (cancelledItems.length > 0) {
    lines.push(line('-').trimEnd())
    lines.push(center('IPTAL URUNLER').trimEnd())
    lines.push(line('-').trimEnd())
    for (const item of cancelledItems) {
      const name = `IPTAL - ${toPrintAscii(item?.nameSnapshot || '-')}`
      lines.push(...wrapText(name))
      lines.push(`x${Math.max(1, Number(item?.qty || 1))}`)
      lines.push(...wrapText(`Iptal sebebi: ${String(item?.note || '').trim() || 'Sebep belirtilmedi'}`))
      lines.push('')
    }
  }

  lines.push(line('-').trimEnd())
  lines.push(pairRow('Ara Toplam:', money(subtotal)).trimEnd())
  if (discountPercent > 0 || discountTotal > 0) {
    lines.push(pairRow(`Indirim${discountPercent > 0 ? ` (%${discountPercent})` : ''}:`, money(discountTotal)).trimEnd())
  }
  lines.push(pairRow('Odenen:', money(paidTotal)).trimEnd())
  lines.push(pairRow('Kalan:', money(balanceDue)).trimEnd())
  lines.push(pairRow('Bakiye:', money(displayBalance)).trimEnd())
  lines.push(pairRow('TOPLAM:', money(grandTotal)).trimEnd())
  lines.push(pairRow('Odeme:', derivePaymentType(receipt)).trimEnd())
  if (receipt?.note) {
    lines.push(line('-').trimEnd())
    lines.push(...wrapText(`Genel Not: ${String(receipt.note || '').trim()}`))
  }
  lines.push(line('=').trimEnd())
  lines.push(center('Afiyet olsun').trimEnd())

  return [
    cmd.init,
    cmd.alignCenter,
    cmd.boldOn,
    cmd.normalSize,
    `${toPrintAscii(businessName).toUpperCase()}\n`,
    cmd.boldOff,
    cmd.alignLeft,
    `${lines.join('\n')}\n`,
    '\n\n',
    cmd.cut
  ].join('')
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
