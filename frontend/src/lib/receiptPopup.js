import { api } from './apiClient.js'

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;')

const formatMoney = (value) => {
  const num = Number(value || 0)
  return `${num.toFixed(2)} TL`
}

const formatDateTime = (value) => {
  try {
    return new Date(value).toLocaleString('tr-TR')
  } catch {
    return '-'
  }
}

const paymentMethodLabel = (value) => {
  if (value === 'cash') return 'Nakit'
  if (value === 'card') return 'Kart'
  return String(value || '-')
}

const buildReceiptPopupHtml = (receipt) => {
  const allItems = Array.isArray(receipt?.items) ? receipt.items : []
  const items = allItems.filter((item) => item?.status !== 'cancelled')
  const isQuickSale = String(receipt?.saleSource || '') === 'quick-sale'
  const isTableOrder = !isQuickSale && (String(receipt?.saleType || '') === 'table' || !!String(receipt?.tableName || '').trim())
  const total = Number(receipt?.totals?.grandTotal ?? receipt?.netTotal ?? 0)
  const paid = Number(receipt?.paidTotal ?? receipt?.totals?.paidTotal ?? 0)
  const remaining = Number(receipt?.balanceDue ?? receipt?.totals?.balanceDue ?? Math.max(0, total - paid))
  const receiptDate = receipt?.createdAt ? new Date(receipt.createdAt) : new Date()
  const dateText = Number.isFinite(receiptDate.getTime()) ? receiptDate.toLocaleDateString('tr-TR') : '-'
  const timeText = Number.isFinite(receiptDate.getTime()) ? receiptDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '-'
  const itemRows = items.map((item) => `
    <div class="item-row">
      <span class="item-name">${escapeHtml(item?.nameSnapshot || '-')}</span>
      <span class="qty">x${escapeHtml(item?.qty ?? 1)}</span>
      <span class="price">${escapeHtml(formatMoney(item?.subtotal || 0))}</span>
    </div>
  `).join('')
  const payments = (Array.isArray(receipt?.payments) ? receipt.payments : [])
    .map((payment) => {
      const method = payment?.methodLabel || payment?.methodName || payment?.method
      return method ? `${method}: ${formatMoney(payment?.amount)}` : ''
    })
    .filter(Boolean)
  const paymentText = payments.join(', ')
    || (String(receipt?.paymentMethod || '').trim()
      ? paymentMethodLabel(receipt.paymentMethod)
      : (paid > 0 ? 'Kısmi Ödendi' : (receipt?.paymentStatus === 'paid' ? 'Ödendi' : 'Bekliyor')))
  const logo = receipt?.logoUrl
    ? `<img class="logo" src="${escapeHtml(receipt.logoUrl)}" alt="" />`
    : ''
  const brand = `<header class="brand">${logo}<div class="business-name">${escapeHtml(receipt?.businessName || 'PENPOS')}</div></header>`
  const heading = (title) => `<div class="title">${escapeHtml(title)}</div>`
  const quickSaleBody = `
    ${heading('HIZLI SATIŞ')}
    <div class="pair"><strong>Fiş No:</strong><span>${escapeHtml(receipt?.receiptNo || '-')}</span></div>
    <div class="pair"><strong>Tarih / Saat:</strong><span>${escapeHtml(`${dateText} ${timeText}`)}</span></div>
    <div class="items">${itemRows}</div>
    <div class="total"><strong>TOPLAM</strong><strong>${escapeHtml(formatMoney(total))}</strong></div>
    <div class="payment"><strong>Ödeme:</strong> ${escapeHtml(paymentText)}</div>
    ${String(receipt?.note || '').trim() ? `<div class="note"><strong>Not:</strong> ${escapeHtml(receipt.note)}</div>` : ''}
    <footer>TEŞEKKÜR EDERİZ</footer>
  `
  const orderStatus = remaining <= 0.01 ? 'ÖDENDİ' : (paid > 0 ? 'KISMİ ÖDENDİ' : 'BEKLİYOR')
  const tableOrderBody = `
    ${heading('MASA SİPARİŞİ')}
    <div class="table-name">Masa: ${escapeHtml(receipt?.tableName || '-')}</div>
    <div class="meta">
      <div class="pair"><strong>Fiş No:</strong><span>${escapeHtml(receipt?.receiptNo || '-')}</span></div>
      <div class="pair"><strong>Sipariş No:</strong><span>${escapeHtml(receipt?.orderNo || '-')}</span></div>
      <div class="pair"><strong>Tarih:</strong><span>${escapeHtml(dateText)}</span></div>
      <div class="pair"><strong>Saat:</strong><span>${escapeHtml(timeText)}</span></div>
      <div class="pair"><strong>Kasiyer:</strong><span>${escapeHtml(receipt?.createdByName || '-')}</span></div>
      <div class="pair"><strong>Durum:</strong><span>${escapeHtml(orderStatus)}</span></div>
    </div>
    <div class="items">${itemRows}</div>
    <div class="summary">
      <div class="pair"><strong>Ara Toplam:</strong><span>${escapeHtml(formatMoney(receipt?.totals?.subtotal || 0))}</span></div>
      <div class="pair"><strong>Ödenen:</strong><span>${escapeHtml(formatMoney(paid))}</span></div>
      <div class="pair"><strong>Kalan:</strong><span>${escapeHtml(formatMoney(remaining))}</span></div>
      <div class="pair"><strong>Bakiye:</strong><span>${escapeHtml(formatMoney(receipt?.displayBalance || 0))}</span></div>
    </div>
    <div class="total"><strong>TOPLAM:</strong><strong>${escapeHtml(formatMoney(total))}</strong></div>
    <div class="payment"><strong>Ödeme:</strong> ${escapeHtml(paymentText)}</div>
    <footer>AFİYET OLSUN</footer>
  `
  if (!isQuickSale && !isTableOrder) {
    const genericItems = allItems.map((item) => `
      <tr>
        <td>${escapeHtml(item?.nameSnapshot || '-')}</td>
        <td class="qty">${escapeHtml(item?.qty ?? '-')}</td>
        <td class="price">${escapeHtml(formatMoney(item?.subtotal || 0))}</td>
      </tr>
    `).join('')
    return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Fiş - ${escapeHtml(receipt?.receiptNo || receipt?.id || '')}</title>
  <style>
    :root { color-scheme: light; --bg: #f8fafc; --card: #fff; --line: #e2e8f0; --text: #0f172a; --muted: #64748b; --accent: #d97706; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 24px; background: linear-gradient(180deg, #fff7ed 0%, var(--bg) 100%); color: var(--text); font: 14px/1.5 Arial, sans-serif; }
    .card { max-width: 560px; margin: 0 auto; background: var(--card); border: 1px solid #fed7aa; border-radius: 24px; padding: 24px; box-shadow: 0 20px 50px rgba(15, 23, 42, .12); }
    h1 { margin: 0 0 16px; text-align: center; font-size: 32px; }
    .meta { display: grid; gap: 6px; color: var(--muted); margin-bottom: 18px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0 18px; }
    th, td { padding: 10px 0; border-bottom: 1px solid var(--line); text-align: left; }
    th { font-size: 13px; color: var(--muted); }
    .qty, .price { white-space: nowrap; text-align: right; }
    .total { display: flex; justify-content: space-between; gap: 16px; font-size: 20px; font-weight: 700; }
    .note { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--line); color: var(--muted); }
    .actions { display: flex; justify-content: center; gap: 10px; margin-top: 20px; }
    button { border: 0; border-radius: 999px; padding: 10px 18px; background: var(--accent); color: #fff; font-weight: 700; cursor: pointer; }
    button.secondary { background: #e2e8f0; color: var(--text); }
    @media print { body { padding: 0; background: #fff; } .card { max-width: none; border: 0; border-radius: 0; box-shadow: none; padding: 0; } .actions { display: none; } }
  </style>
</head>
<body>
  <div class="card">
    <h1>Fiş</h1>
    <div class="meta">
      <div><strong>İşletme:</strong> ${escapeHtml(receipt?.businessName || 'PENPOS')}</div>
      <div><strong>Sipariş No:</strong> ${escapeHtml(receipt?.orderNo || receipt?.id || '-')}</div>
      <div><strong>Fiş No:</strong> ${escapeHtml(receipt?.receiptNo || '-')}</div>
      <div><strong>Tarih:</strong> ${escapeHtml(formatDateTime(receipt?.createdAt))}</div>
      <div><strong>Durum:</strong> ${escapeHtml(receipt?.status || '-')}</div>
      ${receipt?.tableName ? `<div><strong>Masa:</strong> ${escapeHtml(receipt.tableName)}</div>` : ''}
      ${receipt?.customerName ? `<div><strong>Müşteri:</strong> ${escapeHtml(receipt.customerName)}</div>` : ''}
    </div>
    <table><thead><tr><th>Ürün</th><th class="qty">Adet</th><th class="price">Tutar</th></tr></thead><tbody>${genericItems}</tbody></table>
    <div class="total"><span>Toplam</span><span>${escapeHtml(formatMoney(total))}</span></div>
    <div class="note"><div><strong>Ödeme:</strong> ${escapeHtml(paymentMethodLabel(receipt?.paymentMethod))}</div>${receipt?.note ? `<div style="margin-top:8px;"><strong>Not:</strong> ${escapeHtml(receipt.note)}</div>` : ''}</div>
    <div class="actions"><button type="button" onclick="window.print()">Yazdır</button><button type="button" class="secondary" onclick="window.close()">Kapat</button></div>
  </div>
</body>
</html>`
  }
  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Fiş - ${escapeHtml(receipt?.receiptNo || receipt?.id || '')}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 20px;
      background: #f1f5f9;
      color: #111;
      font: 13px/1.35 Arial, sans-serif;
    }
    .receipt {
      width: 80mm;
      max-width: 100%;
      margin: 0 auto;
      padding: 7px;
      background: #fff;
      font-size: 11px;
    }
    .brand { text-align: center; margin-bottom: 7px; }
    .logo { display: block; max-width: 42mm; max-height: 18mm; margin: 0 auto 4px; object-fit: contain; filter: grayscale(1) contrast(1.5); }
    .business-name { font-size: 15px; font-weight: 800; overflow-wrap: anywhere; }
    .title {
      margin: 6px 0;
      padding: 4px 3px;
      border-radius: 5px;
      background: #111;
      color: #fff;
      text-align: center;
      font-size: 15px;
      font-weight: 800;
    }
    .pair { display: flex; justify-content: space-between; gap: 6px; padding: 1px 0; }
    .pair strong { flex: 0 0 47%; }
    .pair span { min-width: 0; text-align: right; overflow-wrap: anywhere; }
    .table-name { margin: 5px 0; font-size: 13px; font-weight: 800; }
    .meta, .summary { border-top: 1px solid #111; padding-top: 4px; margin-top: 4px; }
    .items { margin: 7px 0; border-top: 1px solid #111; border-bottom: 1px dashed #111; padding: 4px 0; }
    .item-row { display: grid; grid-template-columns: minmax(0, 1fr) 12mm 23mm; gap: 2px; align-items: start; padding: 3px 0; }
    .item-name { overflow-wrap: anywhere; }
    .qty { text-align: center; white-space: nowrap; }
    .price { text-align: right; white-space: nowrap; }
    .total {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      margin: 5px 0;
      padding: 4px 0;
      border-top: 1px solid #111;
      border-bottom: 1px solid #111;
      font-size: 15px;
    }
    .payment, .note { margin-top: 5px; overflow-wrap: anywhere; }
    footer { margin-top: 13px; text-align: center; font-size: 13px; font-weight: 700; }
    .actions { display: flex; justify-content: center; gap: 10px; margin: 15px auto 0; }
    button { border: 0; border-radius: 5px; padding: 9px 16px; background: #111; color: #fff; font-weight: 700; cursor: pointer; }
    button.secondary { background: #ddd; color: #111; }
    @media print {
      @page { size: 80mm auto; margin: 2mm; }
      body { padding: 0; background: #fff; }
      .receipt { width: auto; max-width: none; padding: 0; }
      .actions { display: none; }
    }
  </style>
</head>
<body>
  <main class="receipt">${brand}${isQuickSale ? quickSaleBody : tableOrderBody}</main>
  <div class="actions">
    <button type="button" onclick="window.print()">Yazdır</button>
    <button type="button" class="secondary" onclick="window.close()">Kapat</button>
  </div>
</body>
</html>`
}

export const openReceiptPopup = async (orderId) => {
  const popup = window.open('about:blank', '_blank', 'popup=yes,width=640,height=900')
  if (!popup) throw new Error('Fiş popup penceresi açılamadı')

  popup.document.write('<!doctype html><html lang="tr"><head><meta charset="utf-8" /><title>Fiş</title></head><body style="font-family:Arial,sans-serif;padding:24px;">Yükleniyor...</body></html>')
  popup.document.close()

  const res = await api(`/api/pos/orders/${encodeURIComponent(orderId)}/receipt`)
  if (res?.success === false || !res?.receipt) {
    throw new Error(res?.message || 'Fiş verisi alınamadı')
  }

  popup.document.open()
  popup.document.write(buildReceiptPopupHtml(res.receipt))
  popup.document.close()
  try {
    popup.focus()
  } catch {}
  return popup
}
