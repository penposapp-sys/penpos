import React, { useEffect, useMemo, useState } from 'react'
import Modal from '../../components/Modal.jsx'
import { api } from '../../lib/apiClient.js'
import { buildBranchQueryParams } from '../../lib/branchQuery.js'
import { useResponsiveFlags } from '../../hooks/useResponsiveFlags.js'
import { useTheme } from '../../theme/ThemeContext.jsx'

const cardStyle = {
  border: '1px solid var(--border-soft, var(--app-border, var(--border)))',
  borderRadius: 18,
  background: 'var(--card-bg)',
  color: 'var(--app-text, var(--text))',
  padding: 16,
  boxShadow: 'var(--shadow-soft)'
}

const money = (value) =>
  `${Number(value || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`

const normalizeApiMessage = (message, fallback) => {
  const raw = String(message || '').trim()
  if (!raw) return fallback
  if (raw === 'network_error') return 'Sunucuya ulasilamadi. Backend servisinin calistigini kontrol edin.'
  return raw
}

const movementOptions = [
  { key: 'all', label: 'Tumu' },
  { key: 'income', label: 'Sadece Gelir' },
  { key: 'expense', label: 'Sadece Gider' }
]

const filterOptions = [
  { key: 'all', label: 'Tumu' },
  { key: 'cash', label: 'Nakit' },
  { key: 'pos', label: 'POS' },
  { key: 'bank', label: 'Banka' },
  { key: 'sales', label: 'Satis Geliri' },
  { key: 'collection', label: 'Cari Tahsilat' },
  { key: 'stock', label: 'Stok Hareketi' }
]

export default function CanteenCashReportModal({
  open,
  onClose,
  branchIds = [],
  initialStart,
  initialEnd
}) {
  const { isMobilePortrait, isTablet } = useResponsiveFlags()
  const { theme } = useTheme()
  const isCompact = isMobilePortrait || isTablet
  const isDark = theme?.darkMode === true
  const [start, setStart] = useState(initialStart || '')
  const [end, setEnd] = useState(initialEnd || '')
  const [movementType, setMovementType] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [report, setReport] = useState(null)

  useEffect(() => {
    if (!open) return
    setStart(initialStart || '')
    setEnd(initialEnd || '')
    setMovementType('all')
    setFilterType('all')
    setError('')
    setReport(null)
  }, [open, initialEnd, initialStart])

  const branchSummary = useMemo(() => {
    const count = Array.isArray(branchIds) ? branchIds.length : 0
    if (count <= 0) return 'Sube secilmedi'
    if (count === 1) return '1 sube secili'
    return `${count} sube secili`
  }, [branchIds])

  const loadReport = async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      params.set('period', 'range')
      params.set('start', String(start || '').trim())
      params.set('end', String(end || '').trim())
      params.set('movementType', movementType)
      params.set('filterType', filterType)
      const branch = buildBranchQueryParams(branchIds)
      if (branch.params) {
        for (const [key, value] of branch.params.entries()) params.set(key, value)
      }
      const res = await api(`/api/canteen/reports/cash?${params.toString()}`, {
        silent: true,
        skipBranchHeader: true,
        suppressBranchModal: true,
        portalOverride: 'canteen'
      })
      if (!res?.ok) throw new Error(normalizeApiMessage(res?.message, 'Kasa raporu alinamadi'))
      setReport(res)
    } catch (err) {
      setReport(null)
      setError(normalizeApiMessage(err?.message, 'Kasa raporu alinamadi'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    if (!start || !end) return
    loadReport()
  }, [open, start, end, movementType, filterType])

  const summaryCardStyles = useMemo(() => ({
    income: {
      background: isDark ? 'rgba(20, 83, 45, 0.38)' : '#cffafe',
      borderColor: isDark ? 'rgba(74, 222, 128, 0.24)' : 'var(--border-soft, var(--app-border, var(--border)))',
      labelColor: isDark ? '#bbf7d0' : '#1e3a8a',
      valueColor: isDark ? '#f8fafc' : 'var(--app-text, var(--text))'
    },
    expense: {
      background: isDark ? 'rgba(127, 29, 29, 0.34)' : '#dbeafe',
      borderColor: isDark ? 'rgba(248, 113, 113, 0.22)' : 'var(--border-soft, var(--app-border, var(--border)))',
      labelColor: isDark ? '#fecaca' : '#1e3a8a',
      valueColor: isDark ? '#f8fafc' : 'var(--app-text, var(--text))'
    },
    total: {
      background: isDark ? 'rgba(30, 41, 59, 0.72)' : '#ccfbf1',
      borderColor: isDark ? 'rgba(148, 163, 184, 0.28)' : 'var(--border-soft, var(--app-border, var(--border)))',
      labelColor: isDark ? '#cbd5e1' : '#1e3a8a',
      valueColor: isDark ? '#f8fafc' : 'var(--app-text, var(--text))'
    }
  }), [isDark])

  const tableHeaderStyle = useMemo(() => ({
    background: isDark ? 'rgba(49, 46, 129, 0.42)' : '#d8d4fe',
    color: isDark ? '#e5e7eb' : '#111827'
  }), [isDark])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Kasa Raporu"
      dialogStyle={{ width: isCompact ? 'calc(100vw - 14px)' : 'min(1180px, calc(100vw - 24px))', maxHeight: isCompact ? 'calc(100vh - 14px)' : 'calc(100vh - 24px)' }}
      bodyStyle={{ display: 'grid', gap: isCompact ? 12 : 16, overflowY: 'auto', padding: isCompact ? 2 : undefined }}
    >
      <div style={{ display: 'grid', gap: isCompact ? 12 : 16 }}>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: isCompact ? 'minmax(0, 1fr)' : 'minmax(220px, 0.95fr) minmax(340px, 1.35fr) minmax(240px, 0.7fr)' }}>
          <section style={{ ...cardStyle, display: 'grid', gap: 10, padding: isCompact ? 12 : 16, borderRadius: isCompact ? 14 : 18 }}>
            <div style={{ fontSize: 15, fontWeight: 900 }}>Tarih Araliklari</div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobilePortrait ? '1fr' : '1fr 1fr', gap: 10 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--app-text-secondary, var(--text-secondary))', fontWeight: 700 }}>Baslangic</span>
                <input className="input" type="date" value={start} onChange={(event) => setStart(event.target.value)} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--app-text-secondary, var(--text-secondary))', fontWeight: 700 }}>Bitis</span>
                <input className="input" type="date" value={end} onChange={(event) => setEnd(event.target.value)} />
              </label>
            </div>
            <div style={{ fontSize: 12, color: 'var(--app-text-muted, var(--muted))' }}>{branchSummary}</div>
          </section>

          <section style={{ ...cardStyle, display: 'grid', gap: 14, padding: isCompact ? 12 : 16, borderRadius: isCompact ? 14 : 18 }}>
            <div style={{ fontSize: 15, fontWeight: 900 }}>Hareket Turu</div>
            <div style={{ display: 'flex', gap: isCompact ? 10 : 18, flexWrap: 'wrap', flexDirection: isMobilePortrait ? 'column' : 'row' }}>
              {movementOptions.map((option) => (
                <label key={option.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                  <input type="radio" name="cash-movement-type" checked={movementType === option.key} onChange={() => setMovementType(option.key)} />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 12, color: isDark ? '#fca5a5' : '#dc2626', fontWeight: 900 }}>Gelir Gider Turu</span>
              <select className="input" value={filterType} onChange={(event) => setFilterType(event.target.value)}>
                {filterOptions.map((option) => (
                  <option key={option.key} value={option.key}>{option.label}</option>
                ))}
              </select>
            </label>
          </section>

          <section style={{ display: 'grid', gap: 10, gridTemplateColumns: isCompact ? 'minmax(0, 1fr)' : undefined }}>
            <div style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: summaryCardStyles.income.background, borderColor: summaryCardStyles.income.borderColor, padding: isCompact ? 12 : 16, borderRadius: isCompact ? 14 : 18 }}>
              <span style={{ fontWeight: 900, color: summaryCardStyles.income.labelColor }}>Gelir</span>
              <strong style={{ fontSize: 20, color: summaryCardStyles.income.valueColor }}>{money(report?.summary?.incomeTotal || 0)}</strong>
            </div>
            <div style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: summaryCardStyles.expense.background, borderColor: summaryCardStyles.expense.borderColor, padding: isCompact ? 12 : 16, borderRadius: isCompact ? 14 : 18 }}>
              <span style={{ fontWeight: 900, color: summaryCardStyles.expense.labelColor }}>Gider</span>
              <strong style={{ fontSize: 20, color: summaryCardStyles.expense.valueColor }}>{money(report?.summary?.expenseTotal || 0)}</strong>
            </div>
            <div style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: summaryCardStyles.total.background, borderColor: summaryCardStyles.total.borderColor, padding: isCompact ? 12 : 16, borderRadius: isCompact ? 14 : 18 }}>
              <span style={{ fontWeight: 900, color: summaryCardStyles.total.labelColor }}>Toplam</span>
              <strong style={{ fontSize: 20, color: summaryCardStyles.total.valueColor }}>{money(report?.summary?.netTotal || 0)}</strong>
            </div>
          </section>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, color: 'var(--app-text-secondary, var(--text-secondary))' }}>
            {loading ? 'Kasa hareketleri yukleniyor...' : `Listelenen kayit sayisi: ${Number(report?.summary?.count || 0)}`}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn" type="button" onClick={loadReport} disabled={loading || !start || !end}>
              {loading ? 'Rapor Aliniyor...' : 'Rapor Al'}
            </button>
            <button className="btn button-light" type="button" onClick={onClose}>Kapat</button>
          </div>
        </div>

        {!!error && (
          <div style={{ ...cardStyle, borderColor: isDark ? 'rgba(248, 113, 113, 0.28)' : '#fecaca', background: isDark ? 'rgba(127, 29, 29, 0.24)' : '#fef2f2', color: isDark ? '#fecaca' : '#7f1d1d' }}>
            {error}
          </div>
        )}

        <div style={{ ...cardStyle, padding: 0, overflow: 'hidden', borderRadius: isCompact ? 14 : 18 }}>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: isCompact ? 860 : 980 }}>
              <thead>
                <tr style={{ background: tableHeaderStyle.background }}>
                  {['Tarih', 'Saat', 'Turu', 'Gelir Gider Sebebi', 'Aciklama', 'Tutar', 'Odeme', 'Barkodu'].map((column) => (
                    <th
                      key={column}
                      style={{
                        padding: '12px 10px',
                        textAlign: 'left',
                        fontSize: 12,
                        borderBottom: '1px solid var(--border-soft, var(--app-border, var(--border)))',
                        color: tableHeaderStyle.color
                      }}
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!loading && Array.isArray(report?.rows) && report.rows.length > 0 ? report.rows.map((row) => (
                  <tr key={row.id}>
                    <td style={{ padding: '11px 10px', borderBottom: '1px solid var(--border-soft, var(--app-border, var(--border)))', whiteSpace: 'nowrap' }}>{row.date || '-'}</td>
                    <td style={{ padding: '11px 10px', borderBottom: '1px solid var(--border-soft, var(--app-border, var(--border)))', whiteSpace: 'nowrap' }}>{row.time || '-'}</td>
                    <td style={{ padding: '11px 10px', borderBottom: '1px solid var(--border-soft, var(--app-border, var(--border)))', color: row.type === 'Gider' ? '#b91c1c' : '#166534', fontWeight: 900, whiteSpace: 'nowrap' }}>{row.type}</td>
                    <td style={{ padding: '11px 10px', borderBottom: '1px solid var(--border-soft, var(--app-border, var(--border)))', whiteSpace: 'nowrap' }}>{row.reason || '-'}</td>
                    <td style={{ padding: '11px 10px', borderBottom: '1px solid var(--border-soft, var(--app-border, var(--border)))', minWidth: 280 }}>{row.description || '-'}</td>
                    <td style={{ padding: '11px 10px', borderBottom: '1px solid var(--border-soft, var(--app-border, var(--border)))', fontWeight: 900, whiteSpace: 'nowrap' }}>{money(row.amount || 0)}</td>
                    <td style={{ padding: '11px 10px', borderBottom: '1px solid var(--border-soft, var(--app-border, var(--border)))', whiteSpace: 'nowrap' }}>{row.methodName || '-'}</td>
                    <td style={{ padding: '11px 10px', borderBottom: '1px solid var(--border-soft, var(--app-border, var(--border)))', whiteSpace: 'nowrap' }}>{row.barcode || '-'}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={8} style={{ padding: '18px 12px', color: 'var(--app-text-muted, var(--muted))' }}>
                      {loading ? 'Rapor hazirlaniyor...' : 'Bu filtreler icin kayit bulunamadi.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Modal>
  )
}
