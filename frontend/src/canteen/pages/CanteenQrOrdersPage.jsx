import React, { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import Modal from '../../components/Modal.jsx'
import ProductImage from '../../components/ProductImage.jsx'
import { api } from '../../lib/apiClient.js'
import { deleteCustomerPayment } from '../lib/api.js'
import { buildCanteenPaymentMethods } from '../lib/paymentMethods.js'
import useCanteenAutoRefresh from '../hooks/useCanteenAutoRefresh.js'

const orderStatusOptions = [
  ['new', 'Yeni'],
  ['preparing', 'Hazirlaniyor'],
  ['ready', 'Hazir'],
  ['delivered', 'Teslim edildi'],
  ['cancelled', 'Iptal edildi']
]

const paymentStatusOptions = [
  ['pending', 'Odeme bekliyor'],
  ['paid', 'Odendi'],
  ['unpaid', 'Odenmedi'],
  ['cari', 'Cariye islendi']
]

const statusMeta = {
  new: { label: 'Yeni Siparis', bg: 'linear-gradient(135deg, #dbeafe, #bfdbfe)', color: '#1d4ed8' },
  preparing: { label: 'Hazirlaniyor', bg: 'linear-gradient(135deg, #ffedd5, #fed7aa)', color: '#c2410c' },
  ready: { label: 'Hazir', bg: 'linear-gradient(135deg, #ccfbf1, #99f6e4)', color: '#0f766e' },
  delivered: { label: 'Teslim Edildi', bg: 'linear-gradient(135deg, #dcfce7, #bbf7d0)', color: '#15803d' },
  cancelled: { label: 'Iptal', bg: 'linear-gradient(135deg, #fee2e2, #fecaca)', color: '#b91c1c' }
}

const paymentMeta = {
  unpaid: { label: 'Odenmedi', bg: 'linear-gradient(135deg, #fee2e2, #fecaca)', color: '#b91c1c' },
  pending: { label: 'Odeme Bekliyor', bg: 'linear-gradient(135deg, #fef3c7, #fde68a)', color: '#b45309' },
  paid: { label: 'Odendi', bg: 'linear-gradient(135deg, #dcfce7, #bbf7d0)', color: '#15803d' },
  cari: { label: 'Caride Kaydi Var', bg: 'linear-gradient(135deg, #dbeafe, #bfdbfe)', color: '#1d4ed8' }
}

function formatMoney(value) {
  const amount = Number(value || 0)
  return `TL ${amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function roundMoney(value) {
  return Number(Number(value || 0).toFixed(2))
}

function formatDate(value) {
  if (!value) return '-'
  try {
    return new Date(value).toLocaleString('tr-TR')
  } catch {
    return '-'
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatPrintMoney(value) {
  return `${Number(value || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`
}

function toPdfSafeText(value) {
  return String(value ?? '')
    .replaceAll('İ', 'I')
    .replaceAll('İ', 'I')
    .replaceAll('ı', 'i')
    .replaceAll('Ş', 'S')
    .replaceAll('ş', 's')
    .replaceAll('Ğ', 'G')
    .replaceAll('ğ', 'g')
    .replaceAll('Ü', 'U')
    .replaceAll('ü', 'u')
    .replaceAll('Ö', 'O')
    .replaceAll('ö', 'o')
    .replaceAll('Ç', 'C')
    .replaceAll('ç', 'c')
}

function paymentMethodLabel(value, order = null) {
  const customLabel = String(order?.paymentMethodLabel || order?.paymentMethodName || '').trim()
  if (customLabel) return customLabel
  const method = String(value || '').trim().toLowerCase()
  if (method === 'cash' || method === 'cash_at_counter') return 'Nakit'
  if (method === 'pos' || method === 'card') return 'POS'
  if (method === 'bank') return 'Banka'
  if (method === 'cari') return 'Cari'
  if (method === 'already_paid') return 'Belirtilmedi'
  if (method === 'pay_on_delivery') return 'Kapida odeme'
  if (method === 'none' || !method) return 'Belirtilmedi'
  return value
}

function buildQrOrderReceiptHtml(order) {
  const items = Array.isArray(order?.items) ? order.items : []
  const itemRows = items.map((item) => `
    <div class="item">
      <div class="item-head">
        <div class="item-name">${escapeHtml(item?.productName || '-')}</div>
        <div class="item-total">${escapeHtml(formatPrintMoney(item?.totalPrice || 0))}</div>
      </div>
      <div class="item-meta">${escapeHtml(`${Number(item?.quantity || 0)} adet x ${formatPrintMoney(item?.unitPrice || 0)}`)}</div>
      ${item?.note ? `<div class="item-note">Not: ${escapeHtml(item.note)}</div>` : ''}
    </div>
  `).join('')

  const customerInfo = [
    order?.customerName ? `<div><strong>Musteri:</strong> ${escapeHtml(order.customerName)}</div>` : '',
    order?.customerPhone ? `<div><strong>Telefon:</strong> ${escapeHtml(order.customerPhone)}</div>` : '',
    order?.customerLocation ? `<div><strong>Lokasyon:</strong> ${escapeHtml(order.customerLocation)}</div>` : '',
    order?.customerAddress ? `<div><strong>Adres:</strong> ${escapeHtml(order.customerAddress)}</div>` : '',
    order?.branchName ? `<div><strong>Sube:</strong> ${escapeHtml(order.branchName)}</div>` : ''
  ].filter(Boolean).join('')

  const summaryRows = [
    ['Siparis No', order?.orderNumber || '-'],
    ['Tarih', formatDate(order?.createdAt)],
    ['Siparis Durumu', statusMeta[order?.orderStatus]?.label || String(order?.orderStatus || '-')],
    ['Odeme Durumu', paymentMeta[order?.paymentStatus]?.label || String(order?.paymentStatus || '-')],
    ['Odeme Tipi', paymentMethodLabel(order?.paymentMethod, order)]
  ].map(([label, value]) => `
    <div class="row">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `).join('')

  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Siparis Fisi - ${escapeHtml(order?.orderNumber || order?.id || '')}</title>
  <style>
    :root {
      color-scheme: light;
      --paper: #ffffff;
      --bg: #e5e7eb;
      --text: #111827;
      --muted: #6b7280;
      --line: #d1d5db;
      --accent: #f59e0b;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: "Segoe UI", Arial, sans-serif;
      padding: 24px;
    }
    .page {
      width: 80mm;
      margin: 0 auto;
      background: var(--paper);
      box-shadow: 0 20px 40px rgba(15, 23, 42, 0.18);
      border-radius: 14px;
      padding: 14px 12px 24px;
    }
    .title {
      text-align: center;
      font-size: 22px;
      font-weight: 800;
      letter-spacing: 0.4px;
    }
    .subtitle {
      margin-top: 4px;
      text-align: center;
      font-size: 12px;
      color: var(--muted);
    }
    .divider {
      border-top: 1px dashed var(--line);
      margin: 12px 0;
    }
    .meta, .customer, .totals, .footer {
      display: grid;
      gap: 6px;
      font-size: 12px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      align-items: flex-start;
    }
    .row span:first-child {
      color: var(--muted);
    }
    .items {
      display: grid;
      gap: 10px;
    }
    .item {
      display: grid;
      gap: 4px;
    }
    .item-head {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      align-items: flex-start;
    }
    .item-name {
      font-size: 13px;
      font-weight: 700;
    }
    .item-total {
      font-size: 13px;
      font-weight: 800;
      white-space: nowrap;
    }
    .item-meta, .item-note {
      font-size: 11px;
      color: var(--muted);
    }
    .grand-total {
      font-size: 16px;
      font-weight: 900;
    }
    .actions {
      display: flex;
      justify-content: center;
      gap: 8px;
      margin-top: 16px;
    }
    button {
      appearance: none;
      border: 0;
      border-radius: 999px;
      padding: 10px 16px;
      background: var(--accent);
      color: #fff;
      font-weight: 700;
      cursor: pointer;
    }
    button.secondary {
      background: #e5e7eb;
      color: var(--text);
    }
    @page {
      size: 80mm auto;
      margin: 6mm;
    }
    @media print {
      body {
        background: #fff;
        padding: 0;
      }
      .page {
        width: auto;
        margin: 0;
        box-shadow: none;
        border-radius: 0;
        padding: 0;
      }
      .actions {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="title">Siparis Fisi</div>
    <div class="subtitle">${escapeHtml(order?.branchName || 'QR Siparis')}</div>
    <div class="divider"></div>

    <div class="meta">${summaryRows}</div>

    ${customerInfo ? `<div class="divider"></div><div class="customer">${customerInfo}</div>` : ''}

    <div class="divider"></div>
    <div class="items">${itemRows || '<div class="item-meta">Urun bulunamadi.</div>'}</div>

    <div class="divider"></div>
    <div class="totals">
      <div class="row"><span>Ara Toplam</span><strong>${escapeHtml(formatPrintMoney(order?.subtotal ?? order?.total ?? 0))}</strong></div>
      ${Number(order?.discountTotal || 0) > 0 ? `<div class="row"><span>Indirim${Number(order?.discountPercent || 0) > 0 ? ` (%${escapeHtml(Number(order.discountPercent).toLocaleString('tr-TR'))})` : ''}</span><strong>- ${escapeHtml(formatPrintMoney(order?.discountTotal || 0))}</strong></div>` : ''}
      <div class="row grand-total"><span>Toplam</span><strong>${escapeHtml(formatPrintMoney(order?.total || 0))}</strong></div>
      <div class="row"><span>Odeme Kanali</span><strong>${escapeHtml(paymentMethodLabel(order?.paymentMethod, order))}</strong></div>
    </div>

    ${order?.customerNote ? `<div class="divider"></div><div class="footer"><div><strong>Musteri Notu:</strong> ${escapeHtml(order.customerNote)}</div></div>` : ''}

    <div class="actions">
      <button type="button" onclick="window.print()">Yazdir</button>
      <button type="button" class="secondary" onclick="window.close()">Kapat</button>
    </div>
  </div>
</body>
</html>`
}

function wrapCanvasText(ctx, text, maxWidth) {
  const source = toPdfSafeText(text).replace(/\s+/g, ' ').trim()
  if (!source) return ['-']
  const words = source.split(' ')
  const lines = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (!current || ctx.measureText(candidate).width <= maxWidth) {
      current = candidate
      continue
    }
    lines.push(current)
    current = word
  }
  if (current) lines.push(current)
  return lines.length > 0 ? lines : ['-']
}

function pdfEscape(value) {
  return String(value ?? '')
    .replaceAll('\\', '\\\\')
    .replaceAll('(', '\\(')
    .replaceAll(')', '\\)')
}

function numberToPdf(value) {
  return Number(value || 0).toFixed(2).replace(/\.00$/, '')
}

function bytesFromString(value) {
  return new TextEncoder().encode(String(value || ''))
}

function canvasToJpegBytes(canvas, quality = 0.92) {
  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  const base64 = dataUrl.split(',')[1] || ''
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function concatPdfParts(parts) {
  const normalized = parts.map((part) => {
    if (part instanceof Uint8Array) return part
    return bytesFromString(part)
  })
  const total = normalized.reduce((sum, part) => sum + part.length, 0)
  const output = new Uint8Array(total)
  let offset = 0
  for (const part of normalized) {
    output.set(part, offset)
    offset += part.length
  }
  return output
}

function buildSingleImagePdf({ imageBytes, imageWidth, imageHeight, pageWidth, pageHeight, margin = 18 }) {
  const drawableWidth = Math.max(1, pageWidth - (margin * 2))
  const drawableHeight = Math.max(1, pageHeight - (margin * 2))
  const imageRatio = imageWidth / Math.max(1, imageHeight)
  let drawWidth = drawableWidth
  let drawHeight = drawWidth / Math.max(imageRatio, 0.0001)
  if (drawHeight > drawableHeight) {
    drawHeight = drawableHeight
    drawWidth = drawHeight * imageRatio
  }
  const drawX = (pageWidth - drawWidth) / 2
  const drawY = pageHeight - drawHeight - margin
  const contentStream = `q
${numberToPdf(drawWidth)} 0 0 ${numberToPdf(drawHeight)} ${numberToPdf(drawX)} ${numberToPdf(drawY)} cm
/Im0 Do
Q`
  const contentBytes = bytesFromString(contentStream)
  const objects = [
    bytesFromString('<< /Type /Catalog /Pages 2 0 R >>'),
    bytesFromString('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    bytesFromString(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${numberToPdf(pageWidth)} ${numberToPdf(pageHeight)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`),
    concatPdfParts([
      `<< /Type /XObject /Subtype /Image /Width ${Math.round(imageWidth)} /Height ${Math.round(imageHeight)} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>\nstream\n`,
      imageBytes,
      '\nendstream'
    ]),
    concatPdfParts([
      `<< /Length ${contentBytes.length} >>\nstream\n`,
      contentBytes,
      '\nendstream'
    ])
  ]

  let offset = bytesFromString('%PDF-1.4\n').length
  const offsets = [0]
  const parts = ['%PDF-1.4\n']
  for (let i = 0; i < objects.length; i++) {
    offsets.push(offset)
    const head = bytesFromString(`${i + 1} 0 obj\n`)
    const tail = bytesFromString('\nendobj\n')
    parts.push(head, objects[i], tail)
    offset += head.length + objects[i].length + tail.length
  }
  const xrefOffset = offset
  const xrefRows = ['0000000000 65535 f \n']
  for (let i = 1; i < offsets.length; i++) {
    xrefRows.push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`)
  }
  parts.push(`xref\n0 ${objects.length + 1}\n${xrefRows.join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`)
  return concatPdfParts(parts)
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.setTimeout(() => URL.revokeObjectURL(url), 15000)
}

function buildQrOrderReceiptPdfCanvas(order) {
  const width = 1240
  const estimatedHeight = Math.max(1320, 760 + ((Array.isArray(order?.items) ? order.items.length : 0) * 150))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = estimatedHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('PDF olusturulamadi')

  const pagePadding = 56
  const lineColor = '#d1d5db'
  const textColor = '#111827'
  const mutedColor = '#6b7280'
  const accentColor = '#b45309'
  const contentWidth = width - (pagePadding * 2)

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.textBaseline = 'top'

  let y = pagePadding

  const drawCentered = (text, font, color, nextGap = 38) => {
    ctx.font = font
    ctx.fillStyle = color
    const safe = toPdfSafeText(text)
    const measure = ctx.measureText(safe)
    ctx.fillText(safe, Math.max(pagePadding, (width - measure.width) / 2), y)
    y += nextGap
  }

  const drawDivider = () => {
    ctx.strokeStyle = lineColor
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(pagePadding, y)
    ctx.lineTo(width - pagePadding, y)
    ctx.stroke()
    y += 18
  }

  const drawLabelValue = (label, value) => {
    const left = pagePadding
    const right = width - pagePadding
    const gap = 18
    const labelWidth = 250
    const valueWidth = Math.max(120, contentWidth - labelWidth - gap)
    ctx.font = '600 26px Arial'
    ctx.fillStyle = mutedColor
    const labelText = toPdfSafeText(label)
    ctx.fillText(labelText, left, y)
    ctx.font = '700 26px Arial'
    ctx.fillStyle = textColor
    const lines = wrapCanvasText(ctx, value || '-', valueWidth)
    let lineY = y
    for (const line of lines) {
      const safeLine = toPdfSafeText(line)
      const measure = ctx.measureText(safeLine)
      ctx.fillText(safeLine, Math.max(left + labelWidth + gap, right - measure.width), lineY)
      lineY += 34
    }
    y = Math.max(y + 34, lineY) + 6
  }

  const drawBlock = (title, text) => {
    ctx.font = '700 26px Arial'
    ctx.fillStyle = textColor
    ctx.fillText(toPdfSafeText(title), pagePadding, y)
    y += 34
    ctx.font = '400 24px Arial'
    ctx.fillStyle = mutedColor
    const lines = wrapCanvasText(ctx, text || '-', contentWidth)
    for (const line of lines) {
      ctx.fillText(toPdfSafeText(line), pagePadding, y)
      y += 30
    }
    y += 8
  }

  drawCentered('Siparis Fisi', '900 42px Arial', textColor, 44)
  drawCentered(order?.branchName || 'QR Siparis', '700 24px Arial', accentColor, 32)
  if (order?.branchName) {
    drawCentered(`QR Siparis ${order?.orderNumber || order?.id || ''}`, '700 20px Arial', mutedColor, 28)
  }
  drawDivider()

  drawLabelValue('Siparis No', order?.orderNumber || order?.id || '-')
  drawLabelValue('Tarih', formatDate(order?.createdAt))
  drawLabelValue('Siparis Durumu', statusMeta[order?.orderStatus]?.label || String(order?.orderStatus || '-'))
  drawLabelValue('Odeme Durumu', paymentMeta[order?.paymentStatus]?.label || String(order?.paymentStatus || '-'))
  drawLabelValue('Odeme Tipi', paymentMethodLabel(order?.paymentMethod, order))

  const customerLines = [
    order?.customerName ? `Musteri: ${order.customerName}` : '',
    order?.customerPhone ? `Telefon: ${order.customerPhone}` : '',
    order?.customerLocation ? `Lokasyon: ${order.customerLocation}` : '',
    order?.customerAddress ? `Adres: ${order.customerAddress}` : '',
    order?.branchName ? `Sube: ${order.branchName}` : ''
  ].filter(Boolean)
  if (customerLines.length > 0) {
    drawDivider()
    drawBlock('Musteri Bilgileri', customerLines.join('  |  '))
  }

  drawDivider()
  ctx.font = '800 28px Arial'
  ctx.fillStyle = textColor
  ctx.fillText('Urunler', pagePadding, y)
  y += 44

  const items = Array.isArray(order?.items) ? order.items : []
  if (items.length === 0) {
    ctx.font = '400 24px Arial'
    ctx.fillStyle = mutedColor
    ctx.fillText('Urun bulunamadi.', pagePadding, y)
    y += 40
  } else {
    for (const item of items) {
      ctx.font = '700 26px Arial'
      ctx.fillStyle = textColor
      const itemNameWidth = contentWidth - 220
      const nameLines = wrapCanvasText(ctx, item?.productName || '-', itemNameWidth)
      const totalText = formatPrintMoney(item?.totalPrice || 0)
      const firstLine = toPdfSafeText(nameLines[0] || '-')
      ctx.fillText(firstLine, pagePadding, y)
      const totalMeasure = ctx.measureText(toPdfSafeText(totalText))
      ctx.fillText(toPdfSafeText(totalText), width - pagePadding - totalMeasure.width, y)
      y += 34
      ctx.font = '400 23px Arial'
      ctx.fillStyle = mutedColor
      for (let index = 1; index < nameLines.length; index++) {
        ctx.fillText(toPdfSafeText(nameLines[index]), pagePadding, y)
        y += 30
      }
      const metaText = `${Number(item?.quantity || 0)} adet x ${formatPrintMoney(item?.unitPrice || 0)}`
      ctx.fillText(toPdfSafeText(metaText), pagePadding, y)
      y += 30
      if (item?.note) {
        const noteLines = wrapCanvasText(ctx, `Not: ${item.note}`, contentWidth)
        for (const noteLine of noteLines) {
          ctx.fillText(toPdfSafeText(noteLine), pagePadding, y)
          y += 30
        }
      }
      y += 14
      drawDivider()
    }
  }

  drawLabelValue('Ara Toplam', formatPrintMoney(order?.subtotal ?? order?.total ?? 0))
  if (Number(order?.discountTotal || 0) > 0) {
    const discountLabel = Number(order?.discountPercent || 0) > 0
      ? `Indirim (%${Number(order?.discountPercent || 0).toLocaleString('tr-TR')})`
      : 'Indirim'
    drawLabelValue(discountLabel, `- ${formatPrintMoney(order?.discountTotal || 0)}`)
  }
  drawLabelValue('Toplam', formatPrintMoney(order?.total || 0))

  if (order?.customerNote) {
    drawDivider()
    drawBlock('Musteri Notu', order.customerNote)
  }

  y += 10
  ctx.font = '700 22px Arial'
  ctx.fillStyle = mutedColor
  const footerText = 'PenPOS QR Siparis'
  const footerMeasure = ctx.measureText(footerText)
  ctx.fillText(footerText, (width - footerMeasure.width) / 2, y)
  y += 36

  const cropped = document.createElement('canvas')
  cropped.width = canvas.width
  cropped.height = Math.min(canvas.height, Math.max(760, Math.ceil(y + pagePadding)))
  const croppedCtx = cropped.getContext('2d')
  if (!croppedCtx) throw new Error('PDF olusturulamadi')
  croppedCtx.fillStyle = '#ffffff'
  croppedCtx.fillRect(0, 0, cropped.width, cropped.height)
  croppedCtx.drawImage(canvas, 0, 0)
  return cropped
}

function downloadQrOrderReceiptPdf(order) {
  const canvas = buildQrOrderReceiptPdfCanvas(order)
  const pdfBytes = buildSingleImagePdf({
    imageBytes: canvasToJpegBytes(canvas),
    imageWidth: canvas.width,
    imageHeight: canvas.height,
    pageWidth: 419.53,
    pageHeight: 595.28,
    margin: 12
  })
  const safeOrderNo = pdfEscape(toPdfSafeText(order?.orderNumber || order?.id || 'siparis'))
    .replace(/[^\w\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'siparis'
  downloadBlob(new Blob([pdfBytes], { type: 'application/pdf' }), `siparis-fisi-${safeOrderNo}.pdf`)
}

function openQrOrderReceiptPrint(order) {
  const html = buildQrOrderReceiptHtml(order)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank', 'noopener,noreferrer,width=480,height=900')
  if (!win) {
    window.setTimeout(() => URL.revokeObjectURL(url), 15000)
    throw new Error('Yazdirma penceresi acilamadi')
  }
  window.setTimeout(() => {
    try {
      win.focus()
      win.print()
    } catch {
    }
  }, 300)
  window.setTimeout(() => URL.revokeObjectURL(url), 15000)
  return win
}

function todayInputValue() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function mapPaymentTypeToCollectionMethod(type) {
  if (type === 'cash') return 'cash'
  if (type === 'pos' || type === 'card') return 'pos'
  if (type === 'bank') return 'bank'
  return ''
}

function getNextOrderAction(status) {
  const flow = {
    new: { nextStatus: 'preparing', label: 'Hazirlamaya Gec' },
    preparing: { nextStatus: 'ready', label: 'Hazir Olarak Isaretle' },
    ready: { nextStatus: 'delivered', label: 'Teslim Edildi Yap' }
  }
  return flow[String(status || '')] || null
}

function getNextPaymentAction(status, isTransferredToCari) {
  if (isTransferredToCari || String(status || '') === 'cari') return null

  const flow = {
    pending: { nextStatus: 'paid', label: 'Odendi Olarak Isaretle' },
    unpaid: { nextStatus: 'paid', label: 'Odendi Olarak Isaretle' }
  }

  return flow[String(status || '')] || null
}

function Badge({ meta }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 999,
        padding: '7px 12px',
        fontSize: 13,
        fontWeight: 900,
        letterSpacing: 0.2,
        background: meta.bg,
        color: meta.color,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.42)'
      }}
    >
      {meta.label}
    </span>
  )
}

function SummaryField({ label, value, align = 'left', compact = false }) {
  return (
    <div
      style={{
        borderRadius: compact ? 14 : 18,
        background: 'linear-gradient(180deg, color-mix(in srgb, var(--app-surface) 96%, transparent), var(--app-surface-soft, var(--panelElevated)))',
        border: '1px solid var(--app-border, var(--border))',
        padding: compact ? '8px 10px' : '10px 12px',
        display: 'grid',
        gap: compact ? 3 : 4,
        textAlign: align,
        boxShadow: 'var(--card-shadow)',
        fontSize: 13
      }}
    >
      <div style={{ fontSize: 13, color: 'var(--app-text-secondary, var(--muted))', fontWeight: 700 }}>{label}</div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 900,
          color: 'var(--app-text, var(--text))',
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        {value || '-'}
      </div>
    </div>
  )
}

function StatCard({ label, value, tone = 'dark', compact = false }) {
  const tones = {
    dark: {
      bg: 'var(--theme-card-bg, var(--panel))',
      color: 'var(--app-text, var(--text))',
      muted: 'var(--app-text-secondary, var(--muted))'
    },
    blue: {
      bg: 'color-mix(in srgb, #60a5fa 16%, var(--app-surface))',
      color: 'var(--app-text, var(--text))',
      muted: 'var(--app-text-secondary, var(--muted))'
    },
    green: {
      bg: 'color-mix(in srgb, #34d399 16%, var(--app-surface))',
      color: 'var(--app-text, var(--text))',
      muted: 'var(--app-text-secondary, var(--muted))'
    },
    amber: {
      bg: 'color-mix(in srgb, #f59e0b 16%, var(--app-surface))',
      color: 'var(--app-text, var(--text))',
      muted: 'var(--app-text-secondary, var(--muted))'
    }
  }
  const palette = tones[tone] || tones.dark
  return (
    <div
      style={{
        borderRadius: compact ? 14 : 22,
        padding: compact ? '8px 9px' : '13px 15px',
        background: palette.bg,
        color: palette.color,
        boxShadow: 'var(--card-shadow)',
        border: '1px solid var(--app-border, var(--border))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: compact ? 6 : 12
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 800, color: palette.muted }}>{label}</div>
      <div style={{ fontSize: 13, lineHeight: 1, fontWeight: 950, whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  )
}

function FilterField({ label, children, compact = false, hideLabel = false }) {
  return (
    <label style={{ display: 'grid', gap: hideLabel ? 0 : (compact ? 3 : 4), minWidth: 0 }}>
      {!hideLabel ? <span style={{ fontSize: 13, color: 'var(--app-text-secondary, var(--muted))', fontWeight: 800 }}>{label}</span> : null}
      {children}
    </label>
  )
}

function SearchField({ value, onChange, compact = false, hideLabel = false }) {
  return (
    <label style={{ display: 'grid', gap: hideLabel ? 0 : (compact ? 3 : 6), minWidth: 0 }}>
      {!compact && !hideLabel ? (
        <span style={{ fontSize: 13, color: 'var(--app-text-secondary, var(--muted))', fontWeight: 800 }}>Arama</span>
      ) : null}
      <div style={{ position: 'relative' }}>
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: compact ? 10 : 12,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: compact ? 10 : 14,
            color: 'var(--app-text-secondary, var(--muted))',
            pointerEvents: 'none',
            opacity: 0
          }}
        >
          🔎
        </span>
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: compact ? 10 : 12,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--app-text-secondary, var(--muted))',
            pointerEvents: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <svg
            width={compact ? 10 : 14}
            height={compact ? 10 : 14}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        </span>
        <input
          className="input"
          value={value}
          onChange={onChange}
          placeholder={compact ? 'Ara' : 'Ad, telefon, siparis no'}
          aria-label="Ara"
          style={{ paddingLeft: compact ? 24 : 38, minHeight: compact ? 30 : undefined, fontSize: 13 }}
        />
      </div>
    </label>
  )
}

function SectionBlock({ title, children }) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ fontWeight: 900, color: 'var(--app-text, var(--text))', fontSize: 13 }}>{title}</div>
      {children}
    </div>
  )
}

export default function CanteenQrOrdersPage() {
  const { me, session } = useOutletContext()
  const [orders, setOrders] = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedOrderId, setSelectedOrderId] = useState(null)
  const [paymentPickerOpen, setPaymentPickerOpen] = useState(false)
  const [discountPickerOpen, setDiscountPickerOpen] = useState(false)
  const [discountDraft, setDiscountDraft] = useState('')
  const [createCariCandidate, setCreateCariCandidate] = useState(null)
  const [collectionDeleteOpen, setCollectionDeleteOpen] = useState(false)
  const [collectionDeleteTarget, setCollectionDeleteTarget] = useState(null)
  const [collectionDeleteReason, setCollectionDeleteReason] = useState('')
  const [collectionDeleteLoading, setCollectionDeleteLoading] = useState(false)
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth <= 768
  })
  const [isNarrowMobile, setIsNarrowMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth <= 560
  })
  const mobileCardScale = isNarrowMobile
    ? { pad: 12, radius: 18, gap: 10, image: 52, productImage: 36, title: 13, meta: 12, button: 12 }
    : { pad: 10, radius: 18, gap: 9, image: 48, productImage: 32, title: 11, meta: 12, button: 11 }
  const [filters, setFilters] = useState({
    status: '',
    paymentStatus: '',
    search: '',
    dateStart: todayInputValue(),
    dateEnd: todayInputValue()
  })

  const allowedBranchIds = useMemo(
    () => Array.isArray(session?.allowedBranchIds) ? session.allowedBranchIds.map(String).filter(Boolean) : [],
    [session?.allowedBranchIds]
  )

  const selectedBranchId = useMemo(() => {
    let stored = ''
    try {
      stored = String(localStorage.getItem('selectedBranchId_canteen') || '')
    } catch {
      stored = ''
    }
    const sessionBranchId = String(session?.branchId || '')
    const allowed = new Set(allowedBranchIds)
    if (stored && (allowed.size === 0 || allowed.has(stored))) return stored
    if (sessionBranchId && (allowed.size === 0 || allowed.has(sessionBranchId))) return sessionBranchId
    if (allowedBranchIds.length === 1) return String(allowedBranchIds[0] || '')
    return ''
  }, [allowedBranchIds, session?.branchId])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768)
      setIsNarrowMobile(window.innerWidth <= 560)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const allowed = new Set(allowedBranchIds)
    try {
      const raw = String(localStorage.getItem('selectedBranchId_canteen') || '')
      if (raw && allowed.size > 0 && !allowed.has(raw)) localStorage.removeItem('selectedBranchId_canteen')
      if (!raw && selectedBranchId) localStorage.setItem('selectedBranchId_canteen', String(selectedBranchId))
    } catch {
    }
  }, [allowedBranchIds, selectedBranchId])

  const canView = me?.role === 'tenant_admin' || (Array.isArray(me?.permissions) && (
    me.permissions.includes('canteen_pos_access') ||
    me.permissions.includes('canteen_customers_view') ||
    me.permissions.includes('canteen_customers_manage')
  ))
  const canDeleteCollection = me?.role === 'tenant_admin' || (Array.isArray(me?.permissions) && (me.permissions.includes('canteen_customer_payment_delete') || me.permissions.includes('canteen_customers_manage')))

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (selectedBranchId) params.set('branchId', selectedBranchId)
    if (filters.status) params.set('status', filters.status)
    if (filters.paymentStatus) params.set('paymentStatus', filters.paymentStatus)
    if (filters.search.trim()) params.set('search', filters.search.trim())
    if (filters.dateStart) params.set('dateStart', filters.dateStart)
    if (filters.dateEnd) params.set('dateEnd', filters.dateEnd)
    return params.toString()
  }, [filters, selectedBranchId])

  const load = async (options = {}) => {
    const background = options?.background === true
    if (!background) setLoading(true)
    if (!background) setError('')
    const response = await api(`/api/canteen/qr-orders${queryString ? `?${queryString}` : ''}`, { silent: true })
    if (!response?.ok) {
      setOrders([])
      setError(response?.message || 'QR siparisleri yuklenemedi.')
      if (!background) setLoading(false)
      return
    }
    setOrders(Array.isArray(response?.items) ? response.items : [])
    if (!background) setLoading(false)
  }

  const loadPaymentMethods = async () => {
    const res = await api('/api/canteen/payment-settings', { silent: true })
    const enabled = buildCanteenPaymentMethods(res?.settings || {})
    setPaymentMethods(enabled)
  }

  useEffect(() => {
    if (!canView) return
    load()
    loadPaymentMethods()
  }, [canView, queryString])
  useCanteenAutoRefresh(() => load({ background: true }), [queryString], { enabled: canView, intervalMs: 3000 })

  const callAction = async (path, options = {}) => {
    const response = await api(path, {
      silent: true,
      headers: { 'x-branch-id': String(selectedBranchId || '') },
      ...options
    })
    if (!response?.ok) {
      setError(response?.message || 'Islem tamamlanamadi.')
      return null
    }
    await load()
    return response
  }

  const updateStatus = async (order, orderStatus) => {
    await callAction(`/api/canteen/qr-orders/${encodeURIComponent(order.id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ orderStatus })
    })
  }

  const updatePayment = async (order, paymentStatus, paymentMethod = '') => {
    await callAction(`/api/canteen/qr-orders/${encodeURIComponent(order.id)}/payment`, {
      method: 'PATCH',
      body: JSON.stringify({ paymentStatus, paymentMethod, discountPercent: selectedDiscountPercent })
    })
    setPaymentPickerOpen(false)
    setDiscountPickerOpen(false)
  }

  const handleTakePayment = async (order, method) => {
    const methodType = String(method?.type || '')
    if (!methodType) return

    if (methodType === 'account') {
      await transferToCari(order, true)
      setPaymentPickerOpen(false)
      setDiscountPickerOpen(false)
      return
    }

    if (order?.isTransferredToCari === true || String(order?.paymentStatus || '') === 'cari') {
      const customerId = String(order?.cariId || order?.customerId || '')
      const collectionMethod = mapPaymentTypeToCollectionMethod(methodType)
      if (!customerId || !collectionMethod) {
        setError('Cari tahsilati icin gecerli musteri veya odeme yontemi bulunamadi.')
        return
      }

      const collectResponse = await api(`/api/canteen/customers/${encodeURIComponent(customerId)}/collect`, {
        method: 'POST',
        silent: true,
        headers: { 'x-branch-id': String(selectedBranchId || '') },
        body: JSON.stringify({
          method: collectionMethod,
          amount: selectedNetTotal,
          note: `QR siparisi ${order.orderNumber || ''} tahsil edildi`
        })
      })
      if (!collectResponse?.ok) {
        setError(collectResponse?.message || 'Tahsilat kaydedilemedi.')
        return
      }
    }

    await updatePayment(order, 'paid', method?.id || methodType)
  }

  const transferToCari = async (order, createCustomerIfMissing = false) => {
    const response = await api(`/api/canteen/qr-orders/${encodeURIComponent(order.id)}/transfer-to-cari`, {
      method: 'POST',
      silent: true,
      headers: { 'x-branch-id': String(selectedBranchId || '') },
      body: JSON.stringify({ createCustomerIfMissing, discountPercent: selectedDiscountPercent })
    })
    if (!response?.ok) {
      if (response?.code === 'customer_not_found_for_transfer') {
        setCreateCariCandidate(order)
        return
      }
      setError(response?.message || 'Siparis cariye islenemedi.')
      return
    }
    setCreateCariCandidate(null)
    setDiscountPickerOpen(false)
    await load()
  }

  const removeOrder = async (order) => {
    const response = await callAction(`/api/canteen/qr-orders/${encodeURIComponent(order.id)}`, { method: 'DELETE' })
    if (response?.ok && String(selectedOrderId) === String(order.id)) setSelectedOrderId(null)
  }

  const printOrderReceipt = (order) => {
    try {
      openQrOrderReceiptPrint(order)
    } catch (err) {
      setError(err?.message || 'Siparis fisi acilamadi.')
    }
  }

  const downloadOrderReceiptPdf = (order) => {
    try {
      downloadQrOrderReceiptPdf(order)
    } catch (err) {
      setError(err?.message || 'Siparis fisi PDF olarak indirilemedi.')
    }
  }

  const openDeleteCollection = (order, collection) => {
    const customerId = String(order?.cariId || order?.customerId || '').trim()
    const paymentId = String(collection?.id || '').trim()
    if (!customerId || !paymentId) return
    setCollectionDeleteTarget({
      customerId,
      paymentId,
      methodLabel: String(collection?.methodLabel || collection?.method || '').trim(),
      amount: Number(collection?.amount || 0),
    })
    setCollectionDeleteReason('')
    setCollectionDeleteOpen(true)
  }

  const confirmDeleteCollection = async () => {
    if (!collectionDeleteTarget?.customerId || !collectionDeleteTarget?.paymentId) return
    setCollectionDeleteLoading(true)
    const res = await deleteCustomerPayment(collectionDeleteTarget.customerId, collectionDeleteTarget.paymentId, collectionDeleteReason)
    setCollectionDeleteLoading(false)
    if (!res?.ok) {
      setError(res?.message || 'Tahsilat silinemedi.')
      return
    }
    setCollectionDeleteOpen(false)
    setCollectionDeleteTarget(null)
    await load()
  }

  const filteredOrders = useMemo(() => orders, [orders])
  const selected = useMemo(
    () => filteredOrders.find((order) => String(order.id) === String(selectedOrderId)) || null,
    [filteredOrders, selectedOrderId]
  )
  const selectedGrossTotal = useMemo(() => Number(selected?.subtotal ?? selected?.total ?? 0), [selected])
  const selectedDiscountPercent = useMemo(() => {
    const value = Number(String(discountDraft || '0').replace(',', '.'))
    if (!Number.isFinite(value)) return 0
    return Math.max(0, Math.min(100, value))
  }, [discountDraft])
  const selectedDiscountTotal = useMemo(
    () => roundMoney((selectedGrossTotal * selectedDiscountPercent) / 100),
    [selectedDiscountPercent, selectedGrossTotal]
  )
  const selectedNetTotal = useMemo(
    () => roundMoney(Math.max(0, selectedGrossTotal - selectedDiscountTotal)),
    [selectedDiscountTotal, selectedGrossTotal]
  )

  useEffect(() => {
    if (!selected) {
      setPaymentPickerOpen(false)
      setDiscountPickerOpen(false)
      return
    }
    if (selected.paymentStatus === 'paid') {
      setPaymentPickerOpen(false)
    }
  }, [selected])

  useEffect(() => {
    setDiscountDraft(Number(selected?.discountPercent || 0) > 0 ? String(Number(selected?.discountPercent || 0)) : '')
    setDiscountPickerOpen(false)
  }, [selected?.id, selected?.discountPercent])

  const paymentMethodOptions = useMemo(() => {
    return paymentMethods
  }, [paymentMethods])

  const hasCariRecord = (order) => {
    if (!order) return false
    return order.isTransferredToCari === true || !!String(order.relatedSaleId || '').trim()
  }

  const stats = useMemo(() => {
    const totalOrders = filteredOrders.length
    const totalRevenue = filteredOrders.reduce((sum, order) => sum + Number(order.total || 0), 0)
    const waitingOrders = filteredOrders.filter((order) => order.orderStatus === 'new' || order.orderStatus === 'preparing').length
    const cariOrders = filteredOrders.filter((order) => order.paymentStatus === 'cari').length
    return { totalOrders, totalRevenue, waitingOrders, cariOrders }
  }, [filteredOrders])

  if (!canView) return <div className="card">403 - Bu sayfaya yetkiniz yok.</div>

  return (
    <div className="canteen-qr-orders-page" style={{ display: 'grid', gap: 14 }}>
      <div
        className="card"
        style={{
          margin: 0,
          padding: isMobile ? 10 : 16,
          borderRadius: isMobile ? 20 : 28,
          border: '1px solid var(--app-border, var(--border))',
          background: 'radial-gradient(circle at top left, color-mix(in srgb, var(--theme-accent-soft) 90%, transparent), transparent 34%), linear-gradient(180deg, color-mix(in srgb, var(--app-surface) 96%, transparent), var(--app-surface-soft, var(--panelElevated)))',
          boxShadow: 'var(--card-shadow)',
          display: 'grid',
          gap: isMobile ? 10 : 14
        }}
      >
        <div style={{ display: 'flex', alignItems: 'stretch', justifyContent: 'flex-start', gap: isMobile ? 8 : 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? (isNarrowMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))') : 'repeat(4, minmax(180px, 1fr))', gap: isMobile ? 6 : 10, flex: '1 1 820px', minWidth: 0 }}>
            <StatCard label="Toplam Siparis" value={stats.totalOrders} tone="dark" compact={isMobile} />
            <StatCard label="Toplam Tutar" value={formatMoney(stats.totalRevenue)} tone="blue" compact={isMobile} />
            <StatCard label="Bekleyen Isler" value={stats.waitingOrders} tone="amber" compact={isMobile} />
            <StatCard label="Cariye Islenen" value={stats.cariOrders} tone="green" compact={isMobile} />
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? (isNarrowMobile ? 'repeat(2, minmax(0, 1fr))' : '0.50fr 0.50fr 0.50fr 0.72fr 0.72fr') : '1.45fr 1fr 1fr 0.9fr 0.9fr',
            gap: isMobile ? 6 : 10,
            padding: isMobile ? 6 : 10,
            borderRadius: isMobile ? 14 : 20,
            background: 'color-mix(in srgb, var(--app-surface) 86%, transparent)',
            border: '1px solid var(--app-border, var(--border))',
            backdropFilter: 'blur(10px)',
            alignItems: 'end'
          }}
        >
          <SearchField
            value={filters.search}
            compact
            hideLabel
            onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
          />
          <FilterField label="Siparis" compact hideLabel>
            <select
              className="input"
              aria-label="Siparis Durumu"
              style={{ minHeight: isMobile ? 30 : 40, fontSize: 13, paddingInline: isMobile ? 8 : 12 }}
              value={filters.status}
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
            >
              <option value="">Siparis</option>
              {orderStatusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </FilterField>
          <FilterField label="Odeme" compact hideLabel>
            <select
              className="input"
              aria-label="Odeme Durumu"
              style={{ minHeight: isMobile ? 30 : 40, fontSize: 13, paddingInline: isMobile ? 8 : 12 }}
              value={filters.paymentStatus}
              onChange={(event) => setFilters((current) => ({ ...current, paymentStatus: event.target.value }))}
            >
              <option value="">Odeme</option>
              {paymentStatusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </FilterField>
          <FilterField label="Baslangic" compact hideLabel>
            <input
              className="input"
              aria-label="Baslangic"
              style={{ minHeight: isMobile ? 30 : 40, fontSize: 13, paddingInline: isMobile ? 8 : 12 }}
              type="date"
              value={filters.dateStart}
              onChange={(event) => setFilters((current) => ({ ...current, dateStart: event.target.value }))}
            />
          </FilterField>
          <FilterField label="Bitis" compact hideLabel>
            <input
              className="input"
              aria-label="Bitis"
              style={{ minHeight: isMobile ? 30 : 40, fontSize: 13, paddingInline: isMobile ? 8 : 12 }}
              type="date"
              value={filters.dateEnd}
              onChange={(event) => setFilters((current) => ({ ...current, dateEnd: event.target.value }))}
            />
          </FilterField>
        </div>

        {error ? (
          <div style={{ borderRadius: 18, border: '1px solid #fecaca', background: 'linear-gradient(135deg, #fff1f2, #fef2f2)', color: '#b91c1c', padding: '13px 15px', fontWeight: 800 }}>
            {error}
          </div>
        ) : null}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(340px, 1fr))', gap: isMobile ? 10 : 14 }}>
        {filteredOrders.map((order) => {
          const orderBadge = statusMeta[order.orderStatus] || statusMeta.new
          const paymentBadge = paymentMeta[order.paymentStatus] || paymentMeta.pending
          const cariDisabled = order.isTransferredToCari || order.paymentStatus === 'paid' || order.orderStatus === 'cancelled'
          const itemCount = Array.isArray(order.items) ? order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0) : 0
          const leadItem = Array.isArray(order.items) ? order.items[0] : null

          return (
            <div
              key={order.id}
              className="card"
              role="button"
              tabIndex={0}
              onClick={() => setSelectedOrderId(order.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  setSelectedOrderId(order.id)
                }
              }}
              style={{
                margin: 0,
                padding: isMobile ? mobileCardScale.pad : 12,
                borderRadius: isMobile ? mobileCardScale.radius : 22,
                border: '1px solid var(--app-border, var(--border))',
                background: 'linear-gradient(180deg, color-mix(in srgb, var(--app-surface) 98%, transparent), var(--app-surface-soft, var(--panelElevated)))',
                boxShadow: 'var(--card-shadow)',
                display: 'grid',
                gap: isMobile ? mobileCardScale.gap : 10,
                cursor: 'pointer',
                transition: 'transform 160ms ease, box-shadow 160ms ease'
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: `${isMobile ? mobileCardScale.image : 68}px minmax(0, 1fr)`, gap: isMobile ? 10 : 12, alignItems: 'flex-start' }}>
                <ProductImage product={leadItem} alt={leadItem?.productName || order.customerName} width={isMobile ? mobileCardScale.image : 68} height={isMobile ? mobileCardScale.image : 68} style={{ width: isMobile ? mobileCardScale.image : 68, height: isMobile ? mobileCardScale.image : 68, objectFit: 'cover', borderRadius: isMobile ? 14 : 18, boxShadow: '0 10px 22px rgba(15, 23, 42, 0.1)' }} />
                <div style={{ display: 'grid', gap: 10, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: isMobile ? 8 : 12, alignItems: 'flex-start' }}>
                    <div style={{ display: 'grid', gap: 5, minWidth: 0 }}>
                      <div style={{ fontSize: isMobile ? mobileCardScale.title : 13, fontWeight: 950, color: 'var(--app-text, var(--text))', lineHeight: 1.25 }}>
                        {order.customerName || 'Misafir'}
                      </div>
                      <div style={{ color: 'var(--app-text-secondary, var(--muted))', fontWeight: 800, fontSize: isMobile ? mobileCardScale.meta : 13 }}>{order.customerPhone || '-'}</div>
                      <div style={{ color: 'var(--app-text-muted, var(--muted))', fontSize: isMobile ? mobileCardScale.meta : 13, fontWeight: 700, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{order.orderNumber || '-'}</div>
                    </div>

                    <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
                      <div style={{ fontSize: isMobile ? mobileCardScale.title : 13, fontWeight: 950, color: 'var(--app-text, var(--text))', lineHeight: 1.25 }}>{formatMoney(order.total)}</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <Badge meta={orderBadge} />
                        <Badge meta={paymentBadge} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(108px, 1fr))', gap: isMobile ? 10 : 8 }}>
                <SummaryField label="Siparis No" value={order.orderNumber} compact={isMobile} />
                <SummaryField label="Urun Adedi" value={`${itemCount} adet`} compact={isMobile} />
                <SummaryField label="Tarih / Saat" value={formatDate(order.createdAt)} compact={isMobile} />
              </div>

              {leadItem ? (
                <div style={{ display: 'flex', gap: isMobile ? 10 : 10, alignItems: 'center', minWidth: 0, borderRadius: isMobile ? 14 : 16, padding: isMobile ? 10 : 9, background: 'color-mix(in srgb, var(--app-surface-soft) 88%, transparent)', border: '1px solid var(--app-border, var(--border))' }}>
                  <ProductImage product={leadItem} alt={leadItem.productName} width={isMobile ? mobileCardScale.productImage : 42} height={isMobile ? mobileCardScale.productImage : 42} style={{ width: isMobile ? mobileCardScale.productImage : 42, height: isMobile ? mobileCardScale.productImage : 42, objectFit: 'cover', borderRadius: isMobile ? 10 : 12 }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 900, color: 'var(--app-text, var(--text))', fontSize: isMobile ? mobileCardScale.meta : 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{leadItem.productName}</div>
                    <div style={{ fontSize: isMobile ? mobileCardScale.meta : 13, color: 'var(--app-text-secondary, var(--muted))', marginTop: 2, fontWeight: 700 }}>
                      {leadItem.quantity} adet
                      {Array.isArray(order.items) && order.items.length > 1 ? ` • +${order.items.length - 1} urun daha` : ''}
                    </div>
                  </div>
                </div>
              ) : null}

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: isMobile ? 10 : 14, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'grid', gap: 4 }}>
                  <div style={{ fontSize: isMobile ? mobileCardScale.meta : 13, color: 'var(--app-text-muted, var(--muted))', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6 }}>Teslim Bilgisi</div>
                  <div style={{ fontSize: isMobile ? mobileCardScale.meta : 13, color: 'var(--app-text-secondary, var(--muted))', fontWeight: 800, lineHeight: 1.3, overflowWrap: 'anywhere' }}>
                    {order.branchName ? `${order.branchName} • ` : ''}
                    {order.customerLocation || 'Lokasyon yok'}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'none', gap: 8, width: isMobile ? '100%' : 'auto' }}>
                  <button
                    className="btn"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      setSelectedOrderId(order.id)
                    }}
                    style={{ borderRadius: isMobile ? 14 : 14, padding: isMobile ? '10px 12px' : '10px 14px', fontWeight: 900, fontSize: isMobile ? mobileCardScale.button : 13, minHeight: isMobile ? 42 : undefined }}
                  >
                    Detay Ac
                  </button>
                  <button
                    className="btn"
                    type="button"
                    disabled={cariDisabled}
                    onClick={(event) => {
                      event.stopPropagation()
                      transferToCari(order, true)
                    }}
                    style={{
                      borderRadius: isMobile ? 14 : 14,
                      padding: isMobile ? '10px 12px' : '10px 14px',
                      fontWeight: 900,
                      fontSize: isMobile ? mobileCardScale.button : 13,
                      minHeight: isMobile ? 42 : undefined,
                      background: cariDisabled ? 'var(--app-surface-soft, var(--panelElevated))' : 'color-mix(in srgb, var(--theme-accent) 16%, var(--app-surface))',
                      borderColor: 'var(--app-border, var(--border))',
                      color: cariDisabled ? 'var(--app-text-muted, var(--muted))' : 'var(--theme-accent-text, var(--app-text))',
                      opacity: 1
                    }}
                  >
                    Cariye Kaydet
                  </button>
                </div>
              </div>
            </div>
          )
        })}

        {!loading && filteredOrders.length === 0 ? (
          <div
            className="card"
            style={{
              margin: 0,
              padding: 22,
              borderRadius: 24,
              color: 'var(--app-text-secondary, var(--muted))',
              textAlign: 'center',
              background: 'linear-gradient(180deg, color-mix(in srgb, var(--app-surface) 96%, transparent), var(--app-surface-soft, var(--panelElevated)))',
              border: '1px solid var(--app-border, var(--border))',
              fontSize: 13
            }}
          >
            Kriterlere uygun QR siparisi bulunamadi.
          </div>
        ) : null}
      </div>

      <Modal open={!!selected} onClose={() => setSelectedOrderId(null)} title="QR Siparis Detayi">
        {selected ? (
          <div style={{ display: 'grid', gap: 14 }}>
            <div
              style={{
                display: 'grid',
                gap: 12,
                padding: 16,
                borderRadius: 22,
                background: 'radial-gradient(circle at top left, color-mix(in srgb, var(--theme-accent-soft) 82%, transparent), transparent 44%), linear-gradient(180deg, color-mix(in srgb, var(--app-surface) 96%, transparent), var(--app-surface-soft, var(--panelElevated)))',
                border: '1px solid var(--app-border, var(--border))'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ display: 'grid', gap: 5 }}>
                  <div style={{ fontSize: 13, fontWeight: 950, color: 'var(--app-text, var(--text))' }}>{selected.customerName || 'Misafir'}</div>
                  <div style={{ fontWeight: 800, color: 'var(--app-text-secondary, var(--muted))', fontSize: 13 }}>{selected.customerPhone || '-'}</div>
                  <div style={{ color: 'var(--app-text-muted, var(--muted))', fontWeight: 700, fontSize: 13 }}>{selected.orderNumber || '-'} • {formatDate(selected.createdAt)}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <Badge meta={statusMeta[selected.orderStatus] || statusMeta.new} />
                  <Badge meta={paymentMeta[selected.paymentStatus] || paymentMeta.pending} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
                <SummaryField label="Musteri" value={selected.customerName || 'Misafir'} />
                <SummaryField label="Telefon" value={selected.customerPhone} />
                <SummaryField label="Siparis No" value={selected.orderNumber} />
                <SummaryField label="Toplam" value={formatMoney(selected.total)} align="right" />
                <SummaryField label="Lokasyon" value={selected.customerLocation || '-'} />
                <SummaryField label="Sube" value={selected.branchName || '-'} />
              </div>
            </div>

            <SectionBlock title="Musteri Bilgileri">
              <div style={{ display: 'grid', gap: 8 }}>
                {selected.customerAddress ? <div><strong>Adres:</strong> {selected.customerAddress}</div> : null}
                {selected.customerEmail ? <div><strong>E-posta:</strong> {selected.customerEmail}</div> : null}
                {selected.customerNote ? <div><strong>Musteri Notu:</strong> {selected.customerNote}</div> : null}
                {!selected.customerAddress && !selected.customerEmail && !selected.customerNote ? <div style={{ color: 'var(--app-text-secondary, var(--muted))', fontSize: 13 }}>Ek musteri bilgisi yok.</div> : null}
              </div>
            </SectionBlock>

            <SectionBlock title="Siparis Urunleri">
              <div style={{ display: 'grid', gap: 12 }}>
                {(Array.isArray(selected.items) ? selected.items : []).map((item, index) => (
                  <div
                    key={`${selected.id}-${index}`}
                    style={{
                      borderRadius: 16,
                      background: 'linear-gradient(180deg, color-mix(in srgb, var(--app-surface) 96%, transparent), var(--app-surface-soft, var(--panelElevated)))',
                      border: '1px solid var(--app-border, var(--border))',
                      padding: 8,
                      display: 'grid',
                      gridTemplateColumns: '30px minmax(0, 1fr)',
                      gap: 10,
                      alignItems: 'center'
                    }}
                  >
                    <ProductImage product={item} alt={item.productName} width={30} height={30} style={{ width: 30, height: 30, objectFit: 'cover', borderRadius: 8 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                        <strong style={{ fontSize: 13 }}>{item.productName}</strong>
                        <strong style={{ color: 'var(--app-text, var(--text))', fontSize: 13 }}>{formatMoney(item.totalPrice)}</strong>
                      </div>
                      <div style={{ color: 'var(--app-text-secondary, var(--muted))', fontSize: 13, marginTop: 4, fontWeight: 700 }}>
                        {item.quantity} adet • {formatMoney(item.unitPrice)} / birim
                      </div>
                      {item.note ? <div style={{ marginTop: 8 }}><strong>Urun notu:</strong> {item.note}</div> : null}
                    </div>
                  </div>
                ))}
              </div>
            </SectionBlock>

            <SectionBlock title="Bagli Tahsilatlar">
              <div style={{ display: 'grid', gap: 8 }}>
                {(Array.isArray(selected.linkedCollections) ? selected.linkedCollections : []).map((collection) => (
                  <div
                    key={collection.id}
                    style={{
                      borderRadius: 16,
                      background: 'linear-gradient(180deg, color-mix(in srgb, var(--app-surface) 96%, transparent), var(--app-surface-soft, var(--panelElevated)))',
                      border: '1px solid var(--app-border, var(--border))',
                      padding: 12,
                      display: 'grid',
                      gap: 8
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ display: 'grid', gap: 4 }}>
                        <div style={{ fontWeight: 900, fontSize: 13 }}>
                          Tahsilat • {collection.methodLabel || collection.method || '-'}
                        </div>
                        <div style={{ color: 'var(--app-text-secondary, var(--muted))', fontSize: 12 }}>
                          {formatDate(collection.createdAt)}
                        </div>
                        {collection.note ? (
                          <div style={{ color: 'var(--app-text-secondary, var(--muted))', fontSize: 12 }}>
                            Not: {collection.note}
                          </div>
                        ) : null}
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: 13 }}>{formatMoney(collection.amount)}</strong>
                        {canDeleteCollection ? (
                          <button
                            className="btn btn--danger"
                            type="button"
                            onClick={() => openDeleteCollection(selected, collection)}
                            disabled={collectionDeleteLoading}
                            style={{ fontSize: 13 }}
                          >
                            Sil
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
                {(!Array.isArray(selected.linkedCollections) || selected.linkedCollections.length === 0) ? (
                  <div style={{ color: 'var(--app-text-secondary, var(--muted))', fontSize: 13 }}>
                    Bu siparise bagli tahsilat kaydi yok.
                  </div>
                ) : null}
              </div>
            </SectionBlock>

            <SectionBlock title="Hizli Islemler">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn" type="button" onClick={() => printOrderReceipt(selected)} style={{ fontSize: 13 }}>Siparis Fisi Yazdir</button>
                <button className="btn" type="button" onClick={() => downloadOrderReceiptPdf(selected)} style={{ fontSize: 13 }}>Siparis Fisi PDF Indir</button>
                <button className="btn" type="button" onClick={() => updateStatus(selected, 'cancelled')} style={{ fontSize: 13 }}>Iptal Et</button>
                <button className="btn" type="button" onClick={() => removeOrder(selected)} style={{ fontSize: 13 }}>Sil</button>
              </div>
            </SectionBlock>

            <SectionBlock title="Durum Guncelle">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {getNextOrderAction(selected.orderStatus) ? (
                  <button
                    className="btn"
                    type="button"
                    onClick={() => updateStatus(selected, getNextOrderAction(selected.orderStatus).nextStatus)}
                    style={{
                      fontSize: 13,
                      minHeight: 42,
                      borderRadius: 14,
                      fontWeight: 900,
                      background: 'var(--theme-gradient)',
                      color: 'var(--surface-strong-contrast, #ffffff)',
                      borderColor: 'var(--app-border, var(--border))'
                    }}
                  >
                    {getNextOrderAction(selected.orderStatus).label}
                  </button>
                ) : null}

                {selected.paymentStatus !== 'paid' && selected.orderStatus !== 'cancelled' ? (
                  <>
                    <button
                      className="btn"
                      type="button"
                      onClick={() => setPaymentPickerOpen((current) => !current)}
                      style={{
                        fontSize: 13,
                        minHeight: 42,
                        borderRadius: 14,
                        fontWeight: 900,
                        background: 'var(--theme-gradient)',
                        color: 'var(--surface-strong-contrast, #ffffff)',
                        borderColor: 'var(--app-border, var(--border))'
                      }}
                    >
                      Odeme Al
                    </button>

                    {paymentPickerOpen ? (
                      <div style={{ display: 'grid', gap: 8, minWidth: 'min(100%, 680px)' }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          <button
                            className="btn"
                            type="button"
                            onClick={() => setDiscountPickerOpen((current) => !current)}
                            style={{
                              fontSize: 13,
                              minHeight: 42,
                              borderRadius: 14,
                              fontWeight: 800
                            }}
                          >
                            {discountPickerOpen ? 'Indirimi Gizle' : `Indirim ${selectedDiscountPercent > 0 ? `%${selectedDiscountPercent}` : ''}`.trim()}
                          </button>
                        </div>

                        {discountPickerOpen ? (
                          <div
                            className="card"
                            style={{
                              margin: 0,
                              padding: 12,
                              display: 'grid',
                              gap: 8,
                              borderRadius: 16,
                              background: 'color-mix(in srgb, var(--app-surface) 92%, transparent)',
                              border: '1px solid var(--app-border, var(--border))'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                              <div style={{ fontSize: 12, color: 'var(--app-text-secondary, var(--muted))' }}>Brut</div>
                              <div style={{ fontWeight: 700 }}>{formatMoney(selectedGrossTotal)}</div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                              <div style={{ fontSize: 12, color: 'var(--app-text-secondary, var(--muted))' }}>Indirim (%)</div>
                              <input
                                className="input"
                                type="text"
                                inputMode="decimal"
                                value={discountDraft}
                                placeholder="0"
                                onChange={(event) => setDiscountDraft(String(event.target.value ?? '').replace(',', '.'))}
                                style={{ width: 120, minWidth: 120, textAlign: 'right', fontWeight: 700 }}
                                dir="ltr"
                              />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                              <div style={{ fontSize: 12, color: 'var(--app-text-secondary, var(--muted))' }}>Indirim Tutari</div>
                              <div style={{ fontWeight: 700 }}>{formatMoney(selectedDiscountTotal)}</div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                              <div style={{ fontSize: 12, color: 'var(--app-text-secondary, var(--muted))' }}>Net</div>
                              <div style={{ fontWeight: 800, color: 'var(--theme-accent, #f59e0b)' }}>{formatMoney(selectedNetTotal)}</div>
                            </div>
                          </div>
                        ) : null}

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {paymentMethodOptions.map((method) => (
                            <button
                              key={method.id}
                              className="btn"
                              type="button"
                              onClick={() => handleTakePayment(selected, method)}
                              disabled={method.type === 'account' && hasCariRecord(selected)}
                              style={{
                                fontSize: 13,
                                minHeight: 42,
                                borderRadius: 14,
                                fontWeight: 800,
                                opacity: method.type === 'account' && hasCariRecord(selected) ? 0.55 : 1
                              }}
                            >
                              {method.name}
                            </button>
                          ))}
                        </div>
                        {paymentMethodOptions.length === 0 ? (
                          <div style={{ color: 'var(--app-text-secondary, var(--muted))', fontSize: 12 }}>
                            Aktif ödeme yöntemi yok. Kantin ödeme ayarlarından en az bir yöntem açılmalı.
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                ) : null}

                <button
                  className="btn"
                  type="button"
                  disabled={selected.isTransferredToCari || selected.paymentStatus === 'paid' || selected.orderStatus === 'cancelled'}
                  onClick={() => transferToCari(selected, true)}
                  style={{
                    fontSize: 13,
                    minHeight: 42,
                    borderRadius: 14,
                    fontWeight: 900,
                    opacity: selected.isTransferredToCari || selected.paymentStatus === 'paid' || selected.orderStatus === 'cancelled' ? 0.55 : 1,
                    background: 'color-mix(in srgb, var(--theme-accent) 16%, var(--app-surface))',
                    borderColor: 'var(--app-border, var(--border))',
                    color: 'var(--theme-accent-text, var(--app-text))'
                  }}
                >
                  Cariye Kaydet
                </button>
              </div>
            </SectionBlock>
          </div>
        ) : null}
      </Modal>

      <Modal open={!!createCariCandidate} onClose={() => setCreateCariCandidate(null)} title="Yeni Cari Olusturulsun Mu?">
        {createCariCandidate ? (
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ color: 'var(--app-text-secondary, var(--muted))', lineHeight: 1.55, fontWeight: 700, fontSize: 13 }}>
              Bu telefon numarasi ile kayitli cari bulunamadi. Isterseniz musteri adi ve telefonu ile yeni cari olusturup siparisi borc olarak isleyebilirim.
            </div>
            <div
              className="card"
              style={{
                margin: 0,
                borderRadius: 22,
                border: '1px solid var(--app-border, var(--border))',
                background: 'linear-gradient(180deg, color-mix(in srgb, var(--app-surface) 96%, transparent), var(--app-surface-soft, var(--panelElevated)))',
                color: 'var(--app-text, var(--text))'
              }}
            >
              <div><strong>Musteri:</strong> {createCariCandidate.customerName}</div>
              <div><strong>Telefon:</strong> {createCariCandidate.customerPhone}</div>
              <div><strong>Tutar:</strong> {formatMoney(String(selected?.id || '') === String(createCariCandidate.id || '') ? selectedNetTotal : createCariCandidate.total)}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn" type="button" onClick={() => setCreateCariCandidate(null)}>Vazgec</button>
              <button className="btn btn--primary" type="button" onClick={() => transferToCari(createCariCandidate, true)}>Cari Olustur ve Kaydet</button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={collectionDeleteOpen} onClose={() => setCollectionDeleteOpen(false)} title="Tahsilati Sil">
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ color: 'var(--app-text-secondary, var(--muted))', fontSize: 13 }}>
            Bu tahsilat silindiginde QR siparisin odeme durumu da yeniden hesaplanacak.
          </div>
          <div
            className="card"
            style={{
              margin: 0,
              padding: 12,
              borderRadius: 16,
              background: 'linear-gradient(180deg, color-mix(in srgb, var(--app-surface) 96%, transparent), var(--app-surface-soft, var(--panelElevated)))',
              border: '1px solid var(--app-border, var(--border))'
            }}
          >
            <div><strong>Yontem:</strong> {collectionDeleteTarget?.methodLabel || '-'}</div>
            <div><strong>Tutar:</strong> {formatMoney(collectionDeleteTarget?.amount || 0)}</div>
          </div>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--app-text-secondary, var(--muted))' }}>Silme nedeni (opsiyonel)</span>
            <input className="input" value={collectionDeleteReason} onChange={(event) => setCollectionDeleteReason(event.target.value)} disabled={collectionDeleteLoading} />
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn" type="button" onClick={() => setCollectionDeleteOpen(false)} disabled={collectionDeleteLoading}>Vazgec</button>
            <button className="btn btn--danger" type="button" onClick={confirmDeleteCollection} disabled={collectionDeleteLoading}>
              {collectionDeleteLoading ? 'Siliniyor...' : 'Tahsilati Sil'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
