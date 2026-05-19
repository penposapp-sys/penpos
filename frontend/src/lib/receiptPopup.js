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
  const items = Array.isArray(receipt?.items) ? receipt.items : []
  const itemRows = items.map((item) => `
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
  <title>Fis - ${escapeHtml(receipt?.receiptNo || receipt?.id || '')}</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f8fafc;
      --card: #ffffff;
      --line: #e2e8f0;
      --text: #0f172a;
      --muted: #64748b;
      --accent: #d97706;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      background: linear-gradient(180deg, #fff7ed 0%, var(--bg) 100%);
      color: var(--text);
      font: 14px/1.5 Arial, sans-serif;
    }
    .card {
      max-width: 560px;
      margin: 0 auto;
      background: var(--card);
      border: 1px solid #fed7aa;
      border-radius: 24px;
      padding: 24px;
      box-shadow: 0 20px 50px rgba(15, 23, 42, 0.12);
    }
    h1 {
      margin: 0 0 16px;
      text-align: center;
      font-size: 32px;
    }
    .meta {
      display: grid;
      gap: 6px;
      color: var(--muted);
      margin-bottom: 18px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0 18px;
    }
    th, td {
      padding: 10px 0;
      border-bottom: 1px solid var(--line);
      text-align: left;
    }
    th {
      font-size: 13px;
      color: var(--muted);
    }
    .qty, .price {
      white-space: nowrap;
      text-align: right;
    }
    .total {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      font-size: 20px;
      font-weight: 700;
    }
    .note {
      margin-top: 14px;
      padding-top: 14px;
      border-top: 1px solid var(--line);
      color: var(--muted);
    }
    .actions {
      display: flex;
      justify-content: center;
      gap: 10px;
      margin-top: 20px;
    }
    button {
      border: 0;
      border-radius: 999px;
      padding: 10px 18px;
      background: var(--accent);
      color: #fff;
      font-weight: 700;
      cursor: pointer;
    }
    button.secondary {
      background: #e2e8f0;
      color: var(--text);
    }
    @media print {
      body {
        padding: 0;
        background: #fff;
      }
      .card {
        max-width: none;
        border: 0;
        border-radius: 0;
        box-shadow: none;
        padding: 0;
      }
      .actions { display: none; }
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Fis</h1>
    <div class="meta">
      <div><strong>Isletme:</strong> ${escapeHtml(receipt?.businessName || 'PENPOS')}</div>
      <div><strong>Siparis No:</strong> ${escapeHtml(receipt?.orderNo || receipt?.id || '-')}</div>
      <div><strong>Fis No:</strong> ${escapeHtml(receipt?.receiptNo || '-')}</div>
      <div><strong>Tarih:</strong> ${escapeHtml(formatDateTime(receipt?.createdAt))}</div>
      <div><strong>Durum:</strong> ${escapeHtml(receipt?.status || '-')}</div>
      ${receipt?.tableName ? `<div><strong>Masa:</strong> ${escapeHtml(receipt.tableName)}</div>` : ''}
      ${receipt?.customerName ? `<div><strong>Musteri:</strong> ${escapeHtml(receipt.customerName)}</div>` : ''}
    </div>
    <table>
      <thead>
        <tr>
          <th>Urun</th>
          <th class="qty">Adet</th>
          <th class="price">Tutar</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
    <div class="total">
      <span>Toplam</span>
      <span>${escapeHtml(formatMoney(receipt?.totals?.grandTotal || 0))}</span>
    </div>
    <div class="note">
      <div><strong>Odeme:</strong> ${escapeHtml(paymentMethodLabel(receipt?.paymentMethod))}</div>
      ${receipt?.note ? `<div style="margin-top:8px;"><strong>Not:</strong> ${escapeHtml(receipt.note)}</div>` : ''}
    </div>
    <div class="actions">
      <button type="button" onclick="window.print()">Yazdir</button>
      <button type="button" class="secondary" onclick="window.close()">Kapat</button>
    </div>
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
