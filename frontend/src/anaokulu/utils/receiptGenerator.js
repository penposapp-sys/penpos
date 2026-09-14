/**
 * PenPOS Anaokulu Sistemi - Kurumsal Tahsilat Makbuzu Üreteci
 */

function numberToTrWords(num) {
  num = Number(num) || 0
  if (num === 0) return 'Sıfır TL'

  const ones = ['', 'Bir', 'İki', 'Üç', 'Dört', 'Beş', 'Altı', 'Yedi', 'Sekiz', 'Dokuz']
  const tens = ['', 'On', 'Yirmi', 'Otuz', 'Kırk', 'Elli', 'Altmış', 'Yetmiş', 'Seksen', 'Doksan']

  function convertGroup(n) {
    let res = ''
    const h = Math.floor(n / 100)
    const t = Math.floor((n % 100) / 10)
    const o = n % 10

    if (h > 0) {
      res += (h === 1 ? 'Yüz' : ones[h] + ' Yüz') + ' '
    }
    if (t > 0) {
      res += tens[t] + ' '
    }
    if (o > 0) {
      res += ones[o] + ' '
    }
    return res.trim()
  }

  const integerPart = Math.floor(num)
  const decimalPart = Math.round((num - integerPart) * 100)

  const billions = Math.floor(integerPart / 1000000000)
  const millions = Math.floor((integerPart % 1000000000) / 1000000)
  const thousands = Math.floor((integerPart % 1000000) / 1000)
  const remainder = integerPart % 1000

  let result = ''
  if (billions > 0) result += convertGroup(billions) + ' Milyar '
  if (millions > 0) result += convertGroup(millions) + ' Milyon '
  if (thousands > 0) {
    result += (thousands === 1 ? 'Bin' : convertGroup(thousands) + ' Bin') + ' '
  }
  if (remainder > 0) result += convertGroup(remainder) + ' '

  result = result.trim() + ' TL'
  if (decimalPart > 0) {
    result += ' ' + convertGroup(decimalPart) + ' Kuruş'
  }
  return '#' + result + '#'
}

function formatTrDate(dateStr) {
  if (!dateStr) return '—'
  try {
    const parts = dateStr.split('-')
    if (parts.length < 3) return dateStr
    const [y, m, d] = parts
    const date = new Date(Number(y), Number(m) - 1, Number(d))
    return date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      weekday: 'long'
    })
  } catch {
    return dateStr
  }
}

export function printCollectionReceipt({
  schoolName = 'Anaokulu',
  student = {},
  collection = {},
  planName = '',
  installmentNo = 0,
  dueDate = '',
  totalPlan = 0,
  totalCollected = 0,
  remaining = 0
}) {
  const safeId = String(collection.id || collection._id || '').slice(-5) || Math.floor(Math.random() * 90000 + 10000)
  const receiptNo = `MK-${(collection.date || '').replace(/-/g, '')}-${safeId}`
  const amt = Number(collection.amount) || 0
  const amtStr = amt.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const amtWords = numberToTrWords(amt)
  const trDateStr = formatTrDate(collection.date)
  const instLabel = Number(installmentNo) === 0 ? 'Peşin Ödeme' : `${installmentNo}. Taksit`

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <title>Tahsilat Makbuzu - ${student?.name || 'Öğrenci'}</title>
  <style>
    @page { size: A5 landscape; margin: 10mm; }
    @media print {
      body { margin: 0; padding: 0; background: #fff; }
      .no-print { display: none !important; }
      .receipt-container { box-shadow: none !important; border: 1.5px solid #0f172a !important; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #0f172a;
      background: #f1f5f9;
      margin: 0;
      padding: 20px;
      font-size: 13px;
    }
    .print-bar {
      max-width: 760px;
      margin: 0 auto 12px auto;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    .btn-print {
      background: #2563eb;
      color: #fff;
      border: none;
      padding: 8px 18px;
      border-radius: 8px;
      font-weight: 700;
      cursor: pointer;
      font-size: 13px;
      box-shadow: 0 2px 6px rgba(37,99,235,0.3);
    }
    .receipt-container {
      background: #fff;
      border: 2px solid #0f172a;
      border-radius: 12px;
      padding: 22px 26px;
      max-width: 760px;
      margin: 0 auto;
      position: relative;
      box-shadow: 0 10px 25px rgba(15,23,42,0.08);
      box-sizing: border-box;
    }
    .header {
      display: flex;
      justifyContent: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 14px;
    }
    .school-title {
      font-size: 19px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .doc-badge {
      font-size: 14px;
      font-weight: 900;
      background: #0f172a;
      color: #fff;
      padding: 6px 14px;
      border-radius: 6px;
      letter-spacing: 1px;
      text-transform: uppercase;
      text-align: right;
    }
    .meta-box {
      font-size: 11px;
      color: #475569;
      margin-top: 5px;
      line-height: 1.4;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-bottom: 14px;
    }
    .info-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 14px;
    }
    .info-title {
      font-size: 10px;
      font-weight: 800;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
    }
    .row {
      display: flex;
      justifyContent: space-between;
      padding: 3px 0;
      font-size: 12px;
    }
    .row-label { color: #64748b; }
    .row-val { font-weight: 700; color: #0f172a; text-align: right; }
    
    .payment-highlight {
      background: #f0fdf4;
      border: 1.5px solid #86efac;
      border-radius: 8px;
      padding: 12px 18px;
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .amount-words {
      font-size: 12px;
      font-weight: 700;
      color: #15803d;
      margin-top: 3px;
      font-style: italic;
    }
    .amount-num {
      font-size: 24px;
      font-weight: 900;
      color: #166534;
    }
    .balance-summary {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-bottom: 16px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 11px;
      text-align: center;
    }
    .balance-val {
      font-size: 13px;
      font-weight: 800;
      color: #0f172a;
      margin-top: 2px;
    }
    .signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      margin-top: 22px;
      padding-top: 10px;
    }
    .sign-box {
      text-align: center;
      border-top: 1px dashed #94a3b8;
      padding-top: 8px;
      font-size: 11px;
      color: #475569;
    }
    .sign-title {
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 35px;
    }
    .watermark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-25deg);
      font-size: 58px;
      font-weight: 900;
      color: rgba(22, 101, 52, 0.05);
      pointer-events: none;
      white-space: nowrap;
      user-select: none;
    }
  </style>
</head>
<body>
  <div class="print-bar no-print">
    <button class="btn-print" onclick="window.print()">🖨️ Yazdır / PDF Kaydet</button>
  </div>
  <div class="receipt-container">
    <div class="watermark">TAHSİLAT YAPILDI</div>
    <div class="header">
      <div>
        <div class="school-title">${schoolName}</div>
        <div class="meta-box">
          Öğrenci İşleri &amp; Muhasebe Birimi<br/>
          Düzenlenme: ${new Date().toLocaleDateString('tr-TR')} ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
      <div>
        <div class="doc-badge">TAHSİLAT MAKBUZU</div>
        <div class="meta-box" style="text-align:right">
          Makbuz No: <strong>${receiptNo}</strong><br/>
          Tahsilat Tarihi: <strong>${trDateStr}</strong>
        </div>
      </div>
    </div>

    <div class="grid-2">
      <!-- Öğrenci Bilgileri -->
      <div class="info-card">
        <div class="info-title">ÖĞRENCİ BİLGİLERİ</div>
        <div class="row">
          <span class="row-label">Adı Soyadı:</span>
          <span class="row-val">${student?.name || '—'}</span>
        </div>
        <div class="row">
          <span class="row-label">T.C. Kimlik No:</span>
          <span class="row-val">${student?.tax || student?.tcNo || student?.tc || '—'}</span>
        </div>
        <div class="row">
          <span class="row-label">Sınıfı / Şubesi:</span>
          <span class="row-val">${student?.class || student?.sinif || '—'}</span>
        </div>
        <div class="row">
          <span class="row-label">Veli Bilgisi:</span>
          <span class="row-val">${(student?.parent || student?.parentName || student?.veliAdi || '') + (student?.phone || student?.parentPhone ? ' (' + (student?.phone || student?.parentPhone) + ')' : '') || '—'}</span>
        </div>
      </div>

      <!-- Ödeme Detayları -->
      <div class="info-card">
        <div class="info-title">ÖDEME DETAYLARI</div>
        <div class="row">
          <span class="row-label">Hizmet / Kalem:</span>
          <span class="row-val">${collection?.item || planName || 'Eğitim / Ücret Planı'}</span>
        </div>
        <div class="row">
          <span class="row-label">Ödeme Kalemi:</span>
          <span class="row-val">${instLabel} ${dueDate ? `(Vade: ${dueDate})` : ''}</span>
        </div>
        <div class="row">
          <span class="row-label">Ödeme Türü:</span>
          <span class="row-val">${collection?.payment || 'Nakit'}</span>
        </div>
        <div class="row">
          <span class="row-label">Açıklama:</span>
          <span class="row-val">${collection?.note || '—'}</span>
        </div>
      </div>
    </div>

    <!-- Tutar Vurgusu -->
    <div class="payment-highlight">
      <div>
        <div style="font-size:11px;font-weight:700;color:#166534;text-transform:uppercase;">Tahsil Edilen Tutar</div>
        <div class="amount-words">${amtWords}</div>
      </div>
      <div class="amount-num">${amtStr} ₺</div>
    </div>


    <div class="signatures">
      <div class="sign-box">
        <div class="sign-title">TESLİM EDEN (VELİ / ÖDEYEN)</div>
        İmza
      </div>
      <div class="sign-box">
        <div class="sign-title">TAHSİL EDEN (OKUL YÖNETİMİ)</div>
        Kaşe / İmza
      </div>
    </div>
  </div>
</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) {
    alert('Lütfen tarayıcınızın açılır pencere (pop-up) engelleyicisini kapatın.')
    return
  }
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 400)
}
