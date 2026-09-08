import React, { useState, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useAnaokuluData } from '../context/AnaokuluDataContext.jsx'
import { money, trDate, getStudent, round2, isCollectionInvoiced } from '../utils/calculations.js'

/* ─── Helpers ─────────────────────────────────────────────── */
const todayStr = () => new Date().toISOString().slice(0, 10)

const PAYMENT_TYPES = ['Nakit', 'Havale/EFT', 'Kredi Kartı', 'Diğer']

/* ─── Style tokens ────────────────────────────────────────── */
const S = {
  btn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 14px', borderRadius: 10, fontWeight: 600,
    cursor: 'pointer', border: 'none', fontSize: 13
  },
  input: {
    padding: '9px 12px', borderRadius: 10,
    border: '1px solid #cbd5e1', background: '#fff',
    fontSize: 13, outline: 'none'
  },
  panel: {
    background: '#fff', borderRadius: 14, border: '1px solid #e6ebf3',
    boxShadow: '0 1px 2px rgba(15,23,42,0.04)', overflow: 'hidden'
  },
  th: {
    padding: '11px 14px', fontSize: 12, fontWeight: 700, color: '#475569',
    background: '#f8fafc', borderBottom: '1px solid #e6ebf3', textAlign: 'left',
    whiteSpace: 'nowrap'
  },
  td: {
    padding: '11px 14px', fontSize: 13, borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle'
  },
  miniBox: {
    padding: '14px 18px', borderRadius: 12,
    background: 'linear-gradient(135deg,#f8fafc,#fff)',
    border: '1px solid #e2e8f0'
  }
}

/* ─── Export: CSV ─────────────────────────────────────────── */
function exportCSV(rows, state, isAdminPanelMode) {
  const header = ['Tarih', ...(isAdminPanelMode ? ['Okul'] : []), 'Öğrenci', 'Sınıf', 'Kalem', 'Ödeme Türü', 'Tutar (₺)', 'KDV (₺)', 'Net (₺)', 'Fatura No', 'Açıklama']
  const lines = [header.join(';')]
  rows.forEach(c => {
    const s = getStudent(state, c.studentId)
    const invoiced = isCollectionInvoiced(state, c, s)
    const vat = invoiced ? (c.vat || 0) : 0
    lines.push([
      c.date || '',
      ...(isAdminPanelMode ? [s?._schoolName || c._schoolName || '-'] : []),
      s?.name || '-',
      s?.class || '-',
      c.item || '-',
      c.payment || '-',
      String((c.amount || 0).toFixed(2)).replace('.', ','),
      invoiced ? String(vat.toFixed(2)).replace('.', ',') : '-',
      String(round2((c.amount || 0) - vat).toFixed(2)).replace('.', ','),
      invoiced ? (c.invoiceNo || '') : '',
      (c.note || '').replace(/;/g, ' ')
    ].join(';'))
  })
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `tahsilatlar_${todayStr()}.csv`; a.click()
  URL.revokeObjectURL(url)
}

/* ─── Export: PDF / Print ─────────────────────────────────── */
function exportPDF(rows, state, totals, dateFrom, dateTo, isAdminPanelMode) {
  const range = (dateFrom || dateTo) ? `${dateFrom || '—'} → ${dateTo || '—'}` : 'Tüm Tarihler'
  const trRows = rows.map(c => {
    const s = getStudent(state, c.studentId)
    const invoiced = isCollectionInvoiced(state, c, s)
    const vat = invoiced ? (c.vat || 0) : 0
    const schoolCell = isAdminPanelMode ? `<td>${s?._schoolName || c._schoolName || '-'}</td>` : ''
    return `<tr>
      <td>${c.date || ''}</td>${schoolCell}<td>${s?.name || '-'}</td><td>${c.item || '-'}</td>
      <td>${c.payment || '-'}</td>
      <td style="text-align:right">${money(c.amount)}</td>
      <td style="text-align:right">${invoiced ? money(vat) : '—'}</td>
      <td>${invoiced ? (c.invoiceNo || '') : '—'}</td><td>${c.note || ''}</td>
    </tr>`
  }).join('')

  const html = `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"/>
<title>Tahsilat Raporu</title>
<style>
  body{font-family:Arial,sans-serif;font-size:12px;color:#0f172a;margin:24px}
  h1{font-size:18px;margin-bottom:4px}.sub{color:#64748b;font-size:12px;margin-bottom:16px}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  th{background:#f1f5f9;padding:8px 10px;text-align:left;font-size:11px;border-bottom:2px solid #e2e8f0}
  td{padding:7px 10px;border-bottom:1px solid #f1f5f9}
  .summary{display:flex;gap:20px;margin-bottom:16px;flex-wrap:wrap}
  .sbox{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 16px}
  .sbox-label{font-size:10px;color:#64748b;font-weight:700}.sbox-val{font-size:15px;font-weight:800}
</style></head><body>
<h1>📊 Tahsilat Raporu</h1>
<div class="sub">Tarih Aralığı: ${range} · Oluşturulma: ${new Date().toLocaleString('tr-TR')}</div>
<div class="summary">
  <div class="sbox"><div class="sbox-label">KAYIT SAYISI</div><div class="sbox-val">${totals.count}</div></div>
  <div class="sbox"><div class="sbox-label">BRÜT TUTAR</div><div class="sbox-val">${money(totals.total)}</div></div>
  <div class="sbox"><div class="sbox-label">KDV</div><div class="sbox-val">${money(totals.vat)}</div></div>
  <div class="sbox"><div class="sbox-label">KDV HARİÇ NET</div><div class="sbox-val">${money(totals.net)}</div></div>
</div>
<table><thead><tr>
  <th>Tarih</th>${isAdminPanelMode ? '<th>Okul</th>' : ''}<th>Öğrenci</th><th>Kalem</th><th>Ödeme</th>
  <th style="text-align:right">Tutar</th><th style="text-align:right">KDV</th>
  <th>Fatura No</th><th>Açıklama</th>
</tr></thead><tbody>${trRows}</tbody></table>
</body></html>`

  const win = window.open('', '_blank')
  win.document.write(html); win.document.close(); win.focus()
  setTimeout(() => win.print(), 400)
}

/* ─── Page ────────────────────────────────────────────────── */
export default function TahsilatlarPage() {
  const { isAdminPanelMode, accessibleTenants } = useAuth()
  const { state } = useAnaokuluData()
  const collections = state?.collections || []

  // Varsayılan: bugün → bugün
  const [selectedSchoolId, setSelectedSchoolId] = useState('')
  const [dateFrom, setDateFrom] = useState(todayStr())
  const [dateTo, setDateTo] = useState(todayStr())
  const [q, setQ] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const filtered = useMemo(() => {
    const needle = q.toLowerCase()
    return collections.filter(c => {
      const s = getStudent(state, c.studentId)
      const hitSchool = !selectedSchoolId || (s?._schoolId === selectedSchoolId) || (c._schoolId === selectedSchoolId)
      const hitSearch = ((s?.name || '') + ' ' + (s?._schoolName || '') + ' ' + (c._schoolName || '')).toLowerCase().includes(needle)
      const hitType = !typeFilter || c.payment === typeFilter
      const hitFrom = !dateFrom || (c.date || '') >= dateFrom
      const hitTo = !dateTo || (c.date || '') <= dateTo
      return hitSchool && hitSearch && hitType && hitFrom && hitTo
    }).sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  }, [collections, q, typeFilter, dateFrom, dateTo, selectedSchoolId, state]) // eslint-disable-line

  const totals = useMemo(() => {
    const total = filtered.reduce((a, c) => a + (c.amount || 0), 0)
    const vat = filtered.reduce((a, c) => {
      const s = getStudent(state, c.studentId)
      const invoiced = isCollectionInvoiced(state, c, s)
      return a + (invoiced ? (c.vat || 0) : 0)
    }, 0)
    return { count: filtered.length, total: round2(total), vat: round2(vat), net: round2(total - vat) }
  }, [filtered, state])

  const payBadge = (type) => {
    const map = { 'Nakit': ['#dcfce7', '#15803d'], 'Havale/EFT': ['#dbeafe', '#1d4ed8'], 'Kredi Kartı': ['#ede9fe', '#6d28d9'], 'Diğer': ['#f1f5f9', '#475569'] }
    const [bg, color] = map[type] || ['#f1f5f9', '#475569']
    return { display: 'inline-block', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: bg, color }
  }

  const canExport = filtered.length > 0

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div className="ak-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: 24, color: '#0f172a' }}>📊 Tahsilat Raporu</h2>
          <p style={{ margin: 0, color: '#475569', fontSize: 13 }}>
            {isAdminPanelMode
              ? `Süper Admin Paneli · Tüm Okullar · ${collections.length} toplam kayıt · ${filtered.length} listeleniyor`
              : `Yalnızca görüntüleme · ${collections.length} toplam kayıt`}
          </p>
        </div>

        <div className="ak-actions" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => exportCSV(filtered, state, isAdminPanelMode)}
            disabled={!canExport}
            style={{
              ...S.btn,
              background: canExport ? 'linear-gradient(135deg,#10b981,#059669)' : '#f1f5f9',
              color: canExport ? '#fff' : '#94a3b8',
              boxShadow: canExport ? '0 4px 12px rgba(16,185,129,0.25)' : 'none',
              cursor: canExport ? 'pointer' : 'not-allowed'
            }}>
            ⬇ Excel (CSV)
          </button>
          <button
            onClick={() => exportPDF(filtered, state, totals, dateFrom, dateTo, isAdminPanelMode)}
            disabled={!canExport}
            style={{
              ...S.btn,
              background: canExport ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : '#f1f5f9',
              color: canExport ? '#fff' : '#94a3b8',
              boxShadow: canExport ? '0 4px 12px rgba(99,102,241,0.25)' : 'none',
              cursor: canExport ? 'pointer' : 'not-allowed'
            }}>
            🖨 PDF / Yazdır
          </button>
        </div>
      </div>

      {isAdminPanelMode && (
        <div style={{
          padding: '12px 16px', borderRadius: 12, marginBottom: 14,
          background: 'rgba(16,185,129,0.06)',
          border: '1px solid rgba(16,185,129,0.2)',
          display: 'flex', alignItems: 'center', gap: 10
        }}>
          <span style={{ fontSize: 18 }}>🏢</span>
          <div style={{ fontSize: 12, color: '#065f46', fontWeight: 600 }}>
            Süper Admin Paneli modundasınız. Bu sayfada tüm okulların tahsilatları birleştirilerek listelenir.
            Aşağıdaki filtreyi kullanarak belirli bir okulun tahsilatlarını da görüntüleyebilirsiniz.
          </div>
        </div>
      )}

      {/* ── Summary cards ── */}
      <div className="ak-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 18 }}>
        <div style={S.miniBox}>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Kayıt Sayısı</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>{totals.count}</div>
        </div>
        <div style={S.miniBox}>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Brüt Tutar</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#6366f1' }}>{money(totals.total)}</div>
        </div>
        <div style={S.miniBox}>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>KDV Tutarı</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#f59e0b' }}>{money(totals.vat)}</div>
        </div>
        <div style={S.miniBox}>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>KDV Hariç Net</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#10b981' }}>{money(totals.net)}</div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="ak-panel ak-filter-bar" style={{
        ...S.panel, marginBottom: 18, padding: '14px 18px',
        display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center'
      }}>
        {/* School selector for superadmin */}
        {(isAdminPanelMode || (accessibleTenants && accessibleTenants.length > 0)) && (
          <select
            style={{ ...S.input, minWidth: 160, fontWeight: 600, background: '#f8fafc' }}
            value={selectedSchoolId}
            onChange={e => setSelectedSchoolId(e.target.value)}
          >
            <option value="">🏫 Tüm Okullar ({accessibleTenants?.length || 'Tümü'})</option>
            {accessibleTenants?.map(t => (
              <option key={t.id || t._id} value={t.id || t._id}>🏫 {t.name}</option>
            ))}
          </select>
        )}

        {/* Date range */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#475569', fontWeight: 700 }}>📅 Tarih:</span>
          <input type="date" style={S.input} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <span style={{ color: '#94a3b8', fontWeight: 600 }}>→</span>
          <input type="date" style={S.input} value={dateTo} onChange={e => setDateTo(e.target.value)} />
          <button
            onClick={() => { setDateFrom(todayStr()); setDateTo(todayStr()) }}
            style={{ ...S.btn, background: '#e0e7ff', color: '#4338ca', padding: '7px 12px', fontSize: 12 }}>
            Bugün
          </button>
          <button
            onClick={() => { setDateFrom(''); setDateTo('') }}
            style={{ ...S.btn, background: '#f1f5f9', color: '#475569', padding: '7px 12px', fontSize: 12 }}>
            Tümü
          </button>
        </div>

        <div style={{ width: 1, height: 30, background: '#e2e8f0', flexShrink: 0 }} />

        {/* Search & payment type */}
        <input
          style={{ ...S.input, flex: '1 1 160px', minWidth: 140 }}
          placeholder="Öğrenci veya okul ara..." value={q}
          onChange={e => setQ(e.target.value)} />
        <select
          style={{ ...S.input, minWidth: 150 }}
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}>
          <option value="">Tüm Ödeme Türleri</option>
          {PAYMENT_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* ── Table ── */}
      <div className="ak-panel" style={S.panel}>
        <div className="ak-table-wrap" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}>
            <thead>
              <tr>
                {isAdminPanelMode && <th style={S.th}>🏫 Okul</th>}
                <th style={S.th}>Tarih</th>
                <th style={S.th}>Öğrenci</th>
                <th style={S.th}>Sınıf</th>
                <th style={S.th}>Kalem</th>
                <th style={S.th}>Ödeme</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Tutar</th>
                <th style={{ ...S.th, textAlign: 'right' }}>KDV</th>
                <th style={S.th}>Fatura No</th>
                <th style={S.th}>Açıklama</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={isAdminPanelMode ? 10 : 9} style={{ ...S.td, textAlign: 'center', color: '#94a3b8', padding: '50px 12px' }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                    {collections.length === 0
                      ? 'Henüz hiç tahsilat kaydı yok.'
                      : 'Seçili tarih aralığında veya filtrelerde kayıt bulunamadı.'}
                  </td>
                </tr>
              ) : filtered.map(c => {
                const s = getStudent(state, c.studentId)
                const invoiced = isCollectionInvoiced(state, c, s)
                const vat = invoiced ? (c.vat || 0) : 0

                return (
                  <tr key={String(c.id || c._id)}
                    onMouseEnter={e => e.currentTarget.style.background = '#fafbff'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    style={{ transition: 'background 0.12s' }}>
                    {isAdminPanelMode && (
                      <td style={S.td}>
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 8px', borderRadius: 6,
                          fontSize: 11, fontWeight: 700,
                          background: 'rgba(99,102,241,0.08)', color: '#4338ca',
                          border: '1px solid rgba(99,102,241,0.2)',
                          whiteSpace: 'nowrap'
                        }}>
                          🏫 {s?._schoolName || c._schoolName || '—'}
                        </span>
                      </td>
                    )}
                    <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {trDate(c.date)}
                    </td>
                    <td style={{ ...S.td, fontWeight: 700 }}>{s?.name || '—'}</td>
                    <td style={{ ...S.td, color: '#64748b' }}>{s?.class || '—'}</td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{c.item || '—'}</span>
                        {!invoiced && (
                          <span style={{
                            fontSize: 10, padding: '1px 6px', borderRadius: 4,
                            background: '#f1f5f9', color: '#64748b', fontWeight: 600
                          }}>
                            Faturasız
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={S.td}>
                      <span style={payBadge(c.payment)}>{c.payment || '—'}</span>
                    </td>
                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                      {money(c.amount)}
                    </td>
                    <td style={{ ...S.td, textAlign: 'right', color: invoiced ? '#f59e0b' : '#94a3b8' }}>
                      {invoiced ? money(vat) : <span style={{ color: '#cbd5e1' }}>—</span>}
                    </td>
                    <td style={{ ...S.td, fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>
                      {invoiced && c.invoiceNo ? c.invoiceNo : <span style={{ color: '#cbd5e1' }}>—</span>}
                    </td>
                    <td style={{
                      ...S.td, color: c.note ? '#0f172a' : '#94a3b8',
                      maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                      {c.note || '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr style={{ background: '#f8fafc' }}>
                  <td colSpan={5} style={{ ...S.td, fontWeight: 700, color: '#475569', fontSize: 12 }}>
                    TOPLAM ({totals.count} kayıt)
                  </td>
                  <td style={{ ...S.td, textAlign: 'right', fontWeight: 800, color: '#6366f1' }}>
                    {money(totals.total)}
                  </td>
                  <td style={{ ...S.td, textAlign: 'right', fontWeight: 800, color: '#f59e0b' }}>
                    {money(totals.vat)}
                  </td>
                  <td colSpan={2} style={S.td} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}
