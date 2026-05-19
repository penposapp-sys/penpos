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

const normalizeText = (value) => String(value ?? '')
  .replace(/\r\n/g, '\n')
  .replace(/\r/g, '\n')
  .trim()

const toAscii = (value) => normalizeText(value)
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
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')

const formatTime = (value) => {
  try {
    const date = value ? new Date(value) : new Date()
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

const wrapText = (text, width) => {
  const src = normalizeText(text)
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

const buildDivider = (width) => '-'.repeat(Math.max(8, width))

const center = (text, width) => {
  const value = normalizeText(text)
  if (!value) return ''
  if (value.length >= width) return value
  const left = Math.floor((width - value.length) / 2)
  return `${' '.repeat(Math.max(0, left))}${value}`
}

const buildKitchenReceiptText = (order, items, width = 48, options = {}) => {
  const tableName = toAscii(options.tableName || order?.tableName || order?.tableNo || '')
  const createdByName = toAscii(options.createdByName || order?.createdByName || '')
  const orderNote = toAscii(options.orderNote || order?.note || '')
  const customerName = toAscii(options.customerName || order?.customerName || '')
  const customerPhone = toAscii(options.customerPhone || order?.customerPhone || '')
  const customerAddress = toAscii(options.customerAddress || order?.customerAddress || '')
  const paymentLine = toAscii(options.paymentLine || '')
  const timeText = formatTime(options.createdAt || order?.updatedAt || order?.createdAt)
  const isPackage = String(order?.saleType || '') === 'delivery' || String(order?.servingType || '') === 'package'
  const lines = []

  lines.push(center(isPackage ? '*** PAKET SIPARISI ***' : 'MUTFAK FISI', width))
  if (isPackage) {
    if (customerName) lines.push(...wrapText(`Musteri: ${customerName}`, width))
    if (customerPhone) lines.push(...wrapText(`Telefon: ${customerPhone}`, width))
    if (customerAddress) {
      lines.push('Adres:')
      lines.push(...wrapText(customerAddress, width))
    }
  } else if (tableName) {
    lines.push(...wrapText(`Masa: ${tableName}`, width))
  }
  if (timeText) lines.push(`Saat: ${timeText}`)
  if (createdByName) lines.push(...wrapText(`Alan: ${createdByName}`, width))
  if (paymentLine) lines.push(...wrapText(`Odeme: ${paymentLine}`, width))
  if (orderNote) lines.push(...wrapText(`Not: ${orderNote}`, width))
  lines.push('')

  for (const item of (Array.isArray(items) ? items : [])) {
    const qty = Math.max(1, Number(item?.qty || 1))
    const weightGrams = Number(item?.weightGrams || 0)
    const amountLabel = item?.isWeightBased === true && weightGrams > 0 ? `${weightGrams} GR` : `${qty} ADET`
    const name = toAscii(item?.nameSnapshot || item?.productName || '-')
    const title = `${amountLabel} ${name}`.toUpperCase()
    lines.push(...wrapText(title, width))
    const itemNote = toAscii(item?.note || '')
    if (itemNote) {
      for (const noteLine of wrapText(`- ${itemNote}`, Math.max(10, width - 2))) {
        lines.push(`  ${noteLine}`)
      }
    }
    lines.push('')
  }

  lines.push(buildDivider(width))
  return `${lines.join('\n').trimEnd()}\n`
}

export const buildKitchenReceiptRaw = (order, items, options = {}) => {
  const text48 = buildKitchenReceiptText(order, items, 48, options)
  const text32 = buildKitchenReceiptText(order, items, 32, options)
  return {
    text: text48,
    raw: [
      cmd.init,
      cmd.alignCenter,
      cmd.boldOn,
      cmd.normalSize,
      `${center('MUTFAK FISI', 48)}\n`,
      cmd.boldOff,
      cmd.alignLeft,
      `${text48.replace(/^MUTFAK FISI\s*\n?/u, '')}\n`,
      '\n',
      cmd.cut
    ].join(''),
    thermalVariants: {
      chars48: {
        text: text48,
        raw: [
          cmd.init,
          cmd.alignCenter,
          cmd.boldOn,
          cmd.normalSize,
          `${center('MUTFAK FISI', 48)}\n`,
          cmd.boldOff,
          cmd.alignLeft,
          `${text48.replace(/^MUTFAK FISI\s*\n?/u, '')}\n`,
          '\n',
          cmd.cut
        ].join('')
      },
      chars32: {
        text: text32,
        raw: [
          cmd.init,
          cmd.alignCenter,
          cmd.boldOn,
          cmd.normalSize,
          `${center('MUTFAK FISI', 32)}\n`,
          cmd.boldOff,
          cmd.alignLeft,
          `${text32.replace(/^MUTFAK FISI\s*\n?/u, '')}\n`,
          '\n',
          cmd.cut
        ].join('')
      }
    }
  }
}
