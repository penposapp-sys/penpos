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

const textMediumFlow = (doc, text, options = {}) => {
  const x0 = doc.x
  const y0 = doc.y
  useFont(doc, 'tr')
  doc.text(String(text || ''), options)
  const x1 = doc.x
  const y1 = doc.y
  try {
    useFont(doc, 'tr')
    doc.text(String(text || ''), x0, y0, options)
  } catch {
  }
  doc.x = x1
  doc.y = y1
}

const textMediumAt = (doc, text, x, y, options = {}) => {
  useFont(doc, 'tr')
  doc.text(String(text || ''), x, y, options)
  const x1 = doc.x
  const y1 = doc.y
  try {
    useFont(doc, 'tr')
    doc.text(String(text || ''), x, y, options)
  } catch {
  }
  doc.x = x1
  doc.y = y1
}

const fitFontSize = (doc, text, width, height, { min = 6, max = 18 } = {}) => {
  const content = String(text || '').trim()
  if (!content) return min
  for (let size = max; size >= min; size -= 0.5) {
    useFont(doc, 'tr')
    doc.fontSize(size)
    const measured = doc.heightOfString(content, { width, align: 'left' })
    if (measured <= height) return size
  }
  return min
}

const fitFontSizeWithLineLimit = (doc, text, width, height, { min = 6, max = 18, maxLines = Infinity } = {}) => {
  const content = String(text || '').trim()
  if (!content) return min
  for (let size = max; size >= min; size -= 0.5) {
    useFont(doc, 'tr')
    doc.fontSize(size)
    const measuredHeight = doc.heightOfString(content, { width, align: 'center' })
    const lineHeight = Math.max(1, doc.currentLineHeight(true))
    const lineCount = Math.max(1, Math.ceil(measuredHeight / lineHeight))
    if (measuredHeight <= height && lineCount <= maxLines) return size
  }
  return fitFontSize(doc, content, width, height, { min, max })
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
  const gapPt = mmToPt(2)
  const priceColWidth = mmToPt(34)
  const rightWidth = Math.max(40, Math.min(priceColWidth, w - 40 - gapPt))
  const leftWidth = Math.max(40, w - rightWidth - gapPt)
  const itemGap = 3
  const subLineGap = 1

  const hText = (text, { font, size, align } = {}) => {
    useFont(tmp, font || 'tr')
    tmp.fontSize(Number(size || 10))
    const s = String(text || '')
    if (!s) return 0
    return tmp.heightOfString(s, { width: w, align: align || 'left' })
  }

  const hMoney = (text, { size = 10 } = {}) => {
    useFont(tmp, 'tr')
    tmp.fontSize(Number(size || 10))
    const s = String(text || '')
    if (!s) return 0
    return tmp.heightOfString(s, { width: rightWidth, align: 'right', lineBreak: false })
  }

  const hLeftBlock = ({ name, note, qty }) => {
    let hh = 0

    useFont(tmp, 'tr')
    tmp.fontSize(10)
    hh += tmp.heightOfString(String(name || ''), { width: leftWidth, align: 'left' })

    const n = safeText(note)
    if (n) {
      hh += subLineGap
      useFont(tmp, 'tr')
      tmp.fontSize(9)
      hh += tmp.heightOfString(n, { width: leftWidth, align: 'left' })
    }

    hh += subLineGap
    useFont(tmp, 'tr')
    tmp.fontSize(9)
    hh += tmp.heightOfString(`x${Math.max(1, Number(qty || 1))}`, { width: leftWidth, align: 'left' })

    return hh
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
    const leftH = hLeftBlock({ name, note: it?.note, qty })
    const rightH = hMoney(`${subtotal.toFixed(2)}\u00A0TL`, { size: 10 })
    h += Math.max(leftH, rightH)
    h += itemGap
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
  const paperMm = Math.max(58, Math.min(80, requestedMm))
  const widthPt = mmToPt(paperMm)
  const pkg = isPackage === true || String(isPackage || '') === 'true'
  const pkgCustomer = safeText(customerName)
  const pkgPhone = safeText(customerPhone)
  const pkgAddress = safeText(customerAddress)

  const marginPt = mmToPt(2)
  const margins = { top: marginPt, left: marginPt, right: marginPt, bottom: marginPt }
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
    180,
    formulaHeightPt,
    measuredHeightPt + 20,
    widthPt + 60
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
    if (pkgCustomer) textMediumFlow(doc, `Müşteri: ${pkgCustomer}`)
    if (pkgPhone) textMediumFlow(doc, `Telefon: ${pkgPhone}`)
    if (pkgAddress) {
      textMediumFlow(doc, 'Adres:')
      doc.fontSize(10)
      textMediumFlow(doc, pkgAddress, { width: doc.page.width - doc.page.margins.left - doc.page.margins.right, align: 'left' })
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
    doc.fontSize(10)
    doc.fillColor('#111')
    textMediumFlow(doc, dateStr, { align: 'center' })
    doc.fillColor('#000')
    doc.y += 4
  }

  doc.fontSize(11)
  textMediumFlow(doc, `Sipariş: ${oNo || '-'}`)
  if (tNo) textMediumFlow(doc, `Masa: ${tNo}`)
  textMediumFlow(doc, `Durum: ${paidStatus === 'paid' ? 'ÖDENDİ' : 'ÖDENMEDİ'}`)
  doc.y += 3
  doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke()
  doc.y += 4

  doc.fontSize(10)
  const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right
  const gapPt = mmToPt(2)
  const priceColWidth = mmToPt(34)
  const rightWidth = Math.max(40, Math.min(priceColWidth, contentWidth - 40 - gapPt))
  const leftWidth = Math.max(40, contentWidth - rightWidth - gapPt)
  const leftX = doc.page.margins.left
  const rightX = doc.page.width - doc.page.margins.right - rightWidth
  const itemGap = 3
  const subLineGap = 1

  for (const it of its) {
    const name = safeText(it?.nameSnapshot) || '-'
    const qty = Math.max(1, Number(it?.qty || 1))
    const subtotal = safeMoney(it?.subtotal)
    const y0 = doc.y

    const rightText = `${subtotal.toFixed(2)}\u00A0TL`
    useFont(doc, 'tr')
    doc.fontSize(10)
    const priceH = doc.heightOfString(rightText, { width: rightWidth, align: 'right', lineBreak: false })
    textMediumAt(doc, rightText, rightX, y0, { width: rightWidth, align: 'right', lineBreak: false })

    useFont(doc, 'tr')
    doc.fontSize(10)
    const nameH = doc.heightOfString(name, { width: leftWidth, align: 'left' })
    textMediumAt(doc, name, leftX, y0, { width: leftWidth, align: 'left' })
    let leftEndY = y0 + nameH

    const note = safeText(it?.note)
    if (note) {
      leftEndY += subLineGap
      useFont(doc, 'tr')
      doc.fontSize(9)
      const noteH = doc.heightOfString(note, { width: leftWidth, align: 'left' })
      textMediumAt(doc, note, leftX, leftEndY, { width: leftWidth, align: 'left' })
      leftEndY += noteH
    }

    leftEndY += subLineGap
    useFont(doc, 'tr')
    doc.fontSize(9)
    const qtyText = `x${qty}`
    const qtyH = doc.heightOfString(qtyText, { width: leftWidth, align: 'left' })
    textMediumAt(doc, qtyText, leftX, leftEndY, { width: leftWidth, align: 'left' })
    leftEndY += qtyH

    const rowH = Math.max(leftEndY - y0, priceH)
    doc.y = y0 + rowH + itemGap
  }

  doc.y += 2
  doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke()
  doc.y += 6

  const net = safeMoney(totals?.grandTotal ?? totals?.netTotal ?? totals?.total)
  useFont(doc, 'trBold')
  doc.fontSize(12)
  const totalY = doc.y
  const totalLabel = 'TOPLAM:'
  const totalValue = `${net.toFixed(2)}\u00A0TL`
  const totalLabelH = doc.heightOfString(totalLabel, { width: leftWidth, align: 'right', lineBreak: false })
  const totalValueH = doc.heightOfString(totalValue, { width: rightWidth, align: 'right', lineBreak: false })
  doc.text(totalLabel, leftX, totalY, { width: leftWidth, align: 'right', lineBreak: false })
  doc.text(totalValue, rightX, totalY, { width: rightWidth, align: 'right', lineBreak: false })
  doc.y = totalY + Math.max(totalLabelH, totalValueH) + 2
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

export const renderLabelPdfBase64 = async ({ topText, productText, qty, amountText, noteText, widthMm, heightMm } = {}) => {
  const top = safeText(topText)
  const product = safeText(productText)
  const note = safeText(noteText)
  const q = Math.max(1, Number(qty || 1))
  const amount = safeText(amountText) || `${q} ADET`
  const rawW = Math.max(20, Number(widthMm || 50))
  const rawH = Math.max(20, Number(heightMm || 30))
  const w = Math.max(rawW, rawH)
  const h = Math.min(rawW, rawH)
  const marginMm = Math.max(1.5, Math.min(4, Math.min(w, h) * 0.06))

  const doc = new PDFDocument({
    size: [mmToPt(w), mmToPt(h)],
    layout: 'landscape',
    margins: { top: mmToPt(marginMm), left: mmToPt(marginMm), right: mmToPt(marginMm), bottom: mmToPt(marginMm) }
  })
  applyTrFont(doc)
  const chunks = []
  doc.on('data', (d) => chunks.push(d))
  const done = new Promise((resolve, reject) => {
    doc.on('end', resolve)
    doc.on('error', reject)
  })

  const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right
  const contentHeight = doc.page.height - doc.page.margins.top - doc.page.margins.bottom
  const qtyText = amount
  const blockGap = Math.max(mmToPt(1.5), contentHeight * 0.06)
  const topBlockHeight = top ? Math.max(mmToPt(6), contentHeight * 0.2) : 0
  const noteBlockHeight = note ? Math.max(mmToPt(5), contentHeight * 0.18) : 0
  const qtyBlockHeight = Math.max(mmToPt(6), contentHeight * 0.18)
  const totalGapCount = (top ? 1 : 0) + 1 + (note ? 1 : 0)
  const productBlockHeight = Math.max(mmToPt(12), contentHeight - topBlockHeight - noteBlockHeight - qtyBlockHeight - (blockGap * totalGapCount))
  const leftX = doc.page.margins.left

  const topFitSize = top
    ? fitFontSizeWithLineLimit(doc, top, contentWidth, topBlockHeight, { min: 8, max: Math.min(18, h * 0.34), maxLines: 2 })
    : Math.min(18, h * 0.34)
  const productFitSize = fitFontSizeWithLineLimit(doc, product || '-', contentWidth, productBlockHeight, { min: 9, max: Math.min(21, h * 0.4), maxLines: 2 })
  const noteFitSize = note
    ? fitFontSizeWithLineLimit(doc, note, contentWidth, noteBlockHeight, { min: 7, max: Math.min(14, h * 0.26), maxLines: 2 })
    : Math.min(14, h * 0.26)
  const qtyFitSize = fitFontSizeWithLineLimit(doc, qtyText, contentWidth, qtyBlockHeight, { min: 8, max: Math.min(17, h * 0.32), maxLines: 1 })
  const sharedSize = Math.max(8, Math.min(topFitSize, productFitSize, qtyFitSize))
  const noteSize = note ? Math.max(7, Math.min(noteFitSize, sharedSize - 1)) : 0

  const topHeight = top ? doc.font('Helvetica-Bold').fontSize(sharedSize).heightOfString(top, { width: contentWidth, align: 'center' }) : 0
  const productHeightUsed = doc.font('Helvetica-Bold').fontSize(sharedSize).heightOfString(product || '-', { width: contentWidth, align: 'center' })
  const noteHeight = note ? doc.font('Helvetica').fontSize(noteSize).heightOfString(note, { width: contentWidth, align: 'center' }) : 0
  const qtyHeight = doc.font('Helvetica-Bold').fontSize(sharedSize).heightOfString(qtyText, { width: contentWidth, align: 'center', lineBreak: false })
  const totalUsedHeight = topHeight + productHeightUsed + noteHeight + qtyHeight + (blockGap * totalGapCount)

  let y = doc.page.margins.top + Math.max(0, (contentHeight - totalUsedHeight) / 2)

  useFont(doc, 'trBold')
  if (top) {
    doc.fontSize(sharedSize)
    textMediumAt(doc, top, leftX, y, { width: contentWidth, align: 'center' })
    y += topHeight + blockGap
  }

  useFont(doc, 'trBold')
  doc.fontSize(sharedSize)
  textMediumAt(doc, product || '-', leftX, y, { width: contentWidth, align: 'center' })
  y += productHeightUsed + blockGap

  if (note) {
    useFont(doc, 'tr')
    doc.fontSize(noteSize)
    textMediumAt(doc, note, leftX, y, { width: contentWidth, align: 'center' })
    y += noteHeight + blockGap
  }

  useFont(doc, 'trBold')
  doc.fontSize(sharedSize)
  textMediumAt(doc, qtyText, leftX, y, { width: contentWidth, align: 'center', lineBreak: false })

  doc.end()
  await done
  return Buffer.concat(chunks).toString('base64')
}
