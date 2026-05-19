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

const buildFallbackText = (report: ZReportData) => {
  const generatedAt = report?.generatedAt ? new Date(report.generatedAt).toLocaleString('tr-TR') : '-'
  return [
    'Z RAPORU',
    String(report?.businessName || 'PenPOS'),
    '------------------------------------------------',
    `Tarih: ${String(report?.date || '-')}`,
    `Şube: ${String(report?.branchName || '-')}`,
    `Oluşturma: ${generatedAt}`,
    '------------------------------------------------',
    `Net Satış: ${Number(report?.summary?.netSales || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`
  ].join('\n')
}

export const buildZReportPrintHtml = (report: ZReportData) => {
  const text = getThermalVariant(report, 'chars48')?.text || buildFallbackText(report)

  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>Z Raporu - ${escapeHtml(report.date)}</title>
  <style>
    body { margin: 0; background: #e5e7eb; font-family: Consolas, "Courier New", monospace; color: #111827; }
    .page { min-height: 100vh; display: grid; place-items: start center; padding: 24px; box-sizing: border-box; }
    .receipt {
      width: 80mm;
      background: #fff;
      box-shadow: 0 24px 60px rgba(15, 23, 42, 0.18);
      border-radius: 12px;
      padding: 14px 12px 28px;
      box-sizing: border-box;
    }
    pre {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
      font-family: Consolas, "Courier New", monospace;
      font-size: 12px;
      line-height: 1.35;
    }
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

export const openZReportPrintPreview = (report: ZReportData, autoPrint = true) => {
  const html = buildZReportPrintHtml(report)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank', 'noopener,noreferrer,width=480,height=900')
  if (!win) throw new Error('Yazdırma penceresi açılamadı')
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
  const thermal48 = getThermalVariant(report, 'chars48')
  const thermal32 = getThermalVariant(report, 'chars32')
  const system = String(options?.system || 'kermes').trim() || 'kermes'

  try {
    const res = await api('/api/printing/jobs', {
      method: 'POST',
      data: {
        system,
        type: 'receipt',
        payload: {
          type: 'raw',
          content: thermal48?.raw || thermal48?.text || buildFallbackText(report)
        },
        meta: {
          title: 'Z Raporu',
          reportDate: report.date,
          branchId: report.branchId,
          rawEncoding: report?.thermal?.encoding || 'cp857',
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

  openZReportPrintPreview(report, true)
  return { mode: 'browser' }
}
