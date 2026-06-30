import React, { useMemo, useState } from 'react'
import type { ZReportData } from './zReportApi.ts'
import { printZReport } from './zReportPrint.ts'
import { downloadZReportExcel, downloadZReportPdf } from './zReportExport.ts'

const money = (value: unknown) =>
  `${Number(value || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`

const paymentLabel = (value: unknown) => {
  const key = String(value || '').trim().toLocaleLowerCase('tr-TR')
  if (!key) return '-'
  if (['account', 'credit', 'veresiye', 'cari'].includes(key)) return 'Veresiye / Cari'
  if (['cash', 'nakit'].includes(key)) return 'Nakit'
  if (['card', 'kart', 'pos'].includes(key)) return 'Kart'
  if (['bank', 'banka', 'eft', 'havale'].includes(key)) return 'Banka'
  if (['online', 'online odeme', 'online ödeme'].includes(key)) return 'Online Ödeme'
  if (['mealcard', 'meal_card', 'yemek karti', 'yemek kartı'].includes(key)) return 'Yemek Kartı'
  return String(value || '-')
}

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--border-soft, var(--app-border, var(--border)))',
  borderRadius: 20,
  background: 'var(--card-bg)',
  color: 'var(--app-text, var(--text))',
  backdropFilter: 'var(--glass-blur)',
  boxShadow: 'var(--shadow-soft), var(--shadow-glow)',
  padding: 16
}

function TableBlock({ title, columns, rows }: { title: string, columns: string[], rows: React.ReactNode[][] }) {
  return (
    <section style={{ display: 'grid', gap: 10 }}>
      <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--app-text, var(--text))' }}>{title}</div>
      <div
        style={{
          border: '1px solid var(--border-soft, var(--app-border, var(--border)))',
          borderRadius: 18,
          overflow: 'hidden',
          overflowX: 'auto',
          background: 'var(--card-bg)',
          backdropFilter: 'var(--glass-blur)',
          boxShadow: 'var(--shadow-soft), var(--shadow-glow)'
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 }}>
          <thead>
            <tr style={{ background: 'color-mix(in srgb, var(--app-surface-soft, var(--panelElevated)) 72%, transparent)' }}>
              {columns.map((column) => (
                <th
                  key={column}
                  style={{
                    padding: '12px 14px',
                    textAlign: 'left',
                    fontSize: 12,
                    color: 'var(--app-text-secondary, var(--text-secondary))',
                    borderBottom: '1px solid var(--border-soft, var(--app-border, var(--border)))'
                  }}
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? rows.map((row, rowIndex) => (
              <tr key={`${title}-${rowIndex}`}>
                {row.map((cell, cellIndex) => (
                  <td
                    key={`${title}-${rowIndex}-${cellIndex}`}
                    style={{
                      padding: '12px 14px',
                      borderBottom: '1px solid var(--border-soft, var(--app-border, var(--border)))',
                      fontSize: 13,
                      color: 'var(--app-text, var(--text))'
                    }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            )) : (
              <tr>
                <td colSpan={columns.length} style={{ padding: '16px 14px', color: 'var(--app-text-muted, var(--muted))' }}>
                  Bu bölüm için veri bulunamadı.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default function ZReportModal({
  open,
  report,
  loading = false,
  error = '',
  onClose,
  printSystem = 'kermes'
}: {
  open: boolean
  report: ZReportData | null
  loading?: boolean
  error?: string
  onClose: () => void
  printSystem?: string
}) {
  const [busyAction, setBusyAction] = useState('')

  const paymentBreakdown = Array.isArray(report?.summary?.paymentBreakdown) ? report.summary.paymentBreakdown : []
  const collectionBreakdown = Array.isArray(report?.summary?.collectionBreakdown) ? report.summary.collectionBreakdown : []

  const summaryCards = useMemo(() => {
    if (!report) return []
    return [
      { label: 'Net Satış', value: money(report.summary?.netSales || 0) },
      { label: 'Nakit Satış', value: money(report.summary?.payments?.cash || 0) },
      { label: 'Veresiye Satış', value: money(report.summary?.payments?.credit || 0) },
      { label: 'Veresiye Tahsilatı', value: money(report.summary?.collectionsTotal || 0) },
      { label: 'Adisyon', value: String(report.summary?.orderCount || 0) },
      { label: 'İndirim', value: money(report.summary?.discountTotal || 0) }
    ]
  }, [report])

  if (!open) return null

  const payments = report?.summary?.payments || { cash: 0, card: 0, mealCard: 0, online: 0, credit: 0 }
  const channels = report?.summary?.salesChannels || { qr: 0, cashier: 0 }
  const totalVat = (report?.summary?.vatBreakdown || []).reduce((sum, row) => sum + Number(row?.vat || 0), 0)

  const runAction = async (name: string, action: () => Promise<unknown> | unknown) => {
    setBusyAction(name)
    try {
      await action()
    } finally {
      setBusyAction('')
    }
  }

  const paymentRows = [
    ['Net Satış', money(report?.summary?.netSales || 0)],
    ['Nakit Satış', money(payments.cash)],
    ['Veresiye Satış', money(payments.credit)],
    ...paymentBreakdown
      .filter((row) => {
        const key = String(row?.methodName || '').trim().toLocaleLowerCase('tr-TR')
        return key !== 'nakit' && key !== 'veresiye / cari'
      })
      .map((row) => [paymentLabel(row.methodName), money(row.totalAmount)] as React.ReactNode[]),
    ...(Number(report?.summary?.collectionsTotal || 0) > 0 ? [['Veresiye Tahsilatı', money(report?.summary?.collectionsTotal || 0)] as React.ReactNode[]] : []),
    ...collectionBreakdown.map((row) => [`${paymentLabel(row.methodName)} (Tahsilat)`, money(row.totalAmount)] as React.ReactNode[]),
    ...(Number(report?.summary?.discountTotal || 0) > 0 ? [['İndirim', money(report?.summary?.discountTotal || 0)] as React.ReactNode[]] : [])
  ]

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 120,
        background: 'var(--modal-backdrop)',
        backdropFilter: 'blur(18px)',
        padding: 16,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        overflowY: 'auto',
        overflowX: 'hidden',
        overscrollBehavior: 'contain',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 'min(1180px, 100%)',
          maxHeight: 'calc(100vh - 32px)',
          margin: 'auto 0',
          overflowY: 'auto',
          overflowX: 'hidden',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          borderRadius: 32,
          border: '1px solid var(--border-soft, var(--app-border, var(--border)))',
          background: 'var(--panel-shell-bg, var(--card-bg))',
          color: 'var(--app-text, var(--text))',
          backdropFilter: 'var(--glass-blur)',
          boxShadow: 'var(--shadow-soft), var(--shadow-glow)',
          padding: 22,
          display: 'grid',
          gap: 18
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--app-text, var(--text))' }}>Z Raporu</div>
              {!!report?.businessName && (
                <span
                  style={{
                    borderRadius: 999,
                    background: 'var(--app-surface, #ffffff)',
                    border: '1px solid var(--border-soft, var(--app-border, var(--border)))',
                    color: 'var(--app-text, var(--text))',
                    padding: '6px 10px',
                    fontSize: 12,
                    fontWeight: 800
                  }}
                >
                  {report.businessName}
                </span>
              )}
            </div>
            <div style={{ color: 'var(--app-text-secondary, var(--text-secondary))', fontSize: 14 }}>
              Tarih: {report?.date || '-'} · Şube: {report?.branchName || '-'} · Oluşturma: {report?.generatedAt ? new Date(report.generatedAt).toLocaleString('tr-TR') : '-'}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => runAction('print', async () => report && printZReport(report, { system: printSystem }))} disabled={!report || loading || !!busyAction}>
              {busyAction === 'print' ? 'Hazırlanıyor...' : 'Yazdır'}
            </button>
            <button className="btn" onClick={() => runAction('pdf', async () => report && downloadZReportPdf(report))} disabled={!report || loading || !!busyAction}>
              {busyAction === 'pdf' ? 'Hazırlanıyor...' : 'PDF İndir'}
            </button>
            <button className="btn" onClick={() => runAction('excel', async () => report && downloadZReportExcel(report))} disabled={!report || loading || !!busyAction}>
              {busyAction === 'excel' ? 'Hazırlanıyor...' : 'Excel İndir'}
            </button>
            <button className="btn" onClick={onClose}>Kapat</button>
          </div>
        </div>

        {loading && <div style={cardStyle}>Z raporu hazırlanıyor...</div>}
        {!loading && !!error && (
          <div
            style={{
              ...cardStyle,
              background: 'color-mix(in srgb, var(--danger) 16%, var(--app-surface, var(--panel)))',
              borderColor: 'color-mix(in srgb, var(--danger) 36%, var(--border-soft, var(--app-border, var(--border))))',
              color: 'var(--danger)'
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && report && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
              {summaryCards.map((card) => (
                <div key={card.label} style={cardStyle}>
                  <div style={{ color: 'var(--app-text-secondary, var(--text-secondary))', fontSize: 12, fontWeight: 700 }}>{card.label}</div>
                  <div style={{ marginTop: 8, fontSize: 24, fontWeight: 900, color: 'var(--app-text, var(--text))' }}>{card.value}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
              <div style={cardStyle}>
                <div style={{ fontWeight: 900, color: 'var(--app-text, var(--text))' }}>Özet Bilgiler</div>
                <div style={{ marginTop: 10, display: 'grid', gap: 8, fontSize: 13, color: 'var(--app-text-secondary, var(--text-secondary))' }}>
                  <div>Toplam ürün adedi: <strong>{report.summary?.productCount || 0}</strong></div>
                  <div>Brüt satış: <strong>{money(report.summary?.grossSales || 0)}</strong></div>
                  <div>İndirim: <strong>{money(report.summary?.discountTotal || 0)}</strong></div>
                  <div>İptal / iade: <strong>{money(report.summary?.cancelTotal || 0)}</strong></div>
                  <div>Veresiye / cari: <strong>{money(payments.credit || 0)}</strong></div>
                  <div>Veresiye tahsilatı: <strong>{money(report.summary?.collectionsTotal || 0)}</strong></div>
                  <div>Toplam KDV: <strong>{money(totalVat)}</strong></div>
                </div>
              </div>
              <div style={cardStyle}>
                <div style={{ fontWeight: 900, color: 'var(--app-text, var(--text))' }}>Şube Toplamı</div>
                <div style={{ marginTop: 10, display: 'grid', gap: 8, fontSize: 13, color: 'var(--app-text-secondary, var(--text-secondary))' }}>
                  {(report.branchTotals || []).map((branch) => (
                    <div key={branch.branchName} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <span>{branch.branchName}</span>
                      <strong>{money(branch.netSales)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <TableBlock title="Ödeme Tipleri" columns={['Tip', 'Toplam']} rows={paymentRows} />

            <TableBlock
              title="Satış Kanalları"
              columns={['Kanal', 'Toplam']}
              rows={[
                ['QR Sipariş', money(channels.qr)],
                ['Kasa', money(channels.cashier)]
              ]}
            />

            <TableBlock
              title="KDV Dağılımı"
              columns={['Oran', 'Matrah', 'KDV']}
              rows={(report.summary?.vatBreakdown || []).map((row) => [`%${row.rate}`, money(row.amount), money(row.vat)])}
            />

            <TableBlock
              title="En Çok Satan Ürünler"
              columns={['Ürün', 'Adet', 'Toplam']}
              rows={(report.topProducts || []).map((row) => [row.name, String(row.quantity), money(row.total)])}
            />

            <TableBlock
              title="Personel Satışları"
              columns={['Personel', 'Adisyon', 'Toplam']}
              rows={(report.staffTotals || []).map((row) => [row.staffName, String(row.orderCount), money(row.total)])}
            />

            <TableBlock
              title="Şube Kırılımı"
              columns={['Şube', 'Adisyon', 'Net Satış']}
              rows={(report.branchTotals || []).map((row) => [row.branchName, String(row.orderCount), money(row.netSales)])}
            />
          </>
        )}
      </div>
    </div>
  )
}
