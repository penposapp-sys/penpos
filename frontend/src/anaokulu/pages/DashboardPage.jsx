import React from 'react'
import { useAnaokuluData } from '../context/AnaokuluDataContext.jsx'
import { money, trDate, periodName, getDashboardStats, getStudent } from '../utils/calculations.js'

export default function DashboardPage() {
  const { state } = useAnaokuluData()
  const stats = getDashboardStats(state)
  const students = state?.students || []
  const loaded = state?.loaded

  const cardWrap = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
    gap: 14,
    marginBottom: 18
  }
  const kpi = (label, val, sub, color, subColor) => ({
    padding: '18px 20px',
    borderRadius: 14,
    background: '#fff',
    boxShadow: '0 1px 2px rgba(15,23,42,0.05), 0 2px 8px rgba(15,23,42,0.04)',
    border: '1px solid #e6ebf3'
  })
  const panel = {
    background: '#fff',
    borderRadius: 14,
    border: '1px solid #e6ebf3',
    padding: 16,
    marginBottom: 18,
    boxShadow: '0 1px 2px rgba(15,23,42,0.04)'
  }
  const th = {
    textAlign: 'left',
    padding: '10px 12px',
    fontSize: 12,
    fontWeight: 600,
    color: '#475569',
    background: '#f8fafc',
    borderBottom: '1px solid #e6ebf3'
  }
  const td = {
    padding: '10px 12px',
    fontSize: 13,
    color: '#0f172a',
    borderBottom: '1px solid #f1f5f9'
  }
  const table = { width: '100%', borderCollapse: 'collapse' }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: '0 0 4px 0', fontSize: 24, color: '#0f172a' }}>🏠 Genel Bakış</h2>
        <p style={{ margin: 0, color: '#475569', fontSize: 14 }}>
          {loaded ? `${students.length} öğrenci kayıtlı · ${stats.currentPeriodName} dönemi aktif` : 'Veriler yükleniyor...'}
        </p>
      </div>

      <div style={cardWrap}>
        <div style={kpi()}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6, fontWeight: 500 }}>Aktif Öğrenci</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a' }}>{stats.activeCount}</div>
        </div>
        <div style={kpi()}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6, fontWeight: 500 }}>Planlanan Tahsilat</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#6366f1' }}>{money(stats.planned)}</div>
        </div>
        <div style={kpi()}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6, fontWeight: 500 }}>Tahsil Edilen</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#10b981' }}>{money(stats.collected)}</div>
        </div>
        <div style={kpi()}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6, fontWeight: 500 }}>Kalan Bakiye</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: stats.remaining > 0 ? '#ef4444' : '#10b981' }}>
            {money(stats.remaining)}
          </div>
        </div>
      </div>

      <div style={{ ...cardWrap, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        <div style={panel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>Bu Ay Tahsilat</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>{money(stats.currentMonthCollected)}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Dönem: {stats.currentPeriodName}</div>
            </div>
            <div style={{ fontSize: 26 }}>📅</div>
          </div>
        </div>

        <div style={{ ...panel, padding: 0, overflow: 'hidden' }}>
          <div style={{
            padding: '14px 18px', borderBottom: '1px solid #e6ebf3',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Son Tahsilatlar</h3>
            <span style={{ fontSize: 12, color: '#64748b' }}>son 6 kayıt</span>
          </div>
          <div style={{ maxHeight: 260, overflow: 'auto' }}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Tarih</th>
                  <th style={th}>Öğrenci</th>
                  <th style={th}>Kalem</th>
                  <th style={th}>Tutar</th>
                  <th style={th}>Ödeme</th>
                </tr>
              </thead>
              <tbody>
                {stats.recent.length === 0 ? (
                  <tr><td colSpan={5} style={{ ...td, textAlign: 'center', color: '#94a3b8', padding: '24px 12px' }}>
                    Henüz tahsilat yok.
                  </td></tr>
                ) : stats.recent.map(c => {
                  const s = getStudent(state, c.studentId)
                  return (
                    <tr key={c.id || c._id || c.date + c.studentId}>
                      <td style={td}>{trDate(c.date)}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{s?.name || '-'}</td>
                      <td style={td}>{c.item || '-'}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{money(c.amount)}</td>
                      <td style={td}>{c.payment || '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div style={panel}>
        <h3 style={{ margin: '0 0 14px 0', fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
          📋 {stats.currentPeriodName} Fatura Durumu
        </h3>
        <div style={cardWrap}>
          <div style={{
            padding: '16px 18px', borderRadius: 12,
            background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)',
            border: '1px solid #a7f3d0'
          }}>
            <div style={{ fontSize: 12, color: '#065f46', fontWeight: 600, marginBottom: 6 }}>🟢 Faturası Kesildi</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#065f46' }}>{stats.invoiceOk}</div>
          </div>
          <div style={{
            padding: '16px 18px', borderRadius: 12,
            background: 'linear-gradient(135deg, #fef2f2, #fee2e2)',
            border: '1px solid #fecaca'
          }}>
            <div style={{ fontSize: 12, color: '#991b1b', fontWeight: 600, marginBottom: 6 }}>🔴 Kesilmedi</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#991b1b' }}>{stats.invoiceNone}</div>
          </div>
          <div style={{
            padding: '16px 18px', borderRadius: 12,
            background: 'linear-gradient(135deg, #fffbeb, #fef3c7)',
            border: '1px solid #fde68a'
          }}>
            <div style={{ fontSize: 12, color: '#92400e', fontWeight: 600, marginBottom: 6 }}>🟡 Tutar Farklı</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#92400e' }}>{stats.invoiceDiff}</div>
          </div>
          <div style={{
            padding: '16px 18px', borderRadius: 12,
            background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
            border: '1px solid #bfdbfe'
          }}>
            <div style={{ fontSize: 12, color: '#1e40af', fontWeight: 600, marginBottom: 6 }}>Toplam Beklenen</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#1e40af' }}>{money(stats.invoiceExpected)}</div>
          </div>
        </div>
        <div style={{ marginTop: 12, padding: '12px 16px', background: '#f8fafc', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#475569' }}>
            🕓 Son fatura kontrol tarihi: <b style={{ color: '#0f172a' }}>{stats.lastCheckDate}</b>
          </span>
          <span style={{ fontSize: 13, color: '#94a3b8' }}>
            Faturalar sekmesinden <b>↻ Faturaları Kontrol Et</b> butonuyla yenileyin
          </span>
        </div>
      </div>
    </div>
  )
}
