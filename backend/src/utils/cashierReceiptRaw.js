import sharp from 'sharp'

const ESC = 0x1b
const GS = 0x1d

const commands = {
  init: Buffer.from([ESC, 0x40]),
  alignLeft: Buffer.from([ESC, 0x61, 0]),
  alignCenter: Buffer.from([ESC, 0x61, 1]),
  boldOn: Buffer.from([ESC, 0x45, 1]),
  boldOff: Buffer.from([ESC, 0x45, 0]),
  doubleHeight: Buffer.from([GS, 0x21, 1]),
  normalSize: Buffer.from([GS, 0x21, 0]),
  cut: Buffer.from([GS, 0x56, 0x41, 3])
}

const ascii = (value) => String(value ?? '')
  .replace(/İ/g, 'I')
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
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^\x20-\x7e]/g, '?')

const money = (value) => `${(Number.isFinite(Number(value)) ? Number(value) : 0).toFixed(2)} TL`

const wrapText = (value, width) => {
  const text = ascii(value).trim()
  if (!text) return ['']
  const lines = []
  let current = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (word.length > width) {
      if (current) lines.push(current)
      current = ''
      for (let offset = 0; offset < word.length; offset += width) {
        const part = word.slice(offset, offset + width)
        if (part.length === width) lines.push(part)
        else current = part
      }
      continue
    }
    if (!current) current = word
    else if (current.length + word.length + 1 <= width) current += ` ${word}`
    else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines.length ? lines : ['']
}

const centerText = (value, width) => {
  const text = ascii(value).trim()
  return wrapText(text, width).map((part) => part.padStart(Math.floor((width + part.length) / 2)).padEnd(width))
}

const pairRow = (label, value, width) => {
  const left = ascii(label).trim()
  const right = ascii(value).trim()
  if (left.length + right.length + 1 <= width) {
    return [`${left}${' '.repeat(width - left.length - right.length)}${right}`]
  }
  return [...wrapText(left, width), ...(right.length <= width ? [right.padStart(width)] : wrapText(right, width))]
}

const formatDateTime = (value) => {
  const parsed = value ? new Date(value) : new Date()
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed
  return ascii(`${date.toLocaleDateString('tr-TR')} ${date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`)
}

const formatQty = (value) => {
  const qty = Number(value)
  return `x${Number.isFinite(qty) && qty > 0 ? qty : 1}`
}

const itemRows = (item, width) => {
  const price = money(item?.subtotal)
  const qty = formatQty(item?.qty)
  const nameWidth = Math.max(1, width - price.length - qty.length - 2)
  const nameLines = wrapText(item?.nameSnapshot || item?.productName || '-', nameWidth)
  const rows = [`${nameLines[0].padEnd(nameWidth)} ${qty} ${price}`]
  rows.push(...nameLines.slice(1))
  const note = ascii(item?.note || '').trim()
  if (note) rows.push(...wrapText(`  Not: ${note}`, width))
  return rows
}

const tableItemRows = (item, width) => {
  const qty = Number(item?.qty)
  const quantity = Number.isFinite(qty) && qty > 0 ? String(qty) : '1'
  const unitPrice = item?.priceSnapshot
    ?? item?.unitPrice
    ?? (qty > 0 ? Number(item?.subtotal || 0) / qty : item?.subtotal)
  const nameLines = wrapText(item?.nameSnapshot || item?.productName || '-', width)
  const rows = [
    ...nameLines,
    ...pairRow(`${quantity} x ${money(unitPrice)}`, money(item?.subtotal), width)
  ]
  const note = ascii(item?.note || '').trim()
  if (note) rows.push(...wrapText(`  Not: ${note}`, width))
  return rows
}

const paymentLines = (receipt, width) => {
  const payments = Array.isArray(receipt?.payments) ? receipt.payments : []
  const details = payments
    .map((payment) => {
      const method = ascii(payment?.methodLabel || payment?.methodName || payment?.method || '').trim()
      if (!method) return ''
      return Number.isFinite(Number(payment?.amount))
        ? `${method}: ${money(payment.amount)}`
        : method
    })
    .filter(Boolean)
  if (details.length) return details.flatMap((detail) => wrapText(detail, width))
  const method = ascii(receipt?.paymentMethod || '').trim()
  if (method) return wrapText(method, width)
  return [String(receipt?.paymentStatus || '') === 'paid' ? 'Tahsil edildi' : 'Bekliyor']
}

export const buildCashierReceiptLines = (receipt, width = 48) => {
  const lineWidth = width <= 32 ? 32 : 48
  const quickSale = String(receipt?.saleSource || '') === 'quick-sale'
  const activeItems = (Array.isArray(receipt?.items) ? receipt.items : [])
    .filter((item) => item && String(item.status || '') !== 'cancelled')
  const receiptNo = String(receipt?.receiptNo || receipt?.id || '-')
  const lines = []

  if (quickSale) {
    lines.push(...centerText('HIZLI SATIS', lineWidth))
    lines.push(...pairRow('Fis No:', receiptNo, lineWidth))
    lines.push(...pairRow('Tarih / Saat:', formatDateTime(receipt?.createdAt), lineWidth))
    for (const item of activeItems) lines.push(...itemRows(item, lineWidth))
    lines.push('-'.repeat(lineWidth))
    lines.push(...pairRow('TOPLAM', money(receipt?.totals?.grandTotal ?? receipt?.netTotal), lineWidth))
    lines.push(...pairRow('Odeme:', paymentLines(receipt, lineWidth).join(', '), lineWidth))
    const note = ascii(receipt?.note || '').trim()
    if (note) lines.push(...wrapText(`Not: ${note}`, lineWidth))
    lines.push(...centerText('TESEKKUR EDERIZ', lineWidth))
    return lines
  }

  const tableName = ascii(receipt?.tableName || '').trim()
  const paidTotal = Number(receipt?.paidTotal || 0)
  const balanceDue = Number(receipt?.balanceDue || 0)
  const paymentStatus = balanceDue <= 0.01 ? 'ODENDI' : (paidTotal > 0 ? 'KISMI ODENDI' : 'BEKLIYOR')
  lines.push(...centerText('MASA SIPARISI', lineWidth))
  lines.push(...pairRow('Masa:', tableName || '-', lineWidth))
  lines.push(...pairRow('Fis No:', receiptNo, lineWidth))
  lines.push(...pairRow('Siparis No:', String(receipt?.orderNo || '-'), lineWidth))
  lines.push(...pairRow('Tarih / Saat:', formatDateTime(receipt?.createdAt), lineWidth))
  const cashierName = ascii(receipt?.cashierName || '').trim()
  if (cashierName) lines.push(...pairRow('Kasiyer:', cashierName, lineWidth))
  lines.push(...pairRow('Durum:', paymentStatus, lineWidth))
  lines.push('-'.repeat(lineWidth))
  for (const item of activeItems) lines.push(...tableItemRows(item, lineWidth))
  lines.push('-'.repeat(lineWidth))
  lines.push(...pairRow('Ara Toplam:', money(receipt?.totals?.subtotal), lineWidth))
  const discountTotal = Number(receipt?.discountTotal || receipt?.totals?.discountTotal || 0)
  if (discountTotal > 0) lines.push(...pairRow('Indirim:', money(discountTotal), lineWidth))
  lines.push(...pairRow('Odenen:', money(paidTotal), lineWidth))
  lines.push(...pairRow('Kalan:', money(balanceDue), lineWidth))
  lines.push(...pairRow('Bakiye:', money(receipt?.displayBalance), lineWidth))
  lines.push(...pairRow('GENEL TOPLAM:', money(receipt?.totals?.grandTotal ?? receipt?.netTotal), lineWidth))
  lines.push(...wrapText('Odeme Bilgisi:', lineWidth))
  lines.push(...paymentLines(receipt, lineWidth))
  const note = ascii(receipt?.note || '').trim()
  if (note) lines.push(...wrapText(`Genel Not: ${note}`, lineWidth))
  lines.push(...centerText('AFIYET OLSUN', lineWidth))
  return lines
}

const buildLogoRaster = async (logoBuffer, paperDots) => {
  if (!logoBuffer?.length) return null
  const maxWidth = Math.floor(paperDots * 0.8)
  const { data, info } = await sharp(logoBuffer)
    .rotate()
    .flatten({ background: '#ffffff' })
    .resize({ width: maxWidth, height: 120, fit: 'inside', withoutEnlargement: true })
    .greyscale()
    .threshold(160)
    .raw()
    .toBuffer({ resolveWithObject: true })
  const widthBytes = Math.ceil(paperDots / 8)
  const raster = Buffer.alloc(widthBytes * info.height)
  const left = Math.floor((paperDots - info.width) / 2)
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width) + x] >= 128) continue
      const dot = left + x
      raster[(y * widthBytes) + Math.floor(dot / 8)] |= 0x80 >> (dot % 8)
    }
  }
  const widthLow = widthBytes & 0xff
  const widthHigh = (widthBytes >> 8) & 0xff
  const heightLow = info.height & 0xff
  const heightHigh = (info.height >> 8) & 0xff
  return Buffer.concat([
    Buffer.from([GS, 0x76, 0x30, 0, widthLow, widthHigh, heightLow, heightHigh]),
    raster,
    Buffer.from([0x0a])
  ])
}

export const buildCashierReceiptRaw = async (receipt, { widthMm = 80, logoBuffer = null } = {}) => {
  const width = Number(widthMm) <= 58 ? 32 : 48
  const paperDots = width === 32 ? 384 : 576
  const businessName = ascii(receipt?.businessName || 'PENPOS').trim()
  const lines = buildCashierReceiptLines(receipt, width)
  const logo = await buildLogoRaster(logoBuffer, paperDots)
  const output = [
    commands.init,
    commands.alignCenter,
    ...(logo ? [logo] : []),
    commands.boldOn,
    ...wrapText(businessName.toUpperCase(), width).map((text) => Buffer.from(`${text}\n`, 'ascii')),
    commands.boldOff,
    commands.normalSize,
    commands.alignLeft
  ]
  const quickSale = String(receipt?.saleSource || '') === 'quick-sale'
  const titleIndex = 0
  output.push(commands.alignCenter, commands.boldOn, commands.doubleHeight, Buffer.from(`${ascii(lines[titleIndex] || '').trim()}\n`, 'ascii'), commands.normalSize, commands.boldOff, commands.alignLeft)
  for (const text of lines.slice(1)) {
    const tableHighlight = !quickSale
      && (text.trimStart().startsWith('Masa:') || text.trimStart().startsWith('GENEL TOPLAM:'))
    if (tableHighlight) output.push(commands.boldOn)
    if (!quickSale && text.trimStart().startsWith('GENEL TOPLAM:')) output.push(commands.doubleHeight)
    output.push(Buffer.from(`${text}\n`, 'ascii'))
    if (!quickSale && text.trimStart().startsWith('GENEL TOPLAM:')) output.push(commands.normalSize)
    if (tableHighlight) output.push(commands.boldOff)
  }
  if (!quickSale && lines.length === 0) output.push(Buffer.from('\n', 'ascii'))
  output.push(commands.cut)
  return Buffer.concat(output)
}
