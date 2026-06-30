const ESC = '\x1B'
const GS = '\x1D'
const FS = '\x1C'

const DEFAULT_ENCODING = 'cp1254'
const DEFAULT_FONT = 'A'
const DEFAULT_ALIGN = 'left'
const PAPER_WIDTH_80 = 48
const PAPER_WIDTH_58 = 32

const TEXT = {
  other: 'Di\u011fer',
  noData: 'Veri bulunamad\u0131.',
  title: 'Z RAPORU',
  date: 'Tarih:',
  branch: '\u015eube:',
  createdAt: 'Olu\u015fturma:',
  netSalesSection: 'OZET',
  netSales: 'NET TOPLAM SATIS',
  paidSales: 'YAPILAN SATIS',
  creditSales: 'VERESIYE SATIS',
  collections: 'VERESIYE TAHSILATI',
  cashIn: 'TOPLAM TAHSILAT',
  cashInCash: 'KASADAKI TOPLAM',
  discount: '\u0130ND\u0130R\u0130M',
  orderCount: 'YAPILAN SATIS ADEDI',
  cancelRefund: '\u0130PTAL / \u0130ADE',
  summarySection: '\u00d6ZET B\u0130LG\u0130LER',
  totalProductCount: 'Toplam \u00fcr\u00fcn adedi:',
  grossSales: 'Toplam satis:',
  creditAccount: 'Veresiye / cari:',
  paymentTypesSection: '\u00d6DEME T\u0130PLER\u0130',
  type: 'Tip',
  total: 'Toplam',
  vatSection: 'KDV DA\u011eILIMI',
  rate: 'Oran',
  base: 'Matrah',
  vat: 'KDV',
  topProductsSection: 'SATILAN URUNLER',
  product: '\u00dcr\u00fcn',
  quantity: 'Adet',
  brand: 'PenPOS',
  website: 'www.penpos.cloud'
}

const toMoneyNumber = (value) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

const formatMoney = (value) => `${toMoneyNumber(value).toLocaleString('tr-TR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})} TL`

const formatInteger = (value) => `${Math.round(toMoneyNumber(value)).toLocaleString('tr-TR')}`

const formatGeneratedAt = (value) => {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('tr-TR')
}

const toRawAscii = (value) => String(value || '')
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

const visibleChars = (value) => Array.from(String(value || ''))
const visibleLength = (value) => visibleChars(value).length

const trimToWidth = (value, width) => {
  const chars = visibleChars(value)
  return chars.length <= width ? chars.join('') : chars.slice(0, Math.max(0, width)).join('')
}

const repeat = (char, width) => String(char || '-').repeat(Math.max(0, width))

const center = (value, width) => {
  const text = String(value || '').trim()
  const len = visibleLength(text)
  if (!text) return ''
  if (len >= width) return text
  const left = Math.max(0, Math.floor((width - len) / 2))
  return `${' '.repeat(left)}${text}`
}

const padEndVisible = (value, width) => {
  const text = trimToWidth(value, width)
  const len = visibleLength(text)
  return `${text}${' '.repeat(Math.max(0, width - len))}`
}

const padStartVisible = (value, width) => {
  const text = trimToWidth(value, width)
  const len = visibleLength(text)
  return `${' '.repeat(Math.max(0, width - len))}${text}`
}

const pairLine = (left, right, width) => {
  const leftText = String(left || '').trim()
  const rightText = String(right || '').trim()
  if (!rightText) return trimToWidth(leftText, width)
  const rightLen = visibleLength(rightText)
  const freeLeftWidth = Math.max(1, width - rightLen - 1)
  if (visibleLength(leftText) <= freeLeftWidth) {
    return `${padEndVisible(leftText, freeLeftWidth)} ${rightText}`
  }
  return `${trimToWidth(leftText, freeLeftWidth)}\n${padStartVisible(rightText, width)}`
}

const wrapText = (value, width) => {
  const text = String(value || '').trim()
  if (!text) return ['']
  const words = text.split(/\s+/g).filter(Boolean)
  const lines = []
  let current = ''

  const pushChunkedWord = (word) => {
    let rest = String(word || '')
    while (visibleLength(rest) > width) {
      lines.push(trimToWidth(rest, width))
      rest = visibleChars(rest).slice(width).join('')
    }
    current = rest
  }

  for (const word of words) {
    if (!current) {
      if (visibleLength(word) > width) pushChunkedWord(word)
      else current = word
      continue
    }

    const candidate = `${current} ${word}`
    if (visibleLength(candidate) <= width) {
      current = candidate
      continue
    }

    lines.push(current)
    current = ''
    if (visibleLength(word) > width) pushChunkedWord(word)
    else current = word
  }

  if (current) lines.push(current)
  return lines
}

const tableRow = (columns) => columns.map((column) => {
  const width = Math.max(1, Number(column?.width || 0))
  const value = String(column?.value || '')
  if (column?.align === 'right') return padStartVisible(value, width)
  if (column?.align === 'center') return center(value, width)
  return padEndVisible(value, width)
}).join('')

const createLayout = (paperWidth) => {
  if (paperWidth <= PAPER_WIDTH_58) {
    return {
      paperWidth: PAPER_WIDTH_58,
      paymentType: 16,
      paymentTotal: 16,
      channelType: 16,
      channelTotal: 16,
      vatRate: 5,
      vatBase: 14,
      vatAmount: 13,
      productName: 14,
      productQty: 4,
      productTotal: 14,
      staffName: 14,
      staffOrders: 4,
      staffTotal: 14,
      branchName: 14,
      branchOrders: 4,
      branchTotal: 14
    }
  }

  return {
    paperWidth: PAPER_WIDTH_80,
    paymentType: 20,
    paymentTotal: 28,
    channelType: 20,
    channelTotal: 28,
    vatRate: 6,
    vatBase: 21,
    vatAmount: 21,
    productName: 24,
    productQty: 6,
    productTotal: 18,
    staffName: 22,
    staffOrders: 8,
    staffTotal: 18,
    branchName: 22,
    branchOrders: 8,
    branchTotal: 18
  }
}

const normalizeBreakdownRows = (rows) => {
  const list = Array.isArray(rows) ? rows : []
  return list
    .map((row) => ({
      methodName: String(row?.methodName || TEXT.other),
      totalAmount: toMoneyNumber(row?.totalAmount || 0),
      count: Number(row?.count || 0)
    }))
    .filter((row) => row.totalAmount > 0)
    .sort((a, b) => (b.totalAmount - a.totalAmount) || String(a.methodName).localeCompare(String(b.methodName), 'tr'))
}

const normalizePaymentTypeRows = (summary = {}) => {
  const map = new Map()
  const cashInBreakdown = normalizeBreakdownRows(summary?.cashInBreakdown)
  for (const row of cashInBreakdown) {
    const label = `Toplam ${String(row?.methodName || TEXT.other)}`
    const key = label.toLocaleLowerCase('tr-TR')
    const current = map.get(key) || { methodName: label, totalAmount: 0 }
    current.totalAmount += toMoneyNumber(row?.totalAmount || 0)
    map.set(key, current)
  }

  return Array.from(map.values())
    .sort((a, b) => (b.totalAmount - a.totalAmount) || String(a.methodName).localeCompare(String(b.methodName), 'tr'))
}

const buildNetSalesBodyLines = (summary, width) => {
  const payments = summary?.payments || {}
  const cashIn = summary?.cashIn || {}
  const lines = [
    pairLine(TEXT.netSales, formatMoney(summary?.netSales || 0), width),
    pairLine(TEXT.paidSales, formatMoney(summary?.paidSalesTotal || 0), width),
    pairLine(TEXT.creditSales, formatMoney(payments?.credit || 0), width)
  ]

  if (Number(summary?.collectionsTotal || 0) > 0) {
    lines.push(pairLine(TEXT.collections, formatMoney(summary?.collectionsTotal || 0), width))
  }

  if (Number(cashIn?.total || 0) > 0) {
    lines.push(pairLine(TEXT.cashIn, formatMoney(cashIn?.total || 0), width))
    lines.push(pairLine(TEXT.cashInCash, formatMoney(cashIn?.cash || 0), width))
  }

  lines.push(pairLine(TEXT.discount, formatMoney(summary?.discountTotal || 0), width))
  lines.push(pairLine(TEXT.orderCount, formatInteger(summary?.orderCount || 0), width))
  return lines
}

const buildProductRows = (products, layout) => {
  const rows = []
  const list = Array.isArray(products) ? products : []
  for (const product of list) {
    const wrapped = wrapText(String(product?.name || '-').toLocaleUpperCase('tr-TR'), layout.productName)
    const qty = formatInteger(product?.quantity || 0)
    const total = formatMoney(product?.total || 0)
    wrapped.forEach((line, index) => {
      rows.push(tableRow([
        { value: line, width: layout.productName, align: 'left' },
        { value: index === 0 ? qty : '', width: layout.productQty, align: 'right' },
        { value: index === 0 ? total : '', width: layout.productTotal, align: 'right' }
      ]))
    })
  }
  return rows
}

const appendSection = (lines, title, bodyLines, width) => {
  lines.push(title)
  lines.push(repeat('-', width))
  if (Array.isArray(bodyLines) && bodyLines.length > 0) lines.push(...bodyLines)
  else lines.push(TEXT.noData)
  lines.push('')
}

const getEncodingProfile = (encoding) => {
  const value = String(encoding || DEFAULT_ENCODING).trim().toLowerCase()
  if (value === 'cp857') return { name: 'cp857', escT: 13, codePage: 857 }
  return { name: 'cp1254', escT: 48, codePage: 1254 }
}

const toTwoByte = (value) => {
  const num = Math.max(0, Number(value) || 0)
  return {
    low: String.fromCharCode(num & 0xff),
    high: String.fromCharCode((num >> 8) & 0xff)
  }
}

export const buildZReportThermalText = (report, options = {}) => {
  const layout = createLayout(Number(options.paperWidth || PAPER_WIDTH_80))
  const width = layout.paperWidth
  const summary = report?.summary || {}
  const payments = summary?.payments || {}
  const cashIn = summary?.cashIn || {}
  const paymentTypeRows = normalizePaymentTypeRows(summary)
  const vatBreakdown = Array.isArray(summary?.vatBreakdown) ? summary.vatBreakdown : []
  const lines = []

  lines.push(center(TEXT.title, width))
  lines.push(center(String(report?.businessName || TEXT.brand), width))
  lines.push(repeat('-', width))
  lines.push(pairLine(TEXT.date, String(report?.date || '-'), width))
  lines.push(pairLine(TEXT.branch, String(report?.branchName || '-'), width))
  lines.push('')
  lines.push(pairLine(TEXT.createdAt, formatGeneratedAt(report?.generatedAt), width))
  lines.push(repeat('-', width))
  lines.push('')

  appendSection(lines, TEXT.netSalesSection, buildNetSalesBodyLines(summary, width), width)

  appendSection(lines, TEXT.summarySection, [
    pairLine(TEXT.totalProductCount, formatInteger(summary?.productCount || 0), width),
    pairLine(TEXT.grossSales, formatMoney(summary?.grossSales || 0), width),
    pairLine(TEXT.discount, formatMoney(summary?.discountTotal || 0), width),
    pairLine(TEXT.cashInCash, formatMoney(cashIn?.total || 0), width),
    pairLine(TEXT.creditAccount, formatMoney(summary?.periodCreditBalance || 0), width),
    pairLine(TEXT.collections, formatMoney(summary?.collectionsTotal || 0), width),
    pairLine(TEXT.vat, formatMoney(vatBreakdown.reduce((sum, row) => sum + toMoneyNumber(row?.vat || 0), 0)), width)
  ], width)

  appendSection(lines, TEXT.paymentTypesSection, [
    tableRow([
      { value: TEXT.type, width: layout.paymentType, align: 'left' },
      { value: TEXT.total, width: layout.paymentTotal, align: 'right' }
    ]),
    repeat('-', width),
    ...paymentTypeRows.map((row) => tableRow([
      { value: row.methodName, width: layout.paymentType, align: 'left' },
      { value: formatMoney(row.totalAmount), width: layout.paymentTotal, align: 'right' }
    ]))
  ], width)

  appendSection(lines, TEXT.topProductsSection, [
    tableRow([
      { value: TEXT.product, width: layout.productName, align: 'left' },
      { value: TEXT.quantity, width: layout.productQty, align: 'right' },
      { value: TEXT.total, width: layout.productTotal, align: 'right' }
    ]),
    repeat('-', width),
    ...buildProductRows(report?.topProducts, layout)
  ], width)

  lines.push(center(TEXT.brand, width))
  lines.push(center(TEXT.website, width))
  lines.push('')
  lines.push('')
  lines.push('')

  return lines.join('\n')
}

export const buildZReportEscPosRaw = (text, options = {}) => {
  const content = toRawAscii(text)
  const encodingProfile = getEncodingProfile(options.encoding)
  const codePageBytes = toTwoByte(encodingProfile.codePage)
  const alignCommand = String(options.align || DEFAULT_ALIGN).toLowerCase() === 'center'
    ? `${ESC}a\x01`
    : `${ESC}a\x00`
  const fontCommand = String(options.font || DEFAULT_FONT).toUpperCase() === 'B'
    ? `${ESC}M\x01`
    : `${ESC}M\x00`

  return [
    `${ESC}@`,
    `${ESC}t${String.fromCharCode(encodingProfile.escT)}`,
    `${FS}}&${codePageBytes.low}${codePageBytes.high}`,
    alignCommand,
    fontCommand,
    content,
    '\n\n\n',
    `${GS}V\x41\x03`
  ].join('')
}

export const buildZReportThermalPayload = (report) => {
  const text48 = buildZReportThermalText(report, { paperWidth: PAPER_WIDTH_80 })
  const text32 = buildZReportThermalText(report, { paperWidth: PAPER_WIDTH_58 })

  return {
    encoding: DEFAULT_ENCODING,
    font: DEFAULT_FONT,
    align: DEFAULT_ALIGN,
    variants: {
      chars48: {
        paperWidth: PAPER_WIDTH_80,
        text: text48,
        raw: buildZReportEscPosRaw(text48, { align: DEFAULT_ALIGN, font: DEFAULT_FONT, encoding: DEFAULT_ENCODING })
      },
      chars32: {
        paperWidth: PAPER_WIDTH_58,
        text: text32,
        raw: buildZReportEscPosRaw(text32, { align: DEFAULT_ALIGN, font: DEFAULT_FONT, encoding: DEFAULT_ENCODING })
      }
    }
  }
}
