import PDFDocument from 'pdfkit'
import path from 'path'
import sharp from 'sharp'
import { fileURLToPath } from 'url'
import * as logger from '../utils/logger.js'

const mmToPt = (mm) => Number(mm) * 2.8346456692913384

const safeMoney = (n) => {
  const v = Number(n || 0)
  return Number.isFinite(v) ? v : 0
}

const safeText = (v) => String(v || '').trim()
const formatReceiptMoney = (value) => `${safeMoney(value).toFixed(2)} TL`

const renderDesignedReceiptPdfBase64 = async ({
  tenantName,
  logoBuffer,
  layout,
  createdAt,
  receiptNo,
  orderNo,
  tableName,
  cashierName,
  items,
  totals,
  paidTotal,
  balanceDue,
  displayBalance,
  paidStatus,
  payments,
  paymentMethod,
  note,
  discountTotal,
  discountPercent,
  widthMm
} = {}) => {
  const widthPt = mmToPt(Math.max(58, Math.min(80, Number(widthMm || 80))))
  const margin = mmToPt(2.5)
  const margins = { top: margin, left: margin, right: margin, bottom: margin }
  let processedLogo = Buffer.isBuffer(logoBuffer) ? logoBuffer : null
  if (processedLogo) {
    try {
      processedLogo = await sharp(processedLogo, { failOn: 'error' })
        .resize({ width: 480, height: 190, fit: 'inside', withoutEnlargement: true })
        .grayscale()
        .normalize()
        .threshold(175)
        .png()
        .toBuffer()
    } catch (err) {
      logger.warn('[RECEIPT_LOGO_RENDER_FAILED]', { message: err?.message || 'Logo image could not be processed' })
      processedLogo = null
    }
  }
  const options = {
    tenantName: safeText(tenantName) || 'PENPOS',
    logoBuffer: processedLogo,
    layout,
    createdAt,
    receiptNo: safeText(receiptNo) || '-',
    orderNo: safeText(orderNo) || '-',
    tableName: safeText(tableName),
    cashierName: safeText(cashierName),
    items: Array.isArray(items) ? items : [],
    totals: totals || {},
    paidTotal: safeMoney(paidTotal),
    balanceDue: safeMoney(balanceDue),
    displayBalance: safeMoney(displayBalance),
    paidStatus: String(paidStatus || ''),
    payments: Array.isArray(payments) ? payments : [],
    paymentMethod: safeText(paymentMethod),
    note: safeText(note),
    discountTotal: safeMoney(discountTotal),
    discountPercent: safeMoney(discountPercent)
  }

  const draw = (doc) => {
    const left = doc.page.margins.left
    const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right
    const right = left + contentWidth
    let y = doc.page.margins.top
    const textHeight = (text, size, bold, width, align = 'left') => {
      useFont(doc, bold ? 'trBold' : 'tr')
      doc.fontSize(size)
      return doc.heightOfString(String(text || ''), { width, align, lineGap: 0 })
    }
    const addText = (text, size = 9, bold = false, align = 'left', gap = 1) => {
      const value = String(text || '')
      const height = textHeight(value, size, bold, contentWidth, align)
      useFont(doc, bold ? 'trBold' : 'tr')
      doc.fontSize(size)
      doc.fillColor('#000')
      doc.text(value, left, y, { width: contentWidth, align, lineGap: 0 })
      y += height + gap
      return height
    }
    const addRule = (gap = 4, dashed = false) => {
      doc.moveTo(left, y)
        .lineTo(right, y)
        .lineWidth(0.7)
      if (dashed) doc.dash(2, { space: 2 })
      doc.stroke()
      if (dashed) doc.undash()
      y += gap
    }
    const addPair = (label, value, { size = 9, bold = false } = {}) => {
      const leftWidth = contentWidth * 0.48
      const rightWidth = contentWidth - leftWidth
      const valueText = String(value ?? '')
      const height = Math.max(
        textHeight(label, size, bold, leftWidth),
        textHeight(valueText, size, false, rightWidth, 'right')
      )
      useFont(doc, bold ? 'trBold' : 'tr')
      doc.fontSize(size)
      doc.text(label, left, y, { width: leftWidth, lineGap: 0 })
      useFont(doc, 'tr')
      doc.fontSize(size)
      doc.text(valueText, left + leftWidth, y, { width: rightWidth, align: 'right', lineGap: 0 })
      y += height + 1
    }
    const addItems = () => {
      const qtyWidth = mmToPt(10)
      const priceWidth = Math.min(mmToPt(25), contentWidth * 0.4)
      const nameWidth = Math.max(mmToPt(18), contentWidth - qtyWidth - priceWidth)
      const qtyX = left + nameWidth
      const priceX = qtyX + qtyWidth
      for (const item of options.items) {
        const name = safeText(item?.nameSnapshot) || '-'
        const qty = `x${Math.max(1, Number(item?.qty || 1))}`
        const price = formatReceiptMoney(item?.subtotal)
        const nameHeight = textHeight(name, 9, false, nameWidth)
        const qtyHeight = textHeight(qty, 8, false, qtyWidth, 'center')
        const priceHeight = textHeight(price, 8, false, priceWidth, 'right')
        const rowHeight = Math.max(nameHeight, qtyHeight, priceHeight)
        useFont(doc, 'tr')
        doc.fontSize(9)
        doc.text(name, left, y, { width: nameWidth, lineGap: 0 })
        doc.fontSize(8)
        doc.text(qty, qtyX, y, { width: qtyWidth, align: 'center', lineGap: 0 })
        doc.text(price, priceX, y, { width: priceWidth, align: 'right', lineGap: 0 })
        y += rowHeight + 4
      }
    }

    if (options.logoBuffer) {
      const logoWidth = Math.min(mmToPt(38), contentWidth)
      const logoHeight = mmToPt(15)
      doc.image(options.logoBuffer, left + ((contentWidth - logoWidth) / 2), y, {
        fit: [logoWidth, logoHeight],
        align: 'center',
        valign: 'center'
      })
      y += logoHeight
    }
    addText(options.tenantName, 13, true, 'center', 5)

    const title = layout === 'quick-sale' ? 'HIZLI SATIŞ' : 'MASA SİPARİŞİ'
    const titleHeight = mmToPt(8)
    doc.roundedRect(left, y, contentWidth, titleHeight, 4).fill('#000')
    useFont(doc, 'trBold')
    doc.fontSize(12)
    doc.fillColor('#fff')
    doc.text(title, left, y + mmToPt(1.2), { width: contentWidth, align: 'center', lineBreak: false })
    doc.fillColor('#000')
    y += titleHeight + 5

    if (layout === 'quick-sale' && options.note) {
      addText(`MASA: ${options.note}`, 10, true, 'center', 2)
    }

    const dt = options.createdAt ? new Date(options.createdAt) : new Date()
    const validDate = Number.isFinite(dt.getTime())
    const datePart = validDate ? dt.toLocaleDateString('tr-TR') : '-'
    const timePart = validDate ? dt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '-'
    if (layout === 'quick-sale') {
      addPair('Fiş No:', options.receiptNo, { size: 9, bold: true })
      addPair('Tarih / Saat:', `${datePart} ${timePart}`)
    } else {
      addText(`Masa: ${options.tableName || '-'}`, 11, true, 'left', 2)
      addRule(4)
      addPair('Fiş No:', options.receiptNo, { bold: true })
      addPair('Sipariş No:', options.orderNo)
      addPair('Tarih:', datePart)
      addPair('Saat:', timePart)
      addPair('Kasiyer:', options.cashierName || '-')
      const status = options.paidStatus === 'paid' ? 'ÖDENDİ' : (options.paidTotal > 0 ? 'KISMİ ÖDENDİ' : 'BEKLİYOR')
      addPair('Durum:', status, { bold: true })
    }
    addRule(5)
    addItems()
    addRule(5, true)

    const subtotal = safeMoney(options.totals?.subtotal ?? options.totals?.total)
    const grandTotal = safeMoney(options.totals?.grandTotal ?? options.totals?.netTotal ?? options.totals?.total)
    if (layout === 'quick-sale') {
      if (options.discountTotal > 0 || options.discountPercent > 0) {
        addPair(`Ara Toplam:`, formatReceiptMoney(subtotal))
        addPair(`İndirim${options.discountPercent > 0 ? ` (%${options.discountPercent})` : ''}:`, formatReceiptMoney(options.discountTotal))
      }
      addPair('TOPLAM', formatReceiptMoney(grandTotal), { size: 12, bold: true })
      const payment = options.payments
        .map((payment) => safeText(payment?.methodLabel || payment?.methodName || payment?.method))
        .filter(Boolean)
        .join(', ') || options.paymentMethod || (options.paidStatus === 'paid' ? 'Ödendi' : 'Bekliyor')
      addText(`Ödeme: ${payment}`, 10, true, 'left', 4)
      if (options.note) {
        addRule(5)
        addText(`Not: ${options.note}`, 9, false, 'left', 3)
      }
      addRule(5)
      addText('TEŞEKKÜR EDERİZ', 10, true, 'center', 1)
    } else {
      addPair('Ara Toplam:', formatReceiptMoney(subtotal))
      if (options.discountTotal > 0 || options.discountPercent > 0) {
        addPair(`İndirim${options.discountPercent > 0 ? ` (%${options.discountPercent})` : ''}:`, formatReceiptMoney(options.discountTotal))
      }
      addPair('Ödenen:', formatReceiptMoney(options.paidTotal))
      addPair('Kalan:', formatReceiptMoney(options.balanceDue))
      addPair('Bakiye:', formatReceiptMoney(options.displayBalance))
      addRule(4)
      addPair('TOPLAM:', formatReceiptMoney(grandTotal), { size: 14, bold: true })
      addRule(4)
      const payment = options.payments
        .map((entry) => {
          const method = safeText(entry?.methodLabel || entry?.methodName || entry?.method)
          return method ? `${method}: ${formatReceiptMoney(entry?.amount)}` : ''
        })
        .filter(Boolean)
      addText(`Ödeme: ${payment.join(', ') || options.paymentMethod || (options.paidStatus === 'paid' ? 'Ödendi' : 'Bekliyor')}`, 9, false, 'left', 6)
      addText('AFİYET OLSUN', 10, true, 'center', 1)
    }
    return y
  }

  const measureDoc = new PDFDocument({ size: [widthPt, mmToPt(1000)], margins })
  applyTrFont(measureDoc)
  measureDoc.lineGap(0)
  measureDoc.on('data', () => {})
  const contentEnd = draw(measureDoc)
  measureDoc.end()

  const heightPt = Math.max(mmToPt(45), contentEnd + margins.bottom + mmToPt(2))
  const doc = new PDFDocument({ autoFirstPage: false, margins })
  doc.addPage({ size: [widthPt, heightPt], margins })
  applyTrFont(doc)
  doc.lineGap(0)
  draw(doc)
  const chunks = []
  doc.on('data', (chunk) => chunks.push(chunk))
  const done = new Promise((resolve, reject) => {
    doc.on('end', resolve)
    doc.on('error', reject)
  })
  doc.end()
  await done
  return Buffer.concat(chunks).toString('base64')
}

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
  customerAddress,
  deliveryNote,
  deliveryPaymentLine
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
    h += hText('*** PAKET SERVIS ***', { font: 'trBold', size: 13, align: 'center' })
    h += 2
    if (customerName) h += hText(`Müşteri: ${customerName}`, { font: 'tr', size: 11 }) + 1
    if (customerPhone) h += hText(`Telefon: ${customerPhone}`, { font: 'tr', size: 11 }) + 1
    if (customerAddress) {
      h += hText('Adres:', { font: 'tr', size: 11 }) + 1
      h += hText(customerAddress, { font: 'tr', size: 10 }) + 2
    }
    if (deliveryNote) h += hText(`Not: ${deliveryNote}`, { font: 'tr', size: 10 }) + 2
    if (deliveryPaymentLine) h += hText(`Ödeme: ${deliveryPaymentLine}`, { font: 'tr', size: 10 }) + 2
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
  logoBuffer,
  saleSource,
  createdAt,
  receiptNo,
  orderNo,
  tableName,
  cashierName,
  items,
  totals,
  paidTotal,
  balanceDue,
  displayBalance,
  paidStatus,
  payments,
  paymentMethod,
  note,
  discountTotal,
  discountPercent,
  widthMm,
  isTableOrder,
  isPackage,
  customerName,
  customerPhone,
  customerAddress,
  deliveryNote,
  deliveryPaymentLine
} = {}) => {
  const tName = safeText(tenantName) || 'PENPOS'
  const quickSale = String(saleSource || '') === 'quick-sale'
  const requestedMm = Math.max(58, Number(widthMm || 80))
  const paperMm = Math.max(58, Math.min(80, requestedMm))
  if (quickSale || isTableOrder === true || (!isPackage && safeText(tableName))) {
    return renderDesignedReceiptPdfBase64({
      tenantName: tName,
      logoBuffer,
      layout: quickSale ? 'quick-sale' : 'table',
      createdAt,
      receiptNo,
      orderNo,
      tableName,
      cashierName,
      items,
      totals,
      paidTotal,
      balanceDue,
      displayBalance,
      paidStatus,
      payments,
      paymentMethod,
      note,
      discountTotal,
      discountPercent,
      widthMm: paperMm
    })
  }
  const dt = createdAt ? new Date(createdAt) : new Date()
  const dateStr = Number.isFinite(dt.getTime()) ? dt.toLocaleString('tr-TR') : ''
  const oNo = orderNo !== undefined && orderNo !== null ? String(orderNo) : ''
  const tNo = safeText(tableName)
  const its = Array.isArray(items) ? items : []
  const widthPt = mmToPt(paperMm)
  const pkg = isPackage === true || String(isPackage || '') === 'true'
  const pkgCustomer = safeText(customerName)
  const pkgPhone = safeText(customerPhone)
  const pkgAddress = safeText(customerAddress)
  const pkgNote = safeText(deliveryNote)
  const pkgPaymentLine = safeText(deliveryPaymentLine)

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
    customerAddress: pkgAddress,
    deliveryNote: pkgNote,
    deliveryPaymentLine: pkgPaymentLine
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
    doc.fontSize(13).text('*** PAKET SERVIS ***', { align: 'center' })
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
    if (pkgNote) textMediumFlow(doc, `Not: ${pkgNote}`)
    if (pkgPaymentLine) textMediumFlow(doc, `Ödeme: ${pkgPaymentLine}`)

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

export const renderLabelPdfBase64 = async ({ topText, subtitleText, productText, qty, amountText, noteText, widthMm, heightMm } = {}) => {
  const top = safeText(topText)
  const subtitle = safeText(subtitleText)
  const product = safeText(productText)
  const note = safeText(noteText)
  const q = Math.max(1, Number(qty || 1))
  const amount = safeText(amountText) || `${q} ADET`
  const w = Math.max(20, Number(widthMm || 60))
  const h = Math.max(20, Number(heightMm || 40))
  const marginMm = Math.max(0, Math.min(0.8, Math.min(w, h) * 0.015))

  const doc = new PDFDocument({
    size: [mmToPt(w), mmToPt(h)],
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
  const blockGap = Math.max(mmToPt(0.8), contentHeight * 0.03)
  const topBlockHeight = top ? Math.max(mmToPt(6), contentHeight * 0.2) : 0
  const subtitleBlockHeight = subtitle ? Math.max(mmToPt(5), contentHeight * 0.18) : 0
  const noteBlockHeight = note ? Math.max(mmToPt(5), contentHeight * 0.18) : 0
  const qtyBlockHeight = Math.max(mmToPt(6), contentHeight * 0.18)
  const totalGapCount = (top ? 1 : 0) + (subtitle ? 1 : 0) + 1 + (note ? 1 : 0)
  const productBlockHeight = Math.max(mmToPt(12), contentHeight - topBlockHeight - subtitleBlockHeight - noteBlockHeight - qtyBlockHeight - (blockGap * totalGapCount))
  const leftX = doc.page.margins.left

  const topFitSize = top
    ? fitFontSizeWithLineLimit(doc, top, contentWidth, topBlockHeight, { min: 8, max: Math.min(18, h * 0.34), maxLines: 2 })
    : Math.min(18, h * 0.34)
  const subtitleFitSize = subtitle
    ? fitFontSizeWithLineLimit(doc, subtitle, contentWidth, subtitleBlockHeight, { min: 7, max: Math.min(14, h * 0.26), maxLines: 2 })
    : Math.min(14, h * 0.26)
  const productFitSize = fitFontSizeWithLineLimit(doc, product || '-', contentWidth, productBlockHeight, { min: 9, max: Math.min(21, h * 0.4), maxLines: 2 })
  const noteFitSize = note
    ? fitFontSizeWithLineLimit(doc, note, contentWidth, noteBlockHeight, { min: 7, max: Math.min(14, h * 0.26), maxLines: 2 })
    : Math.min(14, h * 0.26)
  const qtyFitSize = fitFontSizeWithLineLimit(doc, qtyText, contentWidth, qtyBlockHeight, { min: 8, max: Math.min(17, h * 0.32), maxLines: 1 })
  const sharedSize = Math.max(8, Math.min(topFitSize, productFitSize, qtyFitSize))
  const subtitleSize = subtitle ? Math.max(7, Math.min(subtitleFitSize, sharedSize - 1)) : 0
  const noteSize = note ? Math.max(7, Math.min(noteFitSize, sharedSize - 1)) : 0

  const topHeight = top ? doc.font('Helvetica-Bold').fontSize(sharedSize).heightOfString(top, { width: contentWidth, align: 'center' }) : 0
  const subtitleHeight = subtitle ? doc.font('Helvetica').fontSize(subtitleSize).heightOfString(subtitle, { width: contentWidth, align: 'center' }) : 0
  const productHeightUsed = doc.font('Helvetica-Bold').fontSize(sharedSize).heightOfString(product || '-', { width: contentWidth, align: 'center' })
  const noteHeight = note ? doc.font('Helvetica').fontSize(noteSize).heightOfString(note, { width: contentWidth, align: 'center' }) : 0
  const qtyHeight = doc.font('Helvetica-Bold').fontSize(sharedSize).heightOfString(qtyText, { width: contentWidth, align: 'center', lineBreak: false })
  const totalUsedHeight = topHeight + subtitleHeight + productHeightUsed + noteHeight + qtyHeight + (blockGap * totalGapCount)
  let y = doc.page.margins.top + Math.max(0, (contentHeight - totalUsedHeight) / 2)

  useFont(doc, 'trBold')
  if (top) {
    doc.fontSize(sharedSize)
    textMediumAt(doc, top, leftX, y, { width: contentWidth, align: 'center' })
    y += topHeight + blockGap
  }

  if (subtitle) {
    useFont(doc, 'tr')
    doc.fontSize(subtitleSize)
    textMediumAt(doc, subtitle, leftX, y, { width: contentWidth, align: 'center' })
    y += subtitleHeight + blockGap
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
