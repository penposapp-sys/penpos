import PDFDocument from 'pdfkit'
import path from 'path'
import { fileURLToPath } from 'url'
import * as logger from '../utils/logger.js'

const mmToPt = (mm) => Number(mm) * 2.8346456692913384

const safeMoney = (n) => {
  const v = Number(n || 0)
  return Number.isFinite(v) ? v : 0
}

const safeText = (v) => String(v || '').trim()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const getTrFontPath = () => {
  return path.join(__dirname, '..', '..', 'assets', 'fonts', 'DejaVuSans.ttf')
}

const getTrBoldFontPath = () => {
  return path.join(__dirname, '..', '..', 'assets', 'fonts', 'DejaVuSans-Bold.ttf')
}

const applyTrFont = (doc) => {
  try {
    const fontPath = getTrFontPath()
    doc.registerFont('tr', fontPath)
  } catch {
  }
  try {
    const boldPath = getTrBoldFontPath()
    doc.registerFont('trBold', boldPath)
  } catch {
  }
  try {
    doc.font('tr')
  } catch {
  }
}

const useFont = (doc, key) => {
  try {
    doc.font(key)
    return
  } catch {
  }
  try {
    doc.font('tr')
  } catch {
  }
}

const measureReceiptHeightPt = ({
  widthPt,
  margins,
  tenantName,
  dateStr,
  orderNo,
  tableName,
  paidStatus,
  items,
  totals,
  isPackage,
  customerName,
  customerPhone,
  customerAddress
}) => {
  const tmp = new PDFDocument({ size: [widthPt, 2000], margins })
  applyTrFont(tmp)
  tmp.lineGap(0)

  const w = widthPt - margins.left - margins.right
  const leftWidth = Math.max(40, Math.floor(w * 0.72))
  const rightWidth = Math.max(40, w - leftWidth)

  const hText = (text, { font, size, align } = {}) => {
    useFont(tmp, font || 'tr')
    tmp.fontSize(Number(size || 10))
    const s = String(text || '')
    if (!s) return 0
    return tmp.heightOfString(s, { width: w, align: align || 'left' })
  }

  const hRow = ({ left, right, size = 10 }) => {
    useFont(tmp, 'tr')
    tmp.fontSize(Number(size || 10))
    const hl = tmp.heightOfString(String(left || ''), { width: leftWidth, align: 'left' })
    const hr = tmp.heightOfString(String(right || ''), { width: rightWidth, align: 'right' })
    return Math.max(hl, hr)
  }

  let h = 0

  h += hText(tenantName, { font: 'trBold', size: 13, align: 'center' })
  h += 2

  if (isPackage) {
    h += hText('PAKET SERVİS', { font: 'trBold', size: 13, align: 'center' })
    h += 2
    if (customerName) h += hText(`Müşteri: ${customerName}`, { font: 'tr', size: 11 }) + 1
    if (customerPhone) h += hText(`Telefon: ${customerPhone}`, { font: 'tr', size: 11 }) + 1
    if (customerAddress) {
      h += hText('Adres:', { font: 'tr', size: 11 }) + 1
      h += hText(customerAddress, { font: 'tr', size: 10 }) + 2
    }
    h += 6
  }

  if (dateStr) {
    h += hText(dateStr, { font: 'tr', size: 10, align: 'center' })
    h += 4
  }

  h += hText(`Sipariş: ${orderNo || '-'}`, { font: 'tr', size: 11 }) + 1
  if (tableName) h += hText(`Masa: ${tableName}`, { font: 'tr', size: 11 }) + 1
  h += hText(`Durum: ${paidStatus === 'paid' ? 'ÖDENDİ' : 'ÖDENMEDİ'}`, { font: 'tr', size: 11 })
  h += 6

  for (const it of (Array.isArray(items) ? items : [])) {
    const name = safeText(it?.nameSnapshot) || '-'
    const qty = Math.max(1, Number(it?.qty || 1))
    const subtotal = safeMoney(it?.subtotal)
    h += hRow({ left: `${name} x${qty}`, right: `${subtotal.toFixed(2)} TL`, size: 10 })
    h += 2
  }

  h += 8
  const net = safeMoney(totals?.grandTotal ?? totals?.netTotal ?? totals?.total)
  h += hText(`TOPLAM: ${net.toFixed(2)} TL`, { font: 'trBold', size: 13, align: 'right' })
  h += 2

  return Math.ceil(h + margins.top + margins.bottom)
}

export const renderTextPdfBase64 = async ({ text, widthMm, heightMm, fontSize = 10, marginMm = 4 } = {}) => {
  const content = String(text || '')
  const w = Math.max(20, Number(widthMm || 80))
  const h = Math.max(20, Number(heightMm || 200))
  const margin = Math.max(0, Number(marginMm || 0))

  const doc = new PDFDocument({
    size: [mmToPt(w), mmToPt(h)],
    margins: { top: mmToPt(margin), left: mmToPt(margin), right: mmToPt(margin), bottom: mmToPt(margin) }
  })
  applyTrFont(doc)

  const chunks = []
  doc.on('data', (d) => chunks.push(d))
  const done = new Promise((resolve, reject) => {
    doc.on('end', resolve)
    doc.on('error', reject)
  })

  doc.fontSize(Math.max(6, Math.min(18, Number(fontSize || 10))))
  doc.text(content, { width: mmToPt(w - margin * 2), align: 'left' })
  doc.end()

  await done
  return Buffer.concat(chunks).toString('base64')
}

export const renderReceiptPdfBase64 = async ({
  tenantName,
  createdAt,
  orderNo,
  tableName,
  items,
  totals,
  paidStatus,
  widthMm,
  isPackage,
  customerName,
  customerPhone,
  customerAddress
} = {}) => {
  const tName = safeText(tenantName) || 'PENPOS'
  const dt = createdAt ? new Date(createdAt) : new Date()
  const dateStr = Number.isFinite(dt.getTime()) ? dt.toLocaleString('tr-TR') : ''
  const oNo = orderNo !== undefined && orderNo !== null ? String(orderNo) : ''
  const tNo = safeText(tableName)
  const its = Array.isArray(items) ? items : []
  const requestedMm = Math.max(58, Number(widthMm || 80))
  const paperMm = Math.max(58, Math.min(76, requestedMm))
  const widthPt = mmToPt(paperMm)
  const pkg = isPackage === true || String(isPackage || '') === 'true'
  const pkgCustomer = safeText(customerName)
  const pkgPhone = safeText(customerPhone)
  const pkgAddress = safeText(customerAddress)

  const margins = { top: 4, left: 6, right: 6, bottom: 6 }
  const measuredHeightPt = measureReceiptHeightPt({
    widthPt,
    margins,
    tenantName: tName,
    dateStr,
    orderNo: oNo,
    tableName: tNo,
    paidStatus,
    items: its,
    totals,
    isPackage: pkg,
    customerName: pkgCustomer,
    customerPhone: pkgPhone,
    customerAddress: pkgAddress
  })

  const headerH = pkg ? 150 : 110
  const lineH = 20
  const footerH = 140
  const safetyH = 80
  const formulaHeightPt = headerH + (its.length * lineH) + footerH + safetyH

  const heightPt = Math.max(
    260,
    formulaHeightPt,
    measuredHeightPt + 80,
    widthPt + 120
  )

  const doc = new PDFDocument({ autoFirstPage: false, margins })
  doc.addPage({ size: [widthPt, heightPt], margins, layout: 'portrait' })
  applyTrFont(doc)
  doc.lineGap(0)
  const topShiftMm = Number(process.env.RECEIPT_TOP_SHIFT_MM || 0)
  const topShiftPt = Number.isFinite(topShiftMm) ? mmToPt(topShiftMm) : 0
  doc.y = Math.max(0, doc.page.margins.top - topShiftPt)
  const chunks = []
  doc.on('data', (d) => chunks.push(d))
  const done = new Promise((resolve, reject) => {
    doc.on('end', resolve)
    doc.on('error', reject)
  })

  useFont(doc, 'trBold')
  doc.fontSize(13).text(tName, { align: 'center' })
  useFont(doc, 'tr')
  doc.fontSize(10)
  doc.y += 2

  if (pkg) {
    useFont(doc, 'trBold')
    doc.fontSize(13).text('PAKET SERVİS', { align: 'center' })
    useFont(doc, 'tr')
    doc.y += 2

    doc.fontSize(11)
    if (pkgCustomer) doc.text(`Müşteri: ${pkgCustomer}`)
    if (pkgPhone) doc.text(`Telefon: ${pkgPhone}`)
    if (pkgAddress) {
      doc.text('Adres:')
      doc.fontSize(10).text(pkgAddress, { width: doc.page.width - doc.page.margins.left - doc.page.margins.right, align: 'left' })
      doc.fontSize(11)
    }

    doc.y += 3
    doc.moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .dash(2, { space: 2 })
      .stroke()
      .undash()
    doc.y += 6
  }

  if (dateStr) {
    doc.fontSize(10).fillColor('#111').text(dateStr, { align: 'center' })
    doc.fillColor('#000')
    doc.y += 4
  }

  doc.fontSize(11)
  doc.text(`Sipariş: ${oNo || '-'}`)
  if (tNo) doc.text(`Masa: ${tNo}`)
  doc.text(`Durum: ${paidStatus === 'paid' ? 'ÖDENDİ' : 'ÖDENMEDİ'}`)
  doc.y += 3
  doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke()
  doc.y += 4

  doc.fontSize(10)
  const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right
  const leftWidth = Math.max(40, Math.floor(contentWidth * 0.72))
  const rightWidth = Math.max(40, contentWidth - leftWidth)
  const leftX = doc.page.margins.left
  const rightX = doc.page.width - doc.page.margins.right - rightWidth

  for (const it of its) {
    const name = safeText(it?.nameSnapshot) || '-'
    const qty = Math.max(1, Number(it?.qty || 1))
    const subtotal = safeMoney(it?.subtotal)
    const y0 = doc.y
    doc.text(`${name} x${qty}`, leftX, y0, { width: leftWidth, align: 'left' })
    doc.text(`${subtotal.toFixed(2)} TL`, rightX, y0, { width: rightWidth, align: 'right' })
    const y1 = Math.max(doc.y, y0)
    doc.y = y1 + 2
  }

  doc.y += 2
  doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke()
  doc.y += 6

  const net = safeMoney(totals?.grandTotal ?? totals?.netTotal ?? totals?.total)
  useFont(doc, 'trBold')
  doc.fontSize(12).text(`TOPLAM: ${net.toFixed(2)} TL`, { width: contentWidth, align: 'right' })
  useFont(doc, 'tr')

  if (process.env.NODE_ENV !== 'production') {
    try {
      logger.info('[RECEIPT_END]', { y: doc.y, pageH: doc.page.height, bottom: doc.page.margins.bottom, width: doc.page.width })
    } catch {
    }
  }

  doc.end()
  await done
  return Buffer.concat(chunks).toString('base64')
}

export const renderLabelPdfBase64 = async ({ topText, productText, qty, widthMm, heightMm } = {}) => {
  const top = safeText(topText)
  const product = safeText(productText)
  const q = Math.max(1, Number(qty || 1))
  const w = Math.max(20, Number(widthMm || 50))
  const h = Math.max(20, Number(heightMm || 30))

  const doc = new PDFDocument({
    size: [mmToPt(w), mmToPt(h)],
    margins: { top: mmToPt(2), left: mmToPt(2), right: mmToPt(2), bottom: mmToPt(2) }
  })
  applyTrFont(doc)
  const chunks = []
  doc.on('data', (d) => chunks.push(d))
  const done = new Promise((resolve, reject) => {
    doc.on('end', resolve)
    doc.on('error', reject)
  })

  doc.fontSize(10).text(top || '', { align: 'left' })
  doc.moveDown(0.2)
  doc.fontSize(11).text(product || '-', { align: 'left' })
  doc.fontSize(18).text(`x${q}`, { align: 'right' })

  doc.end()
  await done
  return Buffer.concat(chunks).toString('base64')
}
