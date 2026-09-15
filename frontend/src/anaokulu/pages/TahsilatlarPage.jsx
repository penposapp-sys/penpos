import React, { useState, useMemo, useEffect } from 'react'
import { api } from '../../lib/apiClient.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useAnaokuluData } from '../context/AnaokuluDataContext.jsx'
import { money, trDate, getStudent, round2, isCollectionInvoiced } from '../utils/calculations.js'
import { printCollectionReceipt } from '../utils/receiptGenerator.js'

/* ─── Helpers ─────────────────────────────────────────────── */
const todayStr = () => new Date().toISOString().slice(0, 10)

const normalizePaymentName = (value) => String(value ?? '').trim()
const normalizePaymentKey = (value) => normalizePaymentName(value).toLocaleLowerCase('tr-TR')

const paymentTypeBaseLabel = (type = 'custom') => {
  const map = {
    cash: 'Nakit',
    card: 'Kredi Kartı',
    bank: 'Havale / EFT',
    credit: 'Veresiye',
    account: 'Veresiye',
    custom: 'Özel',
    other: 'Özel',
  }
  return map[String(type || 'custom')] || 'Özel'
}

const buildConfiguredPaymentLabel = (method = {}) => {
  const base = paymentTypeBaseLabel(method?.type || 'custom')
  const name = normalizePaymentName(method?.name || method?.label)
  return name ? `${base} - ${name}` : base
}

const getConfiguredPaymentTypeOptions = (configured = []) => {
  const names = (Array.isArray(configured) ? configured : [])
    .map((value) => normalizePaymentName(value))
    .filter(Boolean)
  return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, 'tr'))
}

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
  const { isAdminPanelMode, accessibleTenants, user } = useAuth()
  const isSuperAdmin = user?.role === 'superadmin'
  const { state } = useAnaokuluData()
  const collections = state?.collections || []

  // Varsayılan: bugün → bugün
  const [selectedSchoolId, setSelectedSchoolId] = useState('')
  const [dateFrom, setDateFrom] = useState(todayStr())
  const [dateTo, setDateTo] = useState(todayStr())
  const [q, setQ] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [sortKey, setSortKey] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const [paymentOptions, setPaymentOptions] = useState([])

  const [windowWidth, setWindowWidth] = useState(() => typeof window !== 'undefined' ? window.innerWidth : 1200)
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  const isMobile = windowWidth < 820

  useEffect(() => {
    let active = true
    const loadPaymentMethods = async () => {
      try {
        const result = await api('/api/settings/payment-methods', { silent: true, cacheMode: 'no-store' })
        const methods = Array.isArray(result?.paymentMethods)
          ? result.paymentMethods
          : Array.isArray(result?.methods)
            ? result.methods
            : []
        const names = methods
          .filter((method) => method && method.isDeleted !== true && method.enabled !== false)
          .map((method) => buildConfiguredPaymentLabel(method))
          .filter(Boolean)
        if (active) setPaymentOptions(names)
      } catch {
        if (active) setPaymentOptions([])
      }
    }
    loadPaymentMethods()
    return () => { active = false }
  }, [])

  const handlePrintRowReceipt = (c) => {
    const s = getStudent(state, c.studentId)
    const plan = (s?.items || []).find(p => p.name === c.item)
    const planTotal = Number(plan?.total) || 0
    const studentCollections = (state?.collections || []).filter(col => String(col.studentId) === String(c.studentId) && col.item === c.item)
    const totalCollected = studentCollections.reduce((sum, col) => sum + (Number(col.amount) || 0), 0)
    const remaining = Math.max(0, planTotal - totalCollected)

    printCollectionReceipt({
      schoolName: s?._schoolName || c._schoolName || state?.settings?.school || state?.settings?.okulAdi || 'Anaokulu',
      student: s || {},
      collection: c,
      planName: c.item,
      installmentNo: c.installmentNo,
      dueDate: c.dueDate || '',
      totalPlan: planTotal,
      totalCollected,
      remaining
    })
  }

  const compareLocalized = (a, b) => String(a ?? '').localeCompare(String(b ?? ''), 'tr')

  const sortValue = (c, key, s) => {
    switch (key) {
      case 'date':
        return new Date(c.date || '1970-01-01').getTime()
      case 'student':
        return (s?.name || '').toLocaleLowerCase('tr')
      case 'class':
        return (s?.class || '').toLocaleLowerCase('tr')
      case 'school':
        return ((s?._schoolName || c._schoolName || '')).toLocaleLowerCase('tr')
      case 'item':
        return (c.item || '').toLocaleLowerCase('tr')
      case 'payment':
        return (c.payment || '').toLocaleLowerCase('tr')
      case 'amount':
        return Number(c.amount || 0)
      case 'vat':
        return Number(c.vat || 0)
      case 'invoiceNo':
        return (c.invoiceNo || '').toLocaleLowerCase('tr')
      case 'note':
        return (c.note || '').toLocaleLowerCase('tr')
      default:
        return new Date(c.date || '1970-01-01').getTime()
    }
  }

  const toggleSort = (key) => {
    if (sortKey === key) {
      if (sortDir === 'asc') {
        setSortDir('desc')
        return
      }
      if (sortDir === 'desc') {
        setSortKey('date')
        setSortDir('desc')
        return
      }
    }
    setSortKey(key)
    setSortDir('asc')
  }

  const paymentTypeOptions = useMemo(() => getConfiguredPaymentTypeOptions(paymentOptions), [paymentOptions])

  const filtered = useMemo(() => {
    const needle = q.toLowerCase().trim()
    const rows = collections.filter(c => {
      const s = getStudent(state, c.studentId)
      const paymentValue = normalizePaymentName(c.payment)
      const filterValue = normalizePaymentKey(typeFilter)
      const hitSchool = !selectedSchoolId || (s?._schoolId === selectedSchoolId) || (c._schoolId === selectedSchoolId)
      const hitSearch = !needle || [
        s?.name || '',
        s?.class || '',
        s?._schoolName || '',
        c._schoolName || '',
        c.item || '',
        c.payment || '',
        c.invoiceNo || '',
        c.note || '',
        c.date || ''
      ].join(' ').toLowerCase().includes(needle)
      const typeHint = paymentValue.includes('Havale') || paymentValue.includes('EFT') || paymentValue.includes('Banka')
        ? 'Havale / EFT'
        : paymentValue.includes('Kart') || paymentValue.includes('Kredi') || paymentValue.includes('POS') || paymentValue.includes('Pos')
          ? 'Kredi Kartı'
          : paymentValue.includes('Nakit')
            ? 'Nakit'
            : paymentValue

      const hitType = !filterValue || normalizePaymentKey(paymentValue) === filterValue || normalizePaymentKey(typeHint) === filterValue || normalizePaymentKey(paymentValue).includes(filterValue) || normalizePaymentKey(typeHint).includes(filterValue)
      const hitFrom = !dateFrom || (c.date || '') >= dateFrom
      const hitTo = !dateTo || (c.date || '') <= dateTo
      return hitSchool && hitSearch && hitType && hitFrom && hitTo
    })

    return [...rows].sort((a, b) => {
      const sA = getStudent(state, a.studentId)
      const sB = getStudent(state, b.studentId)
      const aValue = sortValue(a, sortKey, sA)
      const bValue = sortValue(b, sortKey, sB)

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDir === 'asc' ? aValue - bValue : bValue - aValue
      }

      const comparison = compareLocalized(aValue, bValue)
      return sortDir === 'asc' ? comparison : -comparison
    })
  }, [collections, q, typeFilter, dateFrom, dateTo, selectedSchoolId, sortKey, sortDir, state])

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
    const normalized = normalizePaymentKey(type)
    const baseKey = normalized.includes('nakit') ? 'cash'
      : (normalized.includes('havale') || normalized.includes('eft') || normalized.includes('banka')) ? 'bank'
      : (normalized.includes('kart') || normalized.includes('kredi') || normalized.includes('pos')) ? 'card'
      : (normalized.includes('veresiye') || normalized.includes('cari')) ? 'credit'
      : 'custom'
    const map = {
      cash: ['#dcfce7', '#15803d'],
      bank: ['#dbeafe', '#1d4ed8'],
      card: ['#ede9fe', '#6d28d9'],
      credit: ['#fef3c7', '#b45309'],
      custom: ['#f1f5f9', '#475569']
    }
    const [bg, color] = map[baseKey] || ['#f1f5f9', '#475569']
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
          {paymentTypeOptions.map((payment) => (
            <option key={payment} value={payment}>{payment}</option>
          ))}
        </select>
      </div>

      {/* ── Table ── */}
      {/* ── Table / Mobile Cards ── */}
      <div className="ak-panel" style={S.panel}>
        {isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12 }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 12px' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                {collections.length === 0
                  ? 'Henüz hiç tahsilat kaydı yok.'
                  : 'Seçili tarih aralığında veya filtrelerde kayıt bulunamadı.'}
              </div>
            ) : (
              filtered.map(c => {
                const s = getStudent(state, c.studentId)
                const invoiced = isCollectionInvoiced(state, c, s)
                const vat = invoiced ? (c.vat || 0) : 0

                return (
                  <div
                    key={String(c.id || c._id)}
                    style={{
                      background: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 12,
                      padding: '12px 14px',
                      boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8
                    }}
                  >
                    {/* Satır 1: Öğrenci Adı ve Tutar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a' }}>
                          {s?.name || '—'}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                          {s?.class && (
                            <span style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                              {s.class}
                            </span>
                          )}
                          {isAdminPanelMode && (s?._schoolName || c._schoolName) && (
                            <span style={{
                              padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                              background: 'rgba(99,102,241,0.08)', color: '#4338ca'
                            }}>
                              🏫 {s?._schoolName || c._schoolName}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a' }}>
                          {money(c.amount)}
                        </div>
                        {invoiced && vat > 0 && (
                          <div style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700 }}>
                            KDV: {money(vat)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Satır 2: Kalem & Fatura Durumu */}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      gap: 8, fontSize: 12, color: '#334155', flexWrap: 'wrap'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 600 }}>{c.item || '—'}</span>
                        {!invoiced ? (
                          <span style={{
                            fontSize: 10, padding: '1px 6px', borderRadius: 4,
                            background: '#f1f5f9', color: '#64748b', fontWeight: 600
                          }}>
                            Faturasız
                          </span>
                        ) : c.invoiceNo ? (
                          <span style={{
                            fontSize: 10, padding: '1px 6px', borderRadius: 4,
                            background: '#dcfce7', color: '#166534', fontWeight: 700
                          }}>
                            Fatura: {c.invoiceNo}
                          </span>
                        ) : null}
                      </div>
                      <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>
                        📅 {trDate(c.date)}
                      </span>
                    </div>

                    {/* Satır 3: Ödeme Yöntemi, Makbuz Butonu ve Açıklama */}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      gap: 8, paddingTop: 6, borderTop: '1px solid #f1f5f9', flexWrap: 'wrap'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={payBadge(c.payment)}>{c.payment || '—'}</span>
                        <button
                          type="button"
                          onClick={() => handlePrintRowReceipt(c)}
                          style={{
                            ...S.btn, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe',
                            padding: '3px 8px', fontSize: 11
                          }}
                          title="Tahsilat Makbuzunu Yazdır"
                        >
                          🧾 Makbuz
                        </button>
                      </div>
                      {c.note && (
                        <div style={{
                          fontSize: 11, color: '#64748b', maxWidth: '50%',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                        }}>
                          💬 {c.note}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}

            {/* Mobil Toplam Bar */}
            {filtered.length > 0 && (
              <div style={{
                background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10,
                padding: '10px 14px', display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', fontSize: 12, fontWeight: 700, color: '#475569', flexWrap: 'wrap', gap: 8
              }}>
                <span>TOPLAM ({totals.count} kayıt)</span>
                <div style={{ display: 'flex', gap: 10 }}>
                  <span style={{ color: '#6366f1', fontWeight: 800 }}>{money(totals.total)}</span>
                  {totals.vat > 0 && (
                    <span style={{ color: '#f59e0b', fontWeight: 800 }}>KDV: {money(totals.vat)}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="ak-table-wrap" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}>
              <thead>
                <tr>
                  {isAdminPanelMode && (
                    <th style={S.th}>
                      <button type="button" onClick={() => toggleSort('school')} style={{ all: 'unset', cursor: 'pointer', fontWeight: 700, color: '#475569' }}>
                        🏫 Okul {sortKey === 'school' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                      </button>
                    </th>
                  )}
                  <th style={S.th}>
                    <button type="button" onClick={() => toggleSort('date')} style={{ all: 'unset', cursor: 'pointer', fontWeight: 700, color: '#475569' }}>
                      Tarih {sortKey === 'date' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                    </button>
                  </th>
                  <th style={S.th}>
                    <button type="button" onClick={() => toggleSort('student')} style={{ all: 'unset', cursor: 'pointer', fontWeight: 700, color: '#475569' }}>
                      Öğrenci {sortKey === 'student' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                    </button>
                  </th>
                  <th style={S.th}>
                    <button type="button" onClick={() => toggleSort('class')} style={{ all: 'unset', cursor: 'pointer', fontWeight: 700, color: '#475569' }}>
                      Sınıf {sortKey === 'class' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                    </button>
                  </th>
                  <th style={S.th}>
                    <button type="button" onClick={() => toggleSort('item')} style={{ all: 'unset', cursor: 'pointer', fontWeight: 700, color: '#475569' }}>
                      Kalem {sortKey === 'item' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                    </button>
                  </th>
                  <th style={S.th}>
                    <button type="button" onClick={() => toggleSort('payment')} style={{ all: 'unset', cursor: 'pointer', fontWeight: 700, color: '#475569' }}>
                      Ödeme {sortKey === 'payment' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                    </button>
                  </th>
                  <th style={{ ...S.th, textAlign: 'right' }}>
                    <button type="button" onClick={() => toggleSort('amount')} style={{ all: 'unset', cursor: 'pointer', fontWeight: 700, color: '#475569' }}>
                      Tutar {sortKey === 'amount' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                    </button>
                  </th>
                  <th style={{ ...S.th, textAlign: 'right' }}>
                    <button type="button" onClick={() => toggleSort('vat')} style={{ all: 'unset', cursor: 'pointer', fontWeight: 700, color: '#475569' }}>
                      KDV {sortKey === 'vat' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                    </button>
                  </th>
                  <th style={S.th}>
                    <button type="button" onClick={() => toggleSort('invoiceNo')} style={{ all: 'unset', cursor: 'pointer', fontWeight: 700, color: '#475569' }}>
                      Fatura No {sortKey === 'invoiceNo' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                    </button>
                  </th>
                  <th style={S.th}>
                    <button type="button" onClick={() => toggleSort('note')} style={{ all: 'unset', cursor: 'pointer', fontWeight: 700, color: '#475569' }}>
                      Açıklama {sortKey === 'note' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                    </button>
                  </th>
                  <th style={{ ...S.th, textAlign: 'center', width: 90 }}>Makbuz</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={isAdminPanelMode ? 11 : 10} style={{ ...S.td, textAlign: 'center', color: '#94a3b8', padding: '50px 12px' }}>
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
                      <td style={{ ...S.td, textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => handlePrintRowReceipt(c)}
                          style={{
                            ...S.btn,
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            border: '1px solid #bfdbfe',
                            padding: '4px 8px',
                            fontSize: 11
                          }}
                          title="Tahsilat Makbuzunu Yazdır / PDF Al"
                        >
                          🧾 Makbuz
                        </button>
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
                    <td colSpan={3} style={S.td} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
