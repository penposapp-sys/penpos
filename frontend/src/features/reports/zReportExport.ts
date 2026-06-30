import { downloadBlob } from '../../lib/download.js'
import type { ZReportData } from './zReportApi.ts'
import { buildZReportPdfHtml, openZReportPdfPreview } from './zReportPrint.ts'

const toMoney = (value: unknown) =>
  Number(value || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const escapeHtml = (value: unknown) => String(value || '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')

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

const buildExcelHtml = (report: ZReportData) => {
  const safeReport = report || ({} as ZReportData)
  const cashInBreakdown = Array.isArray(safeReport.summary?.cashInBreakdown) ? safeReport.summary.cashInBreakdown : []
  const paymentRows = cashInBreakdown.map((row) => ({
    label: `Toplam ${normalizeLabel(row.methodName)}`,
    total: Number(row.totalAmount || 0)
  }))
  const creditTotal = Number(safeReport.summary?.payments?.credit || 0)
  if (creditTotal > 0) paymentRows.push({ label: 'Toplam Veresiye', total: creditTotal })

  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <style>table{border-collapse:collapse}th,td{border:1px solid #cbd5e1;padding:6px 8px}th{background:#f8fafc}</style>
</head>
<body>
  <table>
    <tr><th colspan="4">Z Raporu</th></tr>
    <tr><td>Isletme</td><td>${escapeHtml(safeReport.businessName)}</td><td>Tarih</td><td>${escapeHtml(safeReport.date)}</td></tr>
    <tr><td>Sube</td><td>${escapeHtml(safeReport.branchName)}</td><td>Olusturma</td><td>${escapeHtml(safeReport.generatedAt ? new Date(safeReport.generatedAt).toLocaleString('tr-TR') : '-')}</td></tr>
  </table>
  <br />
  <table>
    <tr><th>Alan</th><th>Deger</th></tr>
    <tr><td>Net toplam satis</td><td>${toMoney(safeReport.summary?.netSales || 0)}</td></tr>
    <tr><td>Yapilan satis</td><td>${toMoney(safeReport.summary?.paidSalesTotal || 0)}</td></tr>
    <tr><td>Veresiye satis</td><td>${toMoney(safeReport.summary?.payments?.credit || 0)}</td></tr>
    <tr><td>Toplam tahsilat</td><td>${toMoney(safeReport.summary?.cashIn?.total || 0)}</td></tr>
    <tr><td>Yapilan satis adedi</td><td>${safeReport.summary?.orderCount || 0}</td></tr>
    <tr><td>Toplam urun adedi</td><td>${safeReport.summary?.productCount || 0}</td></tr>
    <tr><td>Toplam satis</td><td>${toMoney(safeReport.summary?.netSales || 0)}</td></tr>
    <tr><td>Indirim</td><td>${toMoney(safeReport.summary?.discountTotal || 0)}</td></tr>
    <tr><td>Kasadaki toplam</td><td>${toMoney(safeReport.summary?.cashIn?.total || 0)}</td></tr>
    <tr><td>Veresiye / cari</td><td>${toMoney(safeReport.summary?.periodCreditBalance || 0)}</td></tr>
    <tr><td>Veresiye tahsilati</td><td>${toMoney(safeReport.summary?.collectionsTotal || 0)}</td></tr>
  </table>
  <br />
  <table>
    <tr><th colspan="2">Odeme Tipleri</th></tr>
    ${paymentRows.map((row) => `<tr><td>${escapeHtml(row.label)}</td><td>${toMoney(row.total)}</td></tr>`).join('')}
  </table>
  <br />
  <table>
    <tr><th colspan="3">Satilan Urunler</th></tr>
    <tr><th>Urun</th><th>Adet</th><th>Toplam</th></tr>
    ${(safeReport.topProducts || []).map((row) => `<tr><td>${escapeHtml(row.name)}</td><td>${row.quantity}</td><td>${toMoney(row.total)}</td></tr>`).join('')}
  </table>
</body>
</html>`
}

export const downloadZReportExcel = (report: ZReportData) => {
  const safeReport = report || ({} as ZReportData)
  const blob = new Blob(['\ufeff', buildExcelHtml(report)], {
    type: 'application/vnd.ms-excel;charset=utf-8;'
  })
  downloadBlob(blob, `z-raporu-${String(safeReport?.date || 'tarih-yok')}-${String(safeReport?.branchId || 'all')}.xls`)
}

export const downloadZReportPdf = (report: ZReportData) => openZReportPdfPreview(report, true)

export const downloadZReportHtmlPreview = (report: ZReportData) => {
  const safeReport = report || ({} as ZReportData)
  const blob = new Blob([buildZReportPdfHtml(safeReport)], { type: 'text/html;charset=utf-8' })
  downloadBlob(blob, `z-raporu-${String(safeReport?.date || 'tarih-yok')}.html`)
}
