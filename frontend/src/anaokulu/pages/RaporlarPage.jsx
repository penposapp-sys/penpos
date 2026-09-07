import React, { useState, useMemo } from 'react'
import { useAnaokuluData } from '../context/AnaokuluDataContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import TopluAlacakRaporu from './TopluAlacakRaporu.jsx'
import {
  money, getStudent, expectedFor, expectedTotalFor, collectedAll,
  balanceFor, invStatus, invoiceFor, periodsOfYear, periodName,
  inPeriod, periodLabel, exportCSV, round2, getYearStart, isCollectionInvoiced
} from '../utils/calculations.js'

const Btn = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 14px', borderRadius: 10, fontWeight: 600,
  cursor: 'pointer', border: 'none', fontSize: 13
}

const InputCls = {
  padding: '9px 12px', borderRadius: 10,
  border: '1px solid #cbd5e1', background: '#fff',
  fontSize: 13, outline: 'none'
}

export default function RaporlarPage() {
  const { user, isRegionAdmin } = useAuth()
  const isManager = isRegionAdmin || user?.role === 'superadmin' || user?.role === 'platform_admin'
  const [reportTab, setReportTab] = useState('single')

  const { state } = useAnaokuluData()
  const students = state?.students || []
  const collections = state?.collections || []
  const invoices = state?.invoices || []
  const ys = getYearStart(state)

  const [periodType, setPeriodType] = useState('month')
  const [rdate, setRdate] = useState(() => new Date().toISOString().slice(0, 10))
  const [toastMsg, setToastMsg] = useState('')

  const toast = (m) => { setToastMsg(m); setTimeout(() => setToastMsg(''), 3000) }

  const data = useMemo(() => {
    const a = collections.filter(c => inPeriod(c.date, rdate, periodType))
    const totalAmount = a.reduce((x, c) => x + (c.amount || 0), 0)
    const totalVat = a.reduce((x, c) => {
      const inv = isCollectionInvoiced(state, c)
      return x + (inv ? (c.vat || 0) : 0)
    }, 0)
    const count = a.length

    const typeMap = {}
    a.forEach(c => {
      const t = c.payment || 'Diğer'
      if (!typeMap[t]) typeMap[t] = { n: 0, amount: 0, vat: 0 }
      typeMap[t].n++
      typeMap[t].amount += (c.amount || 0)
      const inv = isCollectionInvoiced(state, c)
      typeMap[t].vat += (inv ? (c.vat || 0) : 0)
    })
    const types = Object.keys(typeMap).map(t => ({ type: t, ...typeMap[t] }))

    const months = (periodType === 'month') ? [rdate.slice(0, 7)] : periodsOfYear(ys)
    let ok = 0, none = 0, diff = 0, expSum = 0, invSum = 0
    months.forEach(m => {
      students.filter(s => s.active).forEach(s => {
        const e = expectedFor(state, s.id, m)
        if (e <= 0) return
        expSum += e
        const stt = invStatus(state, s.id, m)
        if (stt === 'ok') { ok++; invSum += (invoiceFor(state, s.id, m)?.total || 0) }
        else if (stt === 'diff') { diff++; invSum += (invoiceFor(state, s.id, m)?.total || 0) }
        else none++
      })
    })

    const stuRows = students.slice()
      .sort((x, y) => balanceFor(state, y.id) - balanceFor(state, x.id))
      .map(s => {
        const exp = expectedTotalFor(state, s.id)
        const col = collectedAll(state, s.id)
        const bal = round2(exp - col)
        const pct = exp > 0 ? Math.min(100, Math.round(col / exp * 100)) : 0
        return { s, exp, col, bal, pct }
      })

    return { totalAmount, totalVat, count, types, ok, none, diff, expSum, invSum, stuRows }
  }, [state, students, collections, invoices, periodType, rdate, ys])

  const panel = {
    background: '#fff', borderRadius: 14, border: '1px solid #e6ebf3',
    boxShadow: '0 1px 2px rgba(15,23,42,0.04)', overflow: 'hidden'
  }
  const miniBox = {
    padding: '14px 18px', borderRadius: 12,
    background: '#fff', border: '1px solid #e2e8f0'
  }
  const th = {
    padding: '10px 12px', fontSize: 12, fontWeight: 700, color: '#475569',
    background: '#f8fafc', borderBottom: '1px solid #e6ebf3', textAlign: 'left'
  }
  const td = {
    padding: '10px 12px', fontSize: 13, borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle'
  }
  const tbl = { width: '100%', borderCollapse: 'collapse' }
  const sect = {
    fontSize: 14, fontWeight: 700, color: '#0f172a', margin: '22px 0 10px 0'
  }
  const emptyRow = (n) => (
    <tr><td colSpan={n} style={{ ...td, textAlign: 'center', color: '#94a3b8', padding: '24px 12px' }}>
      Bu dönem için kayıt bulunamadı.
    </td></tr>
  )

  return (
    <div>
      {/* Süper Admin Sekmeleri */}
      {isManager && (
        <div style={{ display: 'flex', gap: 10, borderBottom: '2px solid #e2e8f0', marginBottom: 20, paddingBottom: 0 }}>
          <button
            type="button"
            onClick={() => setReportTab('single')}
            style={{
              padding: '11px 18px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 800,
              background: 'transparent', borderRadius: '10px 10px 0 0',
              borderBottom: reportTab === 'single' ? '3px solid #6366f1' : '3px solid transparent',
              color: reportTab === 'single' ? '#6366f1' : '#64748b',
              marginBottom: -2, display: 'inline-flex', alignItems: 'center', gap: 6
            }}
          >
            🏫 Seçili Okul Raporu
          </button>
          <button
            type="button"
            onClick={() => setReportTab('all-schools-debt')}
            style={{
              padding: '11px 18px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 800,
              background: 'transparent', borderRadius: '10px 10px 0 0',
              borderBottom: reportTab === 'all-schools-debt' ? '3px solid #6366f1' : '3px solid transparent',
              color: reportTab === 'all-schools-debt' ? '#6366f1' : '#64748b',
              marginBottom: -2, display: 'inline-flex', alignItems: 'center', gap: 6
            }}
          >
            🌐 Tüm Okullar Öğrenci Alacak Raporu (Excel)
          </button>
        </div>
      )}

      {isManager && reportTab === 'all-schools-debt' ? (
        <TopluAlacakRaporu />
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ margin: '0 0 4px 0', fontSize: 24, color: '#0f172a' }}>📊 Raporlar</h2>
              <p style={{ margin: 0, color: '#475569', fontSize: 14 }}>
                Günlük / haftalık / aylık / yıllık tahsilat, KDV ve fatura raporları
              </p>
            </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => {
            const n = exportCSV(state, periodType, rdate)
            toast(`CSV indirildi (${n} kayıt).`)
          }} style={{
            ...Btn, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff',
            boxShadow: '0 4px 12px rgba(99,102,241,0.25)'
          }}>⬇ CSV indir</button>
          <button onClick={() => window.print()} style={{
            ...Btn, background: '#f1f5f9', color: '#0f172a'
          }}>🖨 Yazdır / PDF</button>
        </div>
      </div>

      <div style={{
        ...panel, marginBottom: 16, padding: '14px 16px',
        display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center'
      }}>
        <select style={{ ...InputCls, minWidth: 160, fontWeight: 600 }} value={periodType}
          onChange={e => setPeriodType(e.target.value)}>
          <option value="day">Günlük</option>
          <option value="week">Haftalık</option>
          <option value="month">Aylık</option>
          <option value="year">Yıllık</option>
          <option value="all">Tüm zamanlar</option>
        </select>
        <input type="date" style={InputCls} value={rdate} onChange={e => setRdate(e.target.value)} />
        <span style={{ fontSize: 12, color: '#64748b', marginLeft: 8 }}>
          <b style={{ color: '#0f172a' }}>{periodLabel(periodType)}</b> dönemi · {rdate}
        </span>
      </div>

      <div style={{
        padding: '12px 18px', background: '#fff', borderRadius: 14,
        border: '1px solid #e6ebf3', marginBottom: 16
      }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12
        }}>
          <div style={miniBox}>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Brüt Tahsilat</div>
            <b style={{ fontSize: 20, color: '#0f172a' }}>{money(data.totalAmount)}</b>
          </div>
          <div style={{ ...miniBox, background: 'linear-gradient(135deg,#fffbeb,#fef3c7)', borderColor: '#fde68a' }}>
            <div style={{ fontSize: 11, color: '#92400e', fontWeight: 600 }}>KDV Tutarı</div>
            <b style={{ fontSize: 20, color: '#92400e' }}>{money(data.totalVat)}</b>
          </div>
          <div style={{ ...miniBox, background: 'linear-gradient(135deg,#ecfdf5,#d1fae5)', borderColor: '#a7f3d0' }}>
            <div style={{ fontSize: 11, color: '#065f46', fontWeight: 600 }}>KDV Hariç (Matrah)</div>
            <b style={{ fontSize: 20, color: '#065f46' }}>{money(data.totalAmount - data.totalVat)}</b>
          </div>
          <div style={{ ...miniBox, background: 'linear-gradient(135deg,#eef2ff,#e0e7ff)', borderColor: '#c7d2fe' }}>
            <div style={{ fontSize: 11, color: '#3730a3', fontWeight: 600 }}>İşlem Sayısı</div>
            <b style={{ fontSize: 20, color: '#3730a3' }}>{data.count}</b>
          </div>
        </div>
      </div>

      <div style={panel}>
        <div style={{ padding: '18px 20px', overflow: 'auto' }}>
          <h3 style={sect}>Ödeme türüne göre</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={tbl}>
              <thead>
                <tr>
                  <th style={th}>Ödeme Türü</th>
                  <th style={{ ...th, textAlign: 'right' }}>İşlem</th>
                  <th style={{ ...th, textAlign: 'right' }}>Brüt</th>
                  <th style={{ ...th, textAlign: 'right' }}>KDV</th>
                  <th style={{ ...th, textAlign: 'right' }}>KDV Hariç</th>
                </tr>
              </thead>
              <tbody>
                {data.types.length === 0 ? emptyRow(5) : data.types.map(t => (
                  <tr key={t.type}>
                    <td style={{ ...td, fontWeight: 600 }}>{t.type}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{t.n}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{money(t.amount)}</td>
                    <td style={{ ...td, textAlign: 'right', color: '#b45309' }}>{money(t.vat)}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{money(t.amount - t.vat)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 style={sect}>Seçili dönem fatura durumu</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={tbl}>
              <thead>
                <tr>
                  <th style={th}>Durum</th>
                  <th style={{ ...th, textAlign: 'right' }}>Öğrenci Sayısı</th>
                  <th style={{ ...th, textAlign: 'right' }}>Beklenen</th>
                  <th style={{ ...th, textAlign: 'right' }}>Fatura Tutarı</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={td}>
                    <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: '#dcfce7', color: '#166534' }}>
                      🟢 Kesildi
                    </span>
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: '#166534' }}>{data.ok}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{money(data.expSum)}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{money(data.invSum)}</td>
                </tr>
                <tr>
                  <td style={td}>
                    <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: '#fef3c7', color: '#92400e' }}>
                      🟡 Tutar farklı
                    </span>
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: '#92400e' }}>{data.diff}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{money(data.expSum)}</td>
                  <td style={{ ...td, textAlign: 'right' }}>—</td>
                </tr>
                <tr>
                  <td style={td}>
                    <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: '#fee2e2', color: '#991b1b' }}>
                      🔴 Kesilmedi
                    </span>
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: '#991b1b' }}>{data.none}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{money(data.expSum)}</td>
                  <td style={{ ...td, textAlign: 'right' }}>—</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 style={sect}>Öğrenci bazlı özet (en yüksek bakiye önce)</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={tbl}>
              <thead>
                <tr>
                  <th style={th}>Öğrenci</th>
                  <th style={th}>Sınıf</th>
                  <th style={{ ...th, textAlign: 'right' }}>Planlanan</th>
                  <th style={{ ...th, textAlign: 'right' }}>Tahsil Edilen</th>
                  <th style={{ ...th, textAlign: 'right' }}>Kalan Bakiye</th>
                  <th style={{ ...th, minWidth: 180 }}>Tamamlanma</th>
                </tr>
              </thead>
              <tbody>
                {data.stuRows.length === 0 ? emptyRow(6) : data.stuRows.map(({ s, exp, col, bal, pct }) => (
                  <tr key={String(s.id)}>
                    <td style={{ ...td, fontWeight: 700 }}>{s.name}</td>
                    <td style={td}>{s.class || '-'}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{money(exp)}</td>
                    <td style={{ ...td, textAlign: 'right', color: '#047857' }}>{money(col)}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: bal > 0 ? '#b91c1c' : '#047857' }}>
                      {money(bal)}
                    </td>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#334155', minWidth: 40 }}>{pct}%</span>
                        <div style={{
                          flex: 1, height: 10, background: '#e2e8f0',
                          borderRadius: 999, overflow: 'hidden'
                        }}>
                          <div style={{
                            width: pct + '%', height: '100%',
                            background: pct === 100
                              ? 'linear-gradient(90deg,#10b981,#059669)'
                              : pct >= 70
                                ? 'linear-gradient(90deg,#6366f1,#8b5cf6)'
                                : pct >= 30
                                  ? 'linear-gradient(90deg,#f59e0b,#d97706)'
                                  : 'linear-gradient(90deg,#ef4444,#dc2626)',
                            borderRadius: 999, transition: 'width 0.3s'
                          }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
        </>
      )}

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
