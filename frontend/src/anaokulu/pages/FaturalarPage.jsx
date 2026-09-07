import React, { useState, useMemo } from 'react'
import { useAnaokuluData } from '../context/AnaokuluDataContext.jsx'
import { api } from '../../lib/apiClient.js'
import {
  money, trDate, periodsOfYear, getYearStart, periodName, round2,
  getMonthlyInvoicableInstallments
} from '../utils/calculations.js'

const Btn = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 14px', borderRadius: 10, fontWeight: 600,
  cursor: 'pointer', border: 'none', fontSize: 13, transition: 'all 0.15s'
}

const InputCls = {
  padding: '9px 12px', borderRadius: 10,
  border: '1px solid #cbd5e1', background: '#fff',
  fontSize: 13, outline: 'none'
}

export default function FaturalarPage() {
  const { state, actions } = useAnaokuluData()
  const invoices = state?.invoices || []
  const ys = getYearStart(state)
  const lucaSettings = state?.settings?.luca || {}

  const [period, setPeriod] = useState(() => {
    const now = new Date()
    const cur = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0')
    const ps = periodsOfYear(ys)
    return ps.includes(cur) ? cur : ps[0]
  })
  const [q, setQ] = useState('')
  const [invoiceFilter, setInvoiceFilter] = useState('')
  const [collectionFilter, setCollectionFilter] = useState('')
  const [lucaModalOpen, setLucaModalOpen] = useState(false)
  const [lucaRunning, setLucaRunning] = useState(false)
  const [detailInv, setDetailInv] = useState(null)
  const [toastMsg, setToastMsg] = useState('')

  // Luca giriş ayarları formu
  const [lucaForm, setLucaForm] = useState({
    tckn: lucaSettings.tckn || lucaSettings.username || lucaSettings.customerNo || '',
    password: lucaSettings.password || ''
  })

  const toast = (m) => { setToastMsg(m); setTimeout(() => setToastMsg(''), 3200) }

  // O ayın (veya tüm dönemlerin) faturalı taksitleri
  const rawRows = useMemo(() => {
    return getMonthlyInvoicableInstallments(state, period)
  }, [state, period])

  // Arama ve Durum filtreleri
  const processedData = useMemo(() => {
    const needle = q.toLowerCase().trim()

    const filtered = rawRows.filter(r => {
      const searchTarget = `${r.studentName} ${r.parent} ${r.tax} ${r.planName} ${r.invoiceNo}`.toLowerCase()
      const hitSearch = !needle || searchTarget.includes(needle)
      
      let hitInv = true
      if (invoiceFilter === 'billed') hitInv = r.invoiceStatus === 'billed'
      else if (invoiceFilter === 'unbilled') hitInv = r.invoiceStatus === 'unbilled'
      else if (invoiceFilter === 'diff') hitInv = Boolean(r.hasDiff)

      const hitCol = !collectionFilter || r.collectionStatus === collectionFilter
      return hitSearch && hitInv && hitCol
    })

    const totalPlanned = rawRows.reduce((s, r) => s + r.amount, 0)
    const totalPaid = rawRows.reduce((s, r) => s + r.paid, 0)
    const totalRemaining = rawRows.reduce((s, r) => s + r.remaining, 0)

    const billedItems = rawRows.filter(r => r.invoiceStatus === 'billed')
    const unbilledItems = rawRows.filter(r => r.invoiceStatus === 'unbilled')
    const diffItems = rawRows.filter(r => r.hasDiff)

    const billedAmount = billedItems.reduce((s, r) => s + (r.invoiceTotal || r.amount), 0)
    const unbilledAmount = unbilledItems.reduce((s, r) => s + r.amount, 0)
    const totalDiffAmount = diffItems.reduce((s, r) => s + Math.abs(r.diff), 0)

    return {
      list: filtered,
      totalCount: rawRows.length,
      filteredCount: filtered.length,
      totalPlanned,
      totalPaid,
      totalRemaining,
      billedCount: billedItems.length,
      billedAmount,
      unbilledCount: unbilledItems.length,
      unbilledAmount,
      diffCount: diffItems.length,
      diffItems,
      totalDiffAmount
    }
  }, [rawRows, q, invoiceFilter, collectionFilter])

  // TÜRMOB Luca sorgulaması — Bot üzerinden gerçek API çağrısı
  const runCheckInvoices = async () => {
    const hasCredentials = Boolean(lucaSettings.tckn || lucaSettings.username || lucaSettings.customerNo) && Boolean(lucaSettings.password)
    if (!hasCredentials) {
      setLucaForm({
        tckn: lucaSettings.tckn || lucaSettings.username || lucaSettings.customerNo || '',
        password: lucaSettings.password || ''
      })
      setLucaModalOpen(true)
      toast('⚠️ TÜRMOB Luca kontrolü için lütfen TCKN ve Şifre girin.')
      return
    }

    if (lucaRunning) return
    setLucaRunning(true)
    toast('🤖 TÜRMOB Luca sistemine bağlanılıyor, lütfen bekleyin...')

    try {
      const res = await api('/api/anaokulu/check-luca', {
        method: 'POST',
        data: { period },
        portalOverride: 'anaokulu'
      })

      if (res?.error) {
        toast(`❌ Hata: ${res.error}`)
        return
      }

      // Backend'den güncel tüm veriyi al ve store'u güncelle
      if (res?.ok) {
        actions.replaceAll({
          settings: res.settings || state.settings,
          students: res.students || state.students,
          collections: res.collections || state.collections,
          invoices: res.invoices || state.invoices,
          checks: res.checks || state.checks
        })
        toast(`✅ TÜRMOB Luca kontrolü tamamlandı! ${res.found || 0} fatura bulundu, ${res.matched || 0} öğrenci ile eşleştirildi.`)
      }
    } catch (err) {
      toast(`❌ Bağlantı hatası: ${err?.message || 'Bilinmeyen hata'}`)
    } finally {
      setLucaRunning(false)
    }
  }

  // Faturayı iptal et / sil
  const handleDeleteInvoice = (inv) => {
    if (!inv) return
    if (window.confirm(`${inv.no} numaralı faturayı silmek / iptal etmek istediğinize emin misiniz?`)) {
      actions.deleteInvoice(inv.uuid || inv._id)
      setDetailInv(null)
      toast(`✓ ${inv.no} numaralı fatura silindi.`)
    }
  }

  const handleSaveLuca = () => {
    if (!lucaForm.tckn || !lucaForm.password) {
      toast('⚠️ TCKN ve Şifre zorunludur.')
      return
    }
    actions.updateSettings({
      ...(state.settings || {}),
      luca: { tckn: lucaForm.tckn, password: lucaForm.password }
    })
    setLucaModalOpen(false)
    toast('✓ TÜRMOB Luca e-Fatura giriş bilgileri kaydedildi.')
  }

  const panel = {
    background: '#fff', borderRadius: 14, border: '1px solid #e6ebf3',
    boxShadow: '0 1px 2px rgba(15,23,42,0.04)', overflow: 'hidden'
  }
  const miniBox = {
    padding: '12px 16px', borderRadius: 12,
    background: '#fff', border: '1px solid #e2e8f0'
  }
  const th = {
    padding: '11px 13px', fontSize: 12, fontWeight: 700, color: '#475569',
    background: '#f8fafc', borderBottom: '1px solid #e6ebf3', textAlign: 'left'
  }
  const td = {
    padding: '11px 13px', fontSize: 13, borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle'
  }
  const tbl = { width: '100%', borderCollapse: 'collapse' }

  return (
    <div>
      {/* Üst Başlık ve Luca Aksiyonları */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: 24, color: '#0f172a' }}>🧾 Faturalar & Taksit Takibi</h2>
          <p style={{ margin: 0, color: '#475569', fontSize: 14 }}>
            Tahsilatı yapılmış veyahut yapılmamış olsun, <strong>o ayın taksitleri</strong>, fatura ve tahsilat durumu ile KDV detayları
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a
            href="https://turmobefatura.luca.com.tr/Account/Login"
            target="_blank"
            rel="noreferrer"
            style={{
              ...Btn,
              background: '#f8fafc',
              color: '#0369a1',
              border: '1px solid #bae6fd',
              textDecoration: 'none'
            }}
          >
            🔗 TÜRMOB Luca Portalı ↗
          </a>
          <button
            onClick={() => {
              setLucaForm({
                tckn: lucaSettings.tckn || lucaSettings.username || lucaSettings.customerNo || '',
                password: lucaSettings.password || ''
              })
              setLucaModalOpen(true)
            }}
            style={{
              ...Btn,
              background: '#f1f5f9',
              color: '#334155',
              border: '1px solid #cbd5e1'
            }}
          >
            ⚙️ Luca Ayarları
          </button>
          <button
            onClick={runCheckInvoices}
            disabled={lucaRunning}
            style={{
              ...Btn, 
              background: lucaRunning ? '#64748b' : 'linear-gradient(135deg,#0284c7,#0369a1)', 
              color: '#fff',
              boxShadow: lucaRunning ? 'none' : '0 4px 12px rgba(2,132,199,0.25)',
              opacity: lucaRunning ? 0.8 : 1,
              cursor: lucaRunning ? 'not-allowed' : 'pointer'
            }}
          >
            {lucaRunning ? '🤖 Luca\'ya Bağlanıyor...' : '↻ Faturaları Kontrol Et'}
          </button>
        </div>
      </div>

      {/* Filtre ve Arama Alanı */}
      <div style={{
        ...panel, marginBottom: 16, padding: '14px 16px',
        display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center'
      }}>
        {/* Ay Seçici */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>Dönem (Ay):</span>
          <select
            style={{ ...InputCls, minWidth: 160, fontWeight: 700, color: '#0369a1' }}
            value={period}
            onChange={e => setPeriod(e.target.value)}
          >
            <option value="all">Tüm Dönemler</option>
            {periodsOfYear(ys).map(p => (
              <option key={p} value={p}>{periodName(p)}</option>
            ))}
          </select>
        </div>

        {/* Arama */}
        <input
          style={{ ...InputCls, flex: '1 1 200px', minWidth: 180 }}
          placeholder="Öğrenci, veli, TCKN veya fatura no ara..."
          value={q}
          onChange={e => setQ(e.target.value)}
        />

        {/* Fatura Durumu Filtresi */}
        <select
          style={{ ...InputCls, minWidth: 160, fontWeight: 600 }}
          value={invoiceFilter}
          onChange={e => setInvoiceFilter(e.target.value)}
        >
          <option value="">Fatura: Tümü</option>
          <option value="billed">🟢 Faturası Kesildi</option>
          <option value="unbilled">🔴 Fatura Kesilmedi</option>
          {processedData.diffCount > 0 && (
            <option value="diff">⚠️ Tutar Farkı Olanlar ({processedData.diffCount})</option>
          )}
        </select>

        {/* Tahsilat Durumu Filtresi */}
        <select
          style={{ ...InputCls, minWidth: 160, fontWeight: 600 }}
          value={collectionFilter}
          onChange={e => setCollectionFilter(e.target.value)}
        >
          <option value="">Tahsilat: Tümü</option>
          <option value="paid">🟢 Tahsil Edildi</option>
          <option value="partial">🟡 Kısmi Tahsilat</option>
          <option value="unpaid">🔴 Tahsil Edilmedi</option>
        </select>

        <span style={{ fontSize: 12, color: '#64748b', marginLeft: 'auto' }}>
          Toplam: <b style={{ color: '#0f172a' }}>{processedData.filteredCount} Taksit</b>
        </span>
      </div>

      {/* İstatistik ve Özet Kartları */}
      <div style={{
        padding: '12px 18px', background: '#fff', borderRadius: 14,
        border: '1px solid #e6ebf3', marginBottom: 16
      }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12
        }}>
          {/* Toplam Taksit */}
          <div style={miniBox}>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Dönem Taksit Tutarı</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
              <b style={{ fontSize: 18, color: '#0f172a' }}>{processedData.totalCount} Adet</b>
              <span style={{ fontSize: 13, color: '#0f172a', fontWeight: 800 }}>{money(processedData.totalPlanned)}</span>
            </div>
          </div>

          {/* Tahsil Edilen */}
          <div style={{ ...miniBox, background: '#f0fdf4', borderColor: '#bbf7d0' }}>
            <div style={{ fontSize: 11, color: '#166534', fontWeight: 700 }}>🟢 Tahsil Edilen Tutar</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
              <b style={{ fontSize: 18, color: '#166534' }}>{money(processedData.totalPaid)}</b>
            </div>
          </div>

          {/* Tahsil Edilmeyen */}
          <div style={{ ...miniBox, background: '#fef2f2', borderColor: '#fecaca' }}>
            <div style={{ fontSize: 11, color: '#991b1b', fontWeight: 700 }}>🔴 Tahsil Edilmeyen Tutar</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
              <b style={{ fontSize: 18, color: '#991b1b' }}>{money(processedData.totalRemaining)}</b>
            </div>
          </div>

          {/* Faturası Kesilen */}
          <div style={{ ...miniBox, background: 'linear-gradient(135deg,#ecfdf5,#d1fae5)', borderColor: '#a7f3d0' }}>
            <div style={{ fontSize: 11, color: '#065f46', fontWeight: 700 }}>🟢 Faturası Kesilen</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
              <b style={{ fontSize: 18, color: '#065f46' }}>{processedData.billedCount} Adet</b>
              <span style={{ fontSize: 12, color: '#047857', fontWeight: 700 }}>{money(processedData.billedAmount)}</span>
            </div>
          </div>

          {/* Fatura Kesilmemiş */}
          <div style={{ ...miniBox, background: 'linear-gradient(135deg,#fff1f2,#ffe4e6)', borderColor: '#fecdd3' }}>
            <div style={{ fontSize: 11, color: '#9f1239', fontWeight: 700 }}>🔴 Fatura Kesilmemiş (Bekleyen)</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
              <b style={{ fontSize: 18, color: '#9f1239' }}>{processedData.unbilledCount} Adet</b>
              <span style={{ fontSize: 12, color: '#be123c', fontWeight: 700 }}>{money(processedData.unbilledAmount)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tutar Uyuşmazlığı Uyarı Kartı */}
      {processedData.diffCount > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #fff7ed, #ffedd5)',
          border: '1px solid #fdba74',
          borderRadius: 14,
          padding: '12px 18px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(234,88,12,0.08)',
          flexWrap: 'wrap',
          gap: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 26 }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 800, color: '#9a3412', fontSize: 14 }}>
                {processedData.diffCount} Öğrencinin Faturasında Tutar Uyuşmazlığı Var!
              </div>
              <div style={{ fontSize: 12, color: '#c2410c', marginTop: 2 }}>
                Taksit tutarı ile kesilen fatura tutarı eşit değil. Tablodaki <strong>⚠️ Eksik Kesildi</strong> uyarılarını inceleyebilirsiniz.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              background: '#ea580c', color: '#fff', padding: '5px 12px',
              borderRadius: 999, fontSize: 12, fontWeight: 800
            }}>
              Toplam Fark: {money(processedData.totalDiffAmount)}
            </span>
            {invoiceFilter !== 'diff' ? (
              <button
                onClick={() => setInvoiceFilter('diff')}
                style={{
                  ...Btn, background: '#fff', color: '#9a3412', border: '1px solid #fdba74',
                  fontSize: 12, padding: '5px 12px'
                }}
              >
                Farklı Olanları Filtrele 🔍
              </button>
            ) : (
              <button
                onClick={() => setInvoiceFilter('')}
                style={{
                  ...Btn, background: '#9a3412', color: '#fff', border: 'none',
                  fontSize: 12, padding: '5px 12px'
                }}
              >
                ✕ Filtreyi Temizle
              </button>
            )}
          </div>
        </div>
      )}

      {/* Taksitler ve Faturalar Tablosu */}
      <div style={panel}>
        <div style={{ overflow: 'auto', maxHeight: '64vh' }}>
          <table style={{ ...tbl, minWidth: 1200 }}>
            <thead>
              <tr>
                <th style={{ ...th, width: 140 }}>Fatura Durumu</th>
                <th style={{ ...th, width: 140 }}>Tahsilat Durumu</th>
                <th style={th}>Öğrenci Adı</th>
                <th style={th}>Veli / Alıcı</th>
                <th style={th}>TCKN / VKN</th>
                <th style={th}>Ücret Kalemi</th>
                <th style={th}>Vade Tarihi</th>
                <th style={{ ...th, textAlign: 'right' }}>Taksit Tutarı (₺)</th>
                <th style={{ ...th, textAlign: 'right' }}>Tahsil Edilen (₺)</th>
                <th style={{ ...th, textAlign: 'right' }}>Matrah</th>
                <th style={{ ...th, textAlign: 'right' }}>KDV</th>
                <th style={th}>Fatura No</th>
                <th style={{ ...th, textAlign: 'center', width: 130 }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {processedData.list.length === 0 ? (
                <tr>
                  <td colSpan={13} style={{
                    ...td, textAlign: 'center', color: '#94a3b8', padding: '48px 12px'
                  }}>
                    Bu dönem için kayıtlı faturalı taksit bulunamadı.
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
                      (Faturasız öğrenciler ve faturasız ücret kalemleri bu sayfaya dahil edilmez)
                    </div>
                  </td>
                </tr>
              ) : processedData.list.map(row => {
                const isBilled = row.invoiceStatus === 'billed'
                const isPaid = row.collectionStatus === 'paid'
                const isPartial = row.collectionStatus === 'partial'

                return (
                  <tr key={row.id} style={{ transition: 'background 0.15s' }}>
                    {/* Fatura Durumu */}
                    <td style={td}>
                      {isBilled ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 800,
                            background: row.isUnderInvoiced ? '#fff7ed' : (row.isOverInvoiced ? '#eff6ff' : '#dcfce7'),
                            color: row.isUnderInvoiced ? '#c2410c' : (row.isOverInvoiced ? '#1d4ed8' : '#15803d'),
                            border: `1px solid ${row.isUnderInvoiced ? '#fed7aa' : (row.isOverInvoiced ? '#bfdbfe' : '#bbf7d0')}`
                          }}>
                            {row.isUnderInvoiced ? '⚠️ Eksik Kesildi' : (row.isOverInvoiced ? 'ℹ️ Fazla Kesildi' : '🟢 Kesildi')}
                          </span>
                          {row.hasDiff && (
                            <span style={{
                              fontSize: 10, fontWeight: 800,
                              color: row.isUnderInvoiced ? '#b91c1c' : '#1d4ed8',
                              background: row.isUnderInvoiced ? '#fee2e2' : '#dbeafe',
                              padding: '1px 6px', borderRadius: 6,
                              border: `1px solid ${row.isUnderInvoiced ? '#fca5a5' : '#93c5fd'}`
                            }}>
                              {row.isUnderInvoiced ? `-${money(Math.abs(row.diff))} Fark` : `+${money(row.diff)} Fark`}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 800,
                          background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca'
                        }}>
                          🔴 Kesilmedi
                        </span>
                      )}
                    </td>

                    {/* Tahsilat Durumu */}
                    <td style={td}>
                      {isPaid ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 800,
                          background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0'
                        }}>
                          🟢 Tahsil Edildi
                        </span>
                      ) : isPartial ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 800,
                          background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a'
                        }}>
                          🟡 Kısmi ({money(row.paid)})
                        </span>
                      ) : (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 800,
                          background: '#f8fafc', color: '#64748b', border: '1px solid #cbd5e1'
                        }}>
                          🔴 Tahsil Edilmedi
                        </span>
                      )}
                    </td>

                    {/* Öğrenci */}
                    <td style={td}>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{row.studentName}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{row.student?.class ? `${row.student.class} Sınıfı` : ''}</div>
                    </td>

                    {/* Veli / Alıcı */}
                    <td style={td}>
                      <div style={{ color: '#334155' }}>{row.parent || '—'}</div>
                    </td>

                    {/* TCKN / VKN */}
                    <td style={td}>
                      <code style={{ fontSize: 12, background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, color: '#334155' }}>
                        {row.tax || '—'}
                      </code>
                    </td>

                    {/* Ücret Kalemi & Taksit No */}
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                          background: '#e0e7ff', color: '#3730a3'
                        }}>
                          {row.planName}
                        </span>
                        <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                          {row.installmentNo}. Taksit
                        </span>
                      </div>
                    </td>

                    {/* Vade Tarihi */}
                    <td style={td}>
                      <div style={{ fontSize: 12, color: '#334155', fontWeight: 600 }}>
                        {row.dueDateFormatted}
                      </div>
                    </td>

                    {/* Taksit Tutarı (Miktar) */}
                    <td style={{ ...td, textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 14 }}>
                        {money(row.amount)}
                      </div>
                      {row.hasDiff && (
                        <div style={{ marginTop: 3 }}>
                          <div style={{ fontSize: 11, color: '#64748b' }}>
                            Fatura: <strong style={{ color: row.isUnderInvoiced ? '#c2410c' : '#1d4ed8' }}>{money(row.invoiceTotal)}</strong>
                          </div>
                          <div style={{
                            fontSize: 10, fontWeight: 800,
                            color: row.isUnderInvoiced ? '#dc2626' : '#2563eb'
                          }}>
                            ({money(Math.abs(row.diff))} {row.isUnderInvoiced ? 'Eksik' : 'Fazla'})
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Tahsil Edilen */}
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: isPaid ? '#15803d' : '#64748b', fontSize: 13 }}>
                      {money(row.paid)}
                    </td>

                    {/* Matrah (KDV Hariç) */}
                    <td style={{ ...td, textAlign: 'right', color: '#475569', fontSize: 12 }}>
                      {money(row.baseAmount)}
                    </td>

                    {/* KDV Tutarı */}
                    <td style={{ ...td, textAlign: 'right', color: '#d97706', fontSize: 12, fontWeight: 700 }}>
                      <div>{money(row.vatAmount)}</div>
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>%{row.vatRate}</div>
                    </td>

                    {/* Fatura No */}
                    <td style={td}>
                      {row.invoiceNo ? (
                        <span style={{ fontWeight: 700, color: '#2563eb' }}>{row.invoiceNo}</span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
                      )}
                    </td>

                    {/* İşlem */}
                    <td style={{ ...td, textAlign: 'center' }}>
                      {isBilled ? (
                        <button
                          onClick={() => setDetailInv({ invoice: row.invoice, row })}
                          style={{
                            ...Btn,
                            background: row.hasDiff ? '#fff7ed' : '#f1f5f9',
                            color: row.hasDiff ? '#c2410c' : '#0f172a',
                            border: row.hasDiff ? '1px solid #fed7aa' : 'none',
                            padding: '4px 8px', fontSize: 11, fontWeight: 700
                          }}
                        >
                          🔍 Fatura Detay {row.hasDiff ? '⚠️' : ''}
                        </button>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* TÜRMOB Luca Bağlantı / Ayarlar Modalı */}
      {lucaModalOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: 16
          }}
          onClick={() => setLucaModalOpen(false)}
        >
          <div
            style={{
              background: '#fff', borderRadius: 18, width: 'min(480px, 100%)',
              boxShadow: '0 20px 50px rgba(15,23,42,0.25)', overflow: 'hidden'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid #e6ebf3',
              background: 'linear-gradient(135deg,#0284c7,#0369a1)', color: '#fff',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                  🧾 TÜRMOB Luca e-Fatura Ayarları
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: 12, opacity: 0.9 }}>
                  turmobefatura.luca.com.tr giriş bilgileri
                </p>
              </div>
              <button
                onClick={() => setLucaModalOpen(false)}
                style={{
                  background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff',
                  padding: '4px 8px', borderRadius: 6, cursor: 'pointer', fontWeight: 800
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{
                background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10,
                padding: '10px 12px', fontSize: 12, color: '#0369a1'
              }}>
                ℹ️ TÜRMOB Luca e-Fatura portalı hesabınızla entegrasyon kurarak kesilmiş faturaları otomatik sorgulayabilirsiniz.
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 5 }}>
                  TCKN (TC Kimlik Numarası) *
                </label>
                <input
                  style={{ ...InputCls, width: '100%' }}
                  placeholder="11 haneli TC Kimlik Numaranız"
                  maxLength={11}
                  value={lucaForm.tckn}
                  onChange={e => setLucaForm({ ...lucaForm, tckn: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                />
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Luca portalına giriş için kullandığınız TC Kimlik No</div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 5 }}>
                  Şifre *
                </label>
                <input
                  style={{ ...InputCls, width: '100%' }}
                  type="password"
                  placeholder="••••••••"
                  value={lucaForm.password}
                  onChange={e => setLucaForm({ ...lucaForm, password: e.target.value })}
                />
              </div>
            </div>

            <div style={{
              padding: '14px 20px', borderTop: '1px solid #e6ebf3',
              background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: 10
            }}>
              <button
                type="button"
                onClick={() => setLucaModalOpen(false)}
                style={{ ...Btn, background: '#fff', color: '#475569', border: '1px solid #cbd5e1' }}
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleSaveLuca}
                style={{
                  ...Btn, background: 'linear-gradient(135deg,#0284c7,#0369a1)',
                  color: '#fff', boxShadow: '0 4px 12px rgba(2,132,199,0.25)'
                }}
              >
                💾 Bilgileri Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fatura Detay Modalı */}
      {detailInv && (() => {
        const inv = detailInv?.invoice || detailInv
        const detailRow = detailInv?.row || null

        return (
          <div
            style={{
              position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 9999, padding: 16
            }}
            onClick={() => setDetailInv(null)}
          >
            <div
              style={{
                background: '#fff', borderRadius: 16, width: 'min(460px, 100%)',
                padding: 20, boxShadow: '0 20px 50px rgba(15,23,42,0.25)'
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>🧾 Fatura Bilgileri</h3>
                <button onClick={() => setDetailInv(null)} style={{ border: 'none', background: 'none', fontSize: 16, cursor: 'pointer' }}>✕</button>
              </div>

              {/* Tutar Uyuşmazlığı Varsa Uyarı Kartı */}
              {detailRow?.hasDiff && (
                <div style={{
                  background: detailRow.isUnderInvoiced ? '#fff7ed' : '#eff6ff',
                  border: `1px solid ${detailRow.isUnderInvoiced ? '#fed7aa' : '#bfdbfe'}`,
                  borderRadius: 12, padding: '12px 14px', fontSize: 12,
                  color: detailRow.isUnderInvoiced ? '#9a3412' : '#1e40af',
                  marginBottom: 14
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 13 }}>
                    <span>⚠️</span>
                    <span>Tutar Uyuşmazlığı Tespit Edildi!</span>
                  </div>
                  <div style={{ marginTop: 6, lineHeight: 1.6 }}>
                    <div>Planlanan Taksit Tutarı: <strong>{money(detailRow.amount)}</strong></div>
                    <div>Luca'da Kesilen Fatura Tutarı: <strong>{money(inv.total)}</strong></div>
                  </div>
                  <div style={{
                    marginTop: 8, padding: '4px 10px', borderRadius: 6,
                    background: detailRow.isUnderInvoiced ? '#ea580c' : '#2563eb',
                    color: '#fff', fontWeight: 800, display: 'inline-block', fontSize: 11
                  }}>
                    {detailRow.isUnderInvoiced
                      ? `⚠️ Fatura ${money(Math.abs(detailRow.diff))} EKSİK Kesilmiş!`
                      : `ℹ️ Fatura ${money(detailRow.diff)} FAZLA Kesilmiş!`}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                <div><strong>Fatura No:</strong> <span style={{ color: '#2563eb', fontWeight: 700 }}>{inv.no}</span></div>
                <div><strong>Tarih:</strong> {inv.date}</div>
                <div><strong>Alıcı:</strong> {inv.buyer || '—'}</div>
                <div><strong>TCKN/VKN:</strong> {inv.taxId || '—'}</div>
                <div><strong>Kalem / Plan:</strong> {inv.planName || 'Genel'} {inv.installmentNo ? `(${inv.installmentNo}. Taksit)` : ''}</div>
                <div><strong>Matrah:</strong> {money(inv.base)}</div>
                <div><strong>KDV:</strong> {money(inv.vat)} (%{inv.vatRate || 10})</div>
                <div><strong>Genel Toplam:</strong> <strong style={{ color: '#0f172a' }}>{money(inv.total)}</strong></div>
                {inv.note && <div><strong>Not:</strong> {inv.note}</div>}
              </div>
              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  onClick={() => handleDeleteInvoice(inv)}
                  style={{ ...Btn, background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', fontSize: 12 }}
                >
                  🗑️ Faturayı Sil / İptal Et
                </button>
                <button onClick={() => setDetailInv(null)} style={{ ...Btn, background: '#f1f5f9', color: '#0f172a' }}>
                  Kapat
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Toast Bildirimi */}
      {toastMsg && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: '#0f172a', color: '#fff', padding: '12px 22px', borderRadius: 14,
          fontWeight: 600, fontSize: 13, zIndex: 99999,
          boxShadow: '0 8px 24px rgba(15,23,42,0.3)'
        }}>{toastMsg}</div>
      )}
    </div>
  )
}
