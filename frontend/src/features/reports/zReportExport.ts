import { downloadBlob } from '../../lib/download.js'
import type { ZReportData } from './zReportApi.ts'
import { buildZReportPrintHtml, openZReportPrintPreview } from './zReportPrint.ts'

const toMoney = (value: unknown) =>
  Number(value || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const escapeHtml = (value: unknown) => String(value || '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')

const buildExcelHtml = (report: ZReportData) => {
  const payments = report.summary?.payments || { cash: 0, card: 0, mealCard: 0, online: 0, credit: 0 }
  const paymentBreakdown = Array.isArray(report.summary?.paymentBreakdown) ? report.summary.paymentBreakdown : []
  const channels = report.summary?.salesChannels || { qr: 0, cashier: 0 }

  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <style>table{border-collapse:collapse}th,td{border:1px solid #cbd5e1;padding:6px 8px}th{background:#f8fafc}</style>
</head>
<body>
  <table>
    <tr><th colspan="4">Z Raporu</th></tr>
    <tr><td>Isletme</td><td>${escapeHtml(report.businessName)}</td><td>Tarih</td><td>${escapeHtml(report.date)}</td></tr>
    <tr><td>Sube</td><td>${escapeHtml(report.branchName)}</td><td>Olusturma</td><td>${escapeHtml(new Date(report.generatedAt).toLocaleString('tr-TR'))}</td></tr>
  </table>
  <br />
  <table>
    <tr><th>Alan</th><th>Deger</th></tr>
    <tr><td>Toplam adisyon</td><td>${report.summary?.orderCount || 0}</td></tr>
    <tr><td>Toplam urun adedi</td><td>${report.summary?.productCount || 0}</td></tr>
    <tr><td>Brut satis</td><td>${toMoney(report.summary?.grossSales || 0)}</td></tr>
    <tr><td>Indirim toplami</td><td>${toMoney(report.summary?.discountTotal || 0)}</td></tr>
    <tr><td>Iptal/iade toplami</td><td>${toMoney(report.summary?.cancelTotal || 0)}</td></tr>
    <tr><td>Net satis</td><td>${toMoney(report.summary?.netSales || 0)}</td></tr>
    ${(paymentBreakdown.length > 0
      ? paymentBreakdown.map((row) => `<tr><td>${escapeHtml(row.methodName)}</td><td>${toMoney(row.totalAmount)}</td></tr>`).join('')
      : `
    <tr><td>Nakit</td><td>${toMoney(payments.cash)}</td></tr>
    <tr><td>Kredi karti</td><td>${toMoney(payments.card)}</td></tr>
    <tr><td>Yemek karti</td><td>${toMoney(payments.mealCard)}</td></tr>
    <tr><td>Online odeme</td><td>${toMoney(payments.online)}</td></tr>
    <tr><td>Veresiye/cari</td><td>${toMoney(payments.credit)}</td></tr>`)}
    <tr><td>QR siparis</td><td>${toMoney(channels.qr)}</td></tr>
    <tr><td>Kasa satis</td><td>${toMoney(channels.cashier)}</td></tr>
  </table>
  <br />
  <table>
    <tr><th colspan="3">KDV Dagilimi</th></tr>
    <tr><th>Oran</th><th>Matrah</th><th>KDV</th></tr>
    ${(report.summary?.vatBreakdown || []).map((row) => `<tr><td>%${row.rate}</td><td>${toMoney(row.amount)}</td><td>${toMoney(row.vat)}</td></tr>`).join('')}
  </table>
  <br />
  <table>
    <tr><th colspan="3">Personel Satislari</th></tr>
    <tr><th>Personel</th><th>Adisyon</th><th>Toplam</th></tr>
    ${(report.staffTotals || []).map((row) => `<tr><td>${escapeHtml(row.staffName)}</td><td>${row.orderCount}</td><td>${toMoney(row.total)}</td></tr>`).join('')}
  </table>
  <br />
  <table>
    <tr><th colspan="3">Sube Kirilimi</th></tr>
    <tr><th>Sube</th><th>Adisyon</th><th>Net Satis</th></tr>
    ${(report.branchTotals || []).map((row) => `<tr><td>${escapeHtml(row.branchName)}</td><td>${row.orderCount}</td><td>${toMoney(row.netSales)}</td></tr>`).join('')}
  </table>
</body>
</html>`
}

export const downloadZReportExcel = (report: ZReportData) => {
  const blob = new Blob(['\ufeff', buildExcelHtml(report)], {
    type: 'application/vnd.ms-excel;charset=utf-8;'
  })
  downloadBlob(blob, `z-raporu-${report.date}-${report.branchId || 'all'}.xls`)
}

export const downloadZReportPdf = (report: ZReportData) => openZReportPrintPreview(report, true)

export const downloadZReportHtmlPreview = (report: ZReportData) => {
  const blob = new Blob([buildZReportPrintHtml(report)], { type: 'text/html;charset=utf-8' })
  downloadBlob(blob, `z-raporu-${report.date}.html`)
}
