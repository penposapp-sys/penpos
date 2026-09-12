import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const text = value => String(value ?? '').trim()
const number = value => {
  const result = Number(value)
  return Number.isFinite(result) ? result : 0
}
const positiveOr = (value, fallback) => number(value) > 0 ? number(value) : number(fallback)
const money = value => `${number(value).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`
const fontPath = name => path.join(__dirname, '..', '..', 'assets', 'fonts', name)
const gibLogoPath = path.join(__dirname, '..', '..', 'assets', 'gib-earsiv-logo.jpg')

const registerFonts = doc => {
  try {
    doc.registerFont('tr', fontPath('DejaVuSans.ttf'))
    doc.registerFont('trBold', fontPath('DejaVuSans-Bold.ttf'))
    doc.font('tr')
  } catch {
    doc.font('Helvetica')
  }
}

const line = (doc, x1, y, x2, width = 1, color = '#111827') => {
  doc.save().strokeColor(color).lineWidth(width).moveTo(x1, y).lineTo(x2, y).stroke().restore()
}

const drawArchiveEmblem = (doc, centerX, centerY) => {
  doc.save()
  doc.lineWidth(1.2).strokeColor('#64748b').fillColor('#fff').circle(centerX, centerY, 29).fillAndStroke()
  doc.lineWidth(0.8).strokeColor('#94a3b8').circle(centerX, centerY, 24).stroke()
  doc.lineWidth(0.55).strokeColor('#cbd5e1').circle(centerX, centerY, 20).stroke()
  doc.fillColor('#c8102e').circle(centerX, centerY + 2, 10).fill()
  doc.fillColor('#fff').roundedRect(centerX - 2.5, centerY - 9, 5, 20, 2.5).fill()
  doc.fillColor('#fff').circle(centerX, centerY - 13, 2.8).fill()
  doc.font('trBold').fontSize(3.1).fillColor('#64748b').text('T.C. HAZİNE VE MALİYE', centerX - 20, centerY - 25, { width: 40, align: 'center', lineBreak: false })
  doc.font('tr').fontSize(2.8).fillColor('#64748b').text('GELİR İDARESİ BAŞKANLIĞI', centerX - 21, centerY + 21, { width: 42, align: 'center', lineBreak: false })
  doc.restore()
}

const cellText = (doc, value, x, y, width, height, options = {}) => {
  doc.font(options.bold ? 'trBold' : 'tr').fontSize(options.size || 7.1).fillColor(options.color || '#1f2937')
  doc.text(text(value), x + 3, y + (options.offsetY || 4), {
    width: Math.max(1, width - 6),
    height: Math.max(1, height - 5),
    align: options.align || 'left',
    lineBreak: options.lineBreak !== false,
    ellipsis: true
  })
}

const drawTable = (doc, columns, rows, x, y, width) => {
  const headerHeight = 28
  const rowHeight = 31
  const height = headerHeight + Math.max(1, rows.length) * rowHeight
  let cursor = x
  doc.save().lineWidth(1.1).strokeColor('#111827').rect(x, y, width, height).stroke().restore()
  doc.save().fillColor('#f3f4f6').rect(x, y, width, headerHeight).fill().restore()
  columns.forEach(column => {
    cellText(doc, column.label, cursor, y, column.width, headerHeight, { bold: true, align: 'center', size: 6.5, offsetY: 6 })
    cursor += column.width
    if (cursor < x + width - 0.1) doc.moveTo(cursor, y).lineTo(cursor, y + height).strokeColor('#111827').lineWidth(0.7).stroke()
  })
  doc.moveTo(x, y + headerHeight).lineTo(x + width, y + headerHeight).strokeColor('#111827').lineWidth(0.7).stroke()
  const safeRows = rows.length ? rows : [['', '', '', '', '', '', '', '', '', '', '']]
  safeRows.forEach((row, rowIndex) => {
    const rowY = y + headerHeight + rowIndex * rowHeight
    if (rowIndex > 0) doc.moveTo(x, rowY).lineTo(x + width, rowY).strokeColor('#9ca3af').lineWidth(0.5).stroke()
    let rowX = x
    columns.forEach((column, columnIndex) => {
      cellText(doc, row[columnIndex], rowX, rowY, column.width, rowHeight, { align: column.align || 'left', size: column.size || 6.8 })
      rowX += column.width
    })
  })
  return y + height
}

export const renderAnaokuluInvoicePdf = async ({ invoice = {}, issuer = {}, tenant = {} } = {}) => {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 34, right: 34, bottom: 34, left: 34 } })
  registerFonts(doc)
  const chunks = []
  doc.on('data', chunk => chunks.push(chunk))
  const done = new Promise((resolve, reject) => {
    doc.on('end', resolve)
    doc.on('error', reject)
  })

  const x = doc.page.margins.left
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right
  const half = pageWidth * 0.46
  const gap = pageWidth * 0.08
  const rightX = x + half + gap
  const issuerName = text(issuer.companyName || tenant.name || 'Anaokulu')
  const buyer = invoice.buyerDetails || {}
  const buyerName = text(buyer.name || invoice.buyer)
  const buyerAddress = text(buyer.address || invoice.address)
  const buyerTax = text(buyer.taxNumber || buyer.identityNumber || invoice.taxId)
  const invoiceType = text(invoice.invoiceType || 'SATIS')
  const lineItems = Array.isArray(invoice.lineItems) && invoice.lineItems.length
    ? invoice.lineItems
    : [{ description: invoice.planName || 'EĞİTİM', quantity: 1, unit: '', unitPrice: number(invoice.base || invoice.total), discountRate: 0, discountAmount: 0, vatRate: number(invoice.vatRate || 0), vatAmount: number(invoice.vat), otherTaxes: '', lineTotal: number(invoice.base || invoice.total) }]

  // Luca e-Arşiv yerleşimi: satıcı bloğu, başlık ve QR için boş alan.
  line(doc, x, 43, x + half, 2.2)
  let issuerY = 56
  const issuerLines = [
    issuerName,
    text(issuer.address),
    [issuer.district, issuer.city, issuer.postalCode].filter(Boolean).join(' '),
    issuer.phone ? `Telefon: ${issuer.phone}` : '',
    issuer.email ? `E-Posta: ${issuer.email}` : '',
    issuer.taxOffice ? `Vergi Dairesi: ${issuer.taxOffice}` : '',
    issuer.taxNumber ? `VKN: ${issuer.taxNumber}` : '',
    issuer.identityNumber ? `TCKN: ${issuer.identityNumber}` : ''
  ].filter(Boolean)
  issuerLines.forEach((value, index) => {
    doc.font(index === 0 ? 'trBold' : 'tr').fontSize(index === 0 ? 9.2 : 8.2).fillColor('#374151').text(value, x, issuerY, { width: half, lineBreak: false })
    issuerY += index === 0 ? 15 : 12
  })
  line(doc, x, Math.max(issuerY + 3, 145), x + half, 2.2)

  const emblemCenterX = x + half + gap + (pageWidth - half - gap) / 2
  let gibLogo = null
  try { gibLogo = fs.readFileSync(gibLogoPath) } catch { }
  if (gibLogo) {
    try { doc.image(gibLogo, emblemCenterX - 31, 51, { fit: [62, 62] }) } catch { drawArchiveEmblem(doc, emblemCenterX, 82) }
  } else {
    drawArchiveEmblem(doc, emblemCenterX, 82)
  }
  doc.font('trBold').fontSize(16).fillColor('#4b5563').text('e-Arşiv Fatura', emblemCenterX - 82, 124, { width: 164, align: 'center' })

  const metaX = rightX + 4
  const metaY = 164
  const metaW = pageWidth - (metaX - x)
  const metaRows = [
    ['Özelleştirme No:', invoice.customizationNo || 'TR1.2'],
    ['Fatura No:', invoice.no],
    ['Fatura Tipi:', invoiceType],
    ['Gönderim Şekli:', invoice.sendingMethod || ''],
    ['Düzenleme Tarihi:', invoice.date],
    ['Düzenleme Zamanı:', invoice.invoiceTime || '']
  ]
  const metaRowHeight = 17
  doc.save().lineWidth(0.9).strokeColor('#374151').rect(metaX, metaY, metaW, metaRows.length * metaRowHeight).stroke().restore()
  metaRows.forEach((row, index) => {
    const rowY = metaY + index * metaRowHeight
    if (index > 0) line(doc, metaX, rowY, metaX + metaW, 0.6, '#6b7280')
    const split = metaX + metaW * 0.52
    doc.moveTo(split, rowY).lineTo(split, rowY + metaRowHeight).strokeColor('#6b7280').lineWidth(0.6).stroke()
    cellText(doc, row[0], metaX, rowY, split - metaX, metaRowHeight, { bold: true, size: 7.4 })
    cellText(doc, row[1], split, rowY, metaX + metaW - split, metaRowHeight, { size: 7.4 })
  })

  const buyerY = 181
  line(doc, x, buyerY, x + half, 2.2)
  doc.font('trBold').fontSize(8.5).fillColor('#4b5563').text('SAYIN', x, buyerY + 12, { width: half })
  let currentBuyerY = buyerY + 29
  ;[buyerName, [buyer.district, buyer.city].filter(Boolean).join(' / '), buyerAddress, buyer.taxOffice ? `Vergi Dairesi: ${buyer.taxOffice}` : '', buyerTax ? `TCKN: ${buyerTax}` : ''].filter(Boolean).forEach(value => {
    doc.font('tr').fontSize(8.4).fillColor('#374151').text(value, x, currentBuyerY, { width: half, lineBreak: false })
    currentBuyerY += 13
  })
  line(doc, x, Math.max(currentBuyerY + 4, buyerY + 105), x + half, 2.2)

  const ettnY = 302
  doc.font('trBold').fontSize(8.2).fillColor('#374151').text(`ETTN: ${text(invoice.ettn)}`, x, ettnY, { width: pageWidth })
  const tableY = ettnY + 25
  const columns = [
    { label: 'Sıra No', width: pageWidth * 0.055, align: 'center' },
    { label: 'Mal Hizmet', width: pageWidth * 0.125 },
    { label: 'Açıklama', width: pageWidth * 0.125 },
    { label: 'Miktar', width: pageWidth * 0.09, align: 'right' },
    { label: 'Birim Fiyat', width: pageWidth * 0.10, align: 'right' },
    { label: 'İskonto Oranı', width: pageWidth * 0.085, align: 'right' },
    { label: 'İskonto Tutarı', width: pageWidth * 0.085, align: 'right' },
    { label: 'KDV Oranı', width: pageWidth * 0.075, align: 'right' },
    { label: 'KDV Tutarı', width: pageWidth * 0.09, align: 'right' },
    { label: 'Diğer Vergiler', width: pageWidth * 0.10, align: 'right' },
    { label: 'Mal Hizmet Tutarı', width: pageWidth * 0.075, align: 'right' }
  ]
  const rows = lineItems.map((item, index) => [
    index + 1, item.description, item.note || '', `${item.quantity || 0} ${item.unit || ''}`,
    money(item.unitPrice), item.discountRate ? `%${item.discountRate}` : '%0', money(item.discountAmount),
    item.vatRate ? `%${item.vatRate}` : '%0', money(item.vatAmount), item.otherTaxes || '', money(item.lineTotal)
  ])
  const tableBottom = drawTable(doc, columns, rows, x, tableY, pageWidth)

  const totalsX = x + pageWidth * 0.60
  const totalsW = pageWidth * 0.40
  const totals = [
    ['Mal Hizmet Toplam Tutarı', positiveOr(invoice.goodsServicesTotal, invoice.subtotal || invoice.base)],
    ['Toplam İskonto', invoice.discountTotal],
    ['KDV Matrahı', positiveOr(invoice.vatBase, invoice.base)],
    [`Hesaplanan KDV(%${number(invoice.vatRate || 0).toFixed(2)})`, positiveOr(invoice.vatTotal, invoice.vat)],
    ['Vergiler Dahil Toplam Tutar', positiveOr(invoice.grandTotal, invoice.total)],
    ['Ödenecek Tutar', positiveOr(invoice.payableTotal, invoice.total)]
  ]
  const totalsY = tableBottom + 1
  totals.forEach((entry, index) => {
    const rowY = totalsY + index * 17
    doc.save().lineWidth(0.9).strokeColor('#374151').rect(totalsX, rowY, totalsW, 17).stroke().restore()
    const valueX = totalsX + totalsW * 0.72
    doc.moveTo(valueX, rowY).lineTo(valueX, rowY + 17).strokeColor('#6b7280').lineWidth(0.6).stroke()
    cellText(doc, entry[0], totalsX, rowY, valueX - totalsX, 17, { bold: true, align: 'right', size: 7.6 })
    cellText(doc, money(entry[1]), valueX, rowY, totalsX + totalsW - valueX, 17, { align: 'right', size: 7.6 })
  })

  const noteY = totalsY + totals.length * 17 + 18
  doc.save().lineWidth(1).strokeColor('#111827').rect(x, noteY, pageWidth, 24).stroke().restore()
  doc.font('trBold').fontSize(8).fillColor('#374151').text('Not:', x + 7, noteY + 7, { width: 28, lineBreak: false })
  doc.font('tr').fontSize(8).text(text(invoice.note), x + 38, noteY + 7, { width: pageWidth - 45, lineBreak: false })

  doc.end()
  await done
  return Buffer.concat(chunks)
}

export const formatInvoiceMoney = money
