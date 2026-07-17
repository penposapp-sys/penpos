import { api } from '../../lib/apiClient.js'
import type { ZReportData, ZReportThermalVariant } from './zReportApi.ts'

const escapeHtml = (value: unknown) => String(value || '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')

const getThermalVariant = (report: ZReportData, paper: 'chars48' | 'chars32' = 'chars48'): ZReportThermalVariant | null => {
  const variant = report?.thermal?.variants?.[paper]
  return variant && typeof variant.text === 'string' && typeof variant.raw === 'string'
    ? variant
    : null
}

const toMoney = (value: unknown) =>
  `${Number(value || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`

const normalizeLabel = (value: unknown) => {
  const key = String(value || '').trim().toLocaleLowerCase('tr-TR')
  if (!key) return '-'
  if (['account', 'credit', 'veresiye', 'cari', 'veresiye / cari'].includes(key)) return 'Veresiye'
  if (['cash', 'nakit'].includes(key)) return 'Nakit'
  if (['card', 'kart', 'pos'].includes(key)) return 'Kart'
  if (['bank', 'banka', 'eft', 'havale'].includes(key)) return 'Banka'
  if (['online', 'online odeme', 'online ödeme'].includes(key)) return 'Online Odeme'
  if (['mealcard', 'meal_card', 'yemek karti', 'yemek kartı'].includes(key)) return 'Yemek Karti'
  return String(value || '-')
}

const buildPaymentTypeRows = (report: ZReportData): Array<Array<string>> => {
  const summary = report?.summary
  const rows = new Map<string, { label: string, total: number }>()
  const paymentBreakdown = Array.isArray(summary?.cashInBreakdown) && summary.cashInBreakdown.length > 0
    ? summary.cashInBreakdown
    : (Array.isArray(summary?.paymentBreakdown) ? summary.paymentBreakdown : [])

  for (const row of paymentBreakdown) {
    const label = `Toplam ${normalizeLabel(row.methodName)}`
    const key = label.toLocaleLowerCase('tr-TR')
    const current = rows.get(key) || { label, total: 0 }
    current.total += Number(row.totalAmount || 0)
    rows.set(key, current)
  }

  const creditTotal = Number(summary?.payments?.credit || 0)
  if (creditTotal > 0 && paymentBreakdown.length === 0) {
    rows.set('toplam veresiye', { label: 'Toplam Veresiye', total: creditTotal })
  }

  if (rows.size === 0) {
    const fallbackRows = [
      ['Nakit', Number(summary?.payments?.cash || 0)],
      ['Kart', Number(summary?.payments?.card || 0)],
      ['Yemek Karti', Number(summary?.payments?.mealCard || 0)],
      ['Online Odeme', Number(summary?.payments?.online || 0)],
      ['Veresiye', creditTotal]
    ].filter(([, total]) => total > 0)

    for (const [label, total] of fallbackRows) {
      rows.set(String(label).toLocaleLowerCase('tr-TR'), { label: `Toplam ${label}`, total: Number(total || 0) })
    }
  }

  return Array.from(rows.values())
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'tr'))
    .map((row) => [row.label, toMoney(row.total)])
}

const buildInfoRows = (rows: Array<[string, string]>) => rows.map(([label, value]) => `
  <div class="info-row">
    <span>${escapeHtml(label)}</span>
    <strong>${escapeHtml(value)}</strong>
  </div>
`).join('')

const buildTableSection = (title: string, columns: string[], rows: Array<Array<string>>) => `
  <section class="section">
    <div class="section-title">${escapeHtml(title)}</div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rows.length > 0
            ? rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')
            : `<tr><td colspan="${columns.length}" class="empty-cell">Bu bolum icin veri bulunamadi.</td></tr>`}
        </tbody>
      </table>
    </div>
  </section>
`

const buildFallbackText = (report: ZReportData) => {
  const generatedAt = report?.generatedAt ? new Date(report.generatedAt).toLocaleString('tr-TR') : '-'
  return [
    'Z RAPORU',
    String(report?.businessName || 'PenPOS'),
    '------------------------------------------------',
    `Tarih: ${String(report?.date || '-')}`,
    `Sube: ${String(report?.branchName || '-')}`,
    `Olusturma: ${generatedAt}`,
    '------------------------------------------------',
    `Net Toplam Satis: ${Number(report?.summary?.netSales || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`,
    `Yapilan Satis: ${Number(report?.summary?.paidSalesTotal || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`,
    `Veresiye Satis: ${Number(report?.summary?.payments?.credit || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`,
    `Toplam Tahsilat: ${Number(report?.summary?.cashIn?.total || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`,
    `Yapilan Satis Adedi: ${Number(report?.summary?.orderCount || 0).toLocaleString('tr-TR')}`
  ].join('\n')
}

export const buildZReportPrintHtml = (report: ZReportData) => {
  const safeReport = report || ({} as ZReportData)
  const text = getThermalVariant(safeReport, 'chars48')?.text || buildFallbackText(safeReport)
  const titleDate = String(safeReport?.date || 'z-raporu')

  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>Z Raporu - ${escapeHtml(titleDate)}</title>
  <style>
    body { margin: 0; background: #e5e7eb; font-family: Consolas, "Courier New", monospace; color: #111827; }
    .page { min-height: 100vh; display: grid; place-items: start center; padding: 24px; box-sizing: border-box; }
    .receipt { width: 80mm; background: #fff; box-shadow: 0 24px 60px rgba(15, 23, 42, 0.18); border-radius: 12px; padding: 14px 12px 28px; box-sizing: border-box; }
    pre { margin: 0; white-space: pre-wrap; word-break: break-word; font-family: Consolas, "Courier New", monospace; font-size: 12px; line-height: 1.35; }
    @page { size: 80mm auto; margin: 6mm; }
    @media print {
      body { background: #fff; }
      .page { padding: 0; }
      .receipt { width: auto; box-shadow: none; border-radius: 0; padding: 0; }
      pre { font-size: 10.5pt; line-height: 1.28; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="receipt">
      <pre>${escapeHtml(text)}</pre>
    </div>
  </div>
</body>
</html>`
}

export const buildZReportPdfHtml = (report: ZReportData) => {
  const safeReport = report || ({} as ZReportData)
  const generatedAt = safeReport?.generatedAt ? new Date(safeReport.generatedAt).toLocaleString('tr-TR') : '-'
  const payments = safeReport.summary?.payments || { cash: 0, card: 0, mealCard: 0, online: 0, credit: 0 }
  const totalVat = (safeReport.summary?.vatBreakdown || []).reduce((sum, row) => sum + Number(row?.vat || 0), 0)
  const paymentTypeRows = buildPaymentTypeRows(safeReport)
  const soldProductRows = (safeReport.topProducts || []).map((row) => [
    String(row.name || '-'),
    String(row.quantity || 0),
    toMoney(row.total)
  ])
  const vatRows = (safeReport.summary?.vatBreakdown || []).map((row) => [
    `%${row.rate}`,
    toMoney(row.amount),
    toMoney(row.vat)
  ])
  const staffRows = (safeReport.staffTotals || []).map((row) => [
    String(row.staffName || '-'),
    String(row.orderCount || 0),
    toMoney(row.total)
  ])

  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>Z Raporu - ${escapeHtml(String(safeReport?.date || 'z-raporu'))}</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #111827;
      --muted: #6b7280;
      --line: #d7deea;
      --surface: #ffffff;
      --surface-soft: #f6f8fc;
      --accent: #0f172a;
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: #eef2f7; color: var(--ink); font-family: "Segoe UI", Arial, sans-serif; }
    .page-shell { min-height: 100vh; padding: 16px; display: flex; justify-content: center; }
    .page { width: 210mm; min-height: 297mm; background: var(--surface); box-shadow: 0 24px 60px rgba(15, 23, 42, 0.18); padding: 10mm 10mm 8mm; }
    .header { display: flex; justify-content: space-between; gap: 8mm; align-items: flex-start; border-bottom: 2px solid var(--accent); padding-bottom: 4mm; margin-bottom: 5mm; }
    .title-wrap { display: grid; gap: 2mm; }
    .title { font-size: 20pt; line-height: 1.1; font-weight: 800; margin: 0; }
    .business { display: inline-flex; width: fit-content; align-items: center; padding: 1.8mm 3.2mm; border: 1px solid var(--line); border-radius: 999px; font-size: 9pt; font-weight: 700; background: var(--surface-soft); }
    .meta { display: grid; gap: 1mm; min-width: 60mm; font-size: 9pt; }
    .meta-row { display: flex; justify-content: space-between; gap: 4mm; }
    .meta-row span { color: var(--muted); }
    .summary-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 2.5mm; margin-bottom: 4mm; }
    .summary-card { border: 1px solid var(--line); border-radius: 3mm; background: var(--surface-soft); padding: 3mm; min-height: 22mm; }
    .summary-card .label { color: var(--muted); font-size: 8pt; font-weight: 700; margin-bottom: 1.2mm; }
    .summary-card .value { font-size: 14pt; line-height: 1.15; font-weight: 800; }
    .panel { border: 1px solid var(--line); border-radius: 3mm; background: var(--surface); padding: 3mm; margin-bottom: 4mm; }
    .section { margin-bottom: 4mm; }
    .section-title { font-size: 10.5pt; font-weight: 800; margin: 0 0 2mm; }
    .info-list { display: grid; gap: 1.2mm; font-size: 9pt; }
    .info-row { display: flex; justify-content: space-between; gap: 4mm; border-bottom: 1px dashed #e5e7eb; padding-bottom: 0.8mm; }
    .info-row span { color: var(--muted); }
    .info-row strong { text-align: right; }
    .table-wrap { border: 1px solid var(--line); border-radius: 3mm; overflow: hidden; }
    table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
    thead th { background: var(--surface-soft); color: var(--muted); text-align: left; font-weight: 700; padding: 2.2mm 2.4mm; border-bottom: 1px solid var(--line); }
    tbody td { padding: 2mm 2.4mm; border-bottom: 1px solid #edf1f7; vertical-align: top; }
    tbody tr:last-child td { border-bottom: 0; }
    .empty-cell { text-align: center; color: var(--muted); padding: 4mm 3mm; }
    @page { size: A4 portrait; margin: 8mm; }
    @media print {
      body { background: #fff; }
      .page-shell { padding: 0; }
      .page { width: auto; min-height: auto; box-shadow: none; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="page-shell">
    <main class="page">
      <header class="header">
        <div class="title-wrap">
          <h1 class="title">Z Raporu</h1>
          <div class="business">${escapeHtml(String(safeReport.businessName || 'PenPOS'))}</div>
        </div>
        <div class="meta">
          <div class="meta-row"><span>Donem</span><strong>${escapeHtml(String(safeReport.date || '-'))}</strong></div>
          <div class="meta-row"><span>Sube</span><strong>${escapeHtml(String(safeReport.branchName || '-'))}</strong></div>
          <div class="meta-row"><span>Olusturma</span><strong>${escapeHtml(generatedAt)}</strong></div>
        </div>
      </header>

      <section class="summary-grid">
        <div class="summary-card"><div class="label">Net Toplam Satis</div><div class="value">${escapeHtml(toMoney(safeReport.summary?.netSales || 0))}</div></div>
        <div class="summary-card"><div class="label">Yapilan Satis</div><div class="value">${escapeHtml(toMoney(safeReport.summary?.paidSalesTotal || 0))}</div></div>
        <div class="summary-card"><div class="label">Veresiye Satis</div><div class="value">${escapeHtml(toMoney(payments.credit || 0))}</div></div>
        <div class="summary-card"><div class="label">Toplam Tahsilat</div><div class="value">${escapeHtml(toMoney(safeReport.summary?.cashIn?.total || 0))}</div></div>
        <div class="summary-card"><div class="label">Yapilan Satis Adedi</div><div class="value">${escapeHtml(String(safeReport.summary?.orderCount || 0))}</div></div>
      </section>

      <section class="panel">
        <div class="section-title">Ozet Bilgiler</div>
        <div class="info-list">
          ${buildInfoRows([
            ['Toplam urun adedi', String(safeReport.summary?.productCount || 0)],
            ['Toplam satis', toMoney(safeReport.summary?.netSales || 0)],
            ['Indirim', toMoney(safeReport.summary?.discountTotal || 0)],
            ['Kasadaki toplam', toMoney(safeReport.summary?.cashIn?.total || 0)],
            ['Veresiye / cari', toMoney(safeReport.summary?.periodCreditBalance || 0)],
            ['Veresiye tahsilati', toMoney(safeReport.summary?.collectionsTotal || 0)],
            ['Toplam KDV', toMoney(totalVat)]
          ])}
        </div>
      </section>

      ${buildTableSection('Odeme Tipleri', ['Tip', 'Toplam'], paymentTypeRows)}
      ${buildTableSection('KDV Dagilimi', ['Oran', 'Matrah', 'KDV'], vatRows)}
      ${buildTableSection('Personel Satislari', ['Personel', 'Adisyon', 'Toplam'], staffRows)}
      ${buildTableSection('Satilan Urunler', ['Urun', 'Adet', 'Toplam'], soldProductRows)}
    </main>
  </div>
</body>
</html>`
}

export const openZReportPrintPreview = (report: ZReportData, autoPrint = true) => {
  const html = buildZReportPrintHtml(report || ({} as ZReportData))
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank', 'noopener,noreferrer,width=480,height=900')
  if (!win) throw new Error('Yazdirma penceresi acilamadi')
  if (autoPrint) {
    window.setTimeout(() => {
      try {
        win.focus()
        win.print()
      } catch {}
      window.setTimeout(() => URL.revokeObjectURL(url), 15000)
    }, 250)
  } else {
    window.setTimeout(() => URL.revokeObjectURL(url), 15000)
  }
  return win
}

export const openZReportPdfPreview = (report: ZReportData, autoPrint = true) => {
  const html = buildZReportPdfHtml(report || ({} as ZReportData))
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank', 'noopener,noreferrer,width=1100,height=900')
  if (!win) throw new Error('PDF onizleme penceresi acilamadi')
  if (autoPrint) {
    window.setTimeout(() => {
      try {
        win.focus()
        win.print()
      } catch {}
      window.setTimeout(() => URL.revokeObjectURL(url), 15000)
    }, 250)
  } else {
    window.setTimeout(() => URL.revokeObjectURL(url), 15000)
  }
  return win
}

export const printZReport = async (report: ZReportData, options: { system?: string } = {}) => {
  const safeReport = report || ({} as ZReportData)
  const thermal48 = getThermalVariant(safeReport, 'chars48')
  const thermal32 = getThermalVariant(safeReport, 'chars32')
  const system = String(options?.system || 'kermes').trim() || 'kermes'

  try {
    const res = await api('/api/printing/jobs', {
      method: 'POST',
      data: {
        system,
        type: 'receipt',
        payload: {
          type: 'raw',
          content: thermal48?.raw || thermal48?.text || buildFallbackText(safeReport)
        },
        meta: {
          title: 'Z Raporu',
          reportDate: safeReport?.date,
          branchId: safeReport?.branchId,
          rawEncoding: safeReport?.thermal?.encoding || 'cp857',
          thermalVariants: {
            chars48: thermal48 ? { raw: thermal48.raw, text: thermal48.text } : null,
            chars32: thermal32 ? { raw: thermal32.raw, text: thermal32.text } : null
          }
        }
      },
      silent: true,
      skipBranchHeader: true
    })
    if (res?.success) return { mode: 'raw', queuedWithoutStation: res?.queuedWithoutStation === true }
  } catch {
  }

  openZReportPrintPreview(safeReport, true)
  return { mode: 'browser' }
}
