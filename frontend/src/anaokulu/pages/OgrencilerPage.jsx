import React, { useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useAnaokuluData } from '../context/AnaokuluDataContext.jsx'
import {
  money, trDate, expectedTotalFor, balanceFor, getStudent,
  collectedAll, expectedFor, collectedFor, invStatus, invoiceFor,
  periodName, periodsOfYear, getYearStart, planTableFor
} from '../utils/calculations.js'

const Btn = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 14px', borderRadius: 10, fontWeight: 600,
  cursor: 'pointer', border: 'none', fontSize: 13,
  transition: 'all 0.15s ease'
}

const InputCls = {
  padding: '9px 12px', borderRadius: 10,
  border: '1px solid #cbd5e1', background: '#fff',
  fontSize: 13, outline: 'none'
}

export default function OgrencilerPage() {
  const { isAdminPanelMode } = useAuth()
  const { state, actions } = useAnaokuluData()
  const students = state?.students || []
  const ys = getYearStart(state)

  const [q, setQ] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(null)
  const [toastMsg, setToastMsg] = useState('')

  const classes = useMemo(() => [...new Set(students.map(s => s.class).filter(Boolean))], [students])

  const list = useMemo(() => {
    const needle = q.toLowerCase()
    return students.filter(s => {
      const hitSearch = ((s.name || '') + ' ' + (s.parent || '')).toLowerCase().includes(needle)
      const hitClass = !classFilter || s.class === classFilter
      const hitStatus = statusFilter === '' || String(Number(s.active)) === statusFilter
      return hitSearch && hitClass && hitStatus
    })
  }, [students, q, classFilter, statusFilter])

  const toast = (m) => {
    setToastMsg(m)
    setTimeout(() => setToastMsg(''), 2800)
  }

  const openForm = (s = null) => {
    if (s) {
      setForm({
        id: s.id,
        name: s.name || '',
        class: s.class || '',
        parent: s.parent || '',
        phone: s.phone || '',
        tax: s.tax || '',
        regDate: s.regDate || new Date().toISOString().slice(0, 10),
        address: s.address || '',
        note: s.note || '',
        active: s.active !== false,
        invoiced: s.invoiced !== false
      })
      setModal('form')
    } else {
      setForm({
        id: null,
        name: '',
        class: '',
        parent: '',
        phone: '',
        tax: '',
        regDate: new Date().toISOString().slice(0, 10),
        address: '',
        note: '',
        active: true,
        invoiced: true
      })
      setModal('form')
    }
  }

  const buildStudentData = () => ({
    name: form.name.trim(),
    class: (form.class || '').trim(),
    parent: (form.parent || '').trim(),
    phone: (form.phone || '').trim(),
    tax: (form.tax || '').trim(),
    regDate: form.regDate,
    address: (form.address || '').trim(),
    note: (form.note || '').trim(),
    active: !!form.active,
    invoiced: form.invoiced !== false
  })

  const saveForm = () => {
    if (!form.name || !form.name.trim()) { toast('Ad Soyad zorunlu.'); return }
    const data = buildStudentData()
    if (form.id) {
      actions.updateStudent({ id: form.id, ...data })
      toast('Öğrenci güncellendi.')
    } else {
      actions.addStudent({ ...data })
      toast('Öğrenci kaydedildi.')
    }
    setModal(null); setForm(null)
  }

  const saveFormAndNew = () => {
    if (!form.name || !form.name.trim()) { toast('Ad Soyad zorunlu.'); return }
    const data = buildStudentData()
    actions.addStudent({ ...data })
    toast('Kaydedildi. Yeni öğrenci formu hazır.')
    setForm({
      id: null,
      name: '',
      class: '',
      parent: '',
      phone: '',
      tax: '',
      regDate: new Date().toISOString().slice(0, 10),
      address: '',
      note: '',
      active: true,
      invoiced: true
    })
  }

  const handleDelete = (id) => {
    if (!window.confirm('Bu öğrenciyi ve ilişkili tüm tahsilat/faturaları silmek istediğinize emin misiniz?')) return
    const nextStudents = state.students.filter(s => String(s.id || s._id) !== String(id))
    const nextCollections = state.collections.filter(c => String(c.studentId) !== String(id))
    const nextInvoices = state.invoices.filter(i => String(i.studentId) !== String(id))
    actions.replaceAll({
      students: nextStudents,
      collections: nextCollections,
      invoices: nextInvoices
    })
    toast('Öğrenci silindi.')
  }

  const openFile = (id) => {
    setModal('file')
    setForm({ ...form, id })
  }

  const renderForm = () => {
    const field = (lbl, comp) => (
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 12, color: '#475569', fontWeight: 600, display: 'block', marginBottom: 6 }}>{lbl}</label>
        {comp}
      </div>
    )
    return (
      <div style={{ padding: '12px 4px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          {field('Ad Soyad *', (
            <input style={{ ...InputCls, width: '100%' }} value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ad Soyad" />
          ))}
          {field('Sınıf', (
            <input style={{ ...InputCls, width: '100%' }} value={form.class}
              onChange={e => setForm({ ...form, class: e.target.value })} placeholder="örn: 4-A" />
          ))}
          {field('Veli Ad Soyad', (
            <input style={{ ...InputCls, width: '100%' }} value={form.parent}
              onChange={e => setForm({ ...form, parent: e.target.value })} />
          ))}
          {field('Telefon', (
            <input style={{ ...InputCls, width: '100%' }} value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })} />
          ))}
          {field('TC / VKN', (
            <input style={{ ...InputCls, width: '100%' }} value={form.tax}
              onChange={e => setForm({ ...form, tax: e.target.value })} />
          ))}
          {field('Kayıt Tarihi', (
            <input style={{ ...InputCls, width: '100%' }} type="date" value={form.regDate}
              onChange={e => setForm({ ...form, regDate: e.target.value })} />
          ))}
          {field('Durum', (
            <select style={{ ...InputCls, width: '100%' }} value={form.active ? '1' : '0'}
              onChange={e => setForm({ ...form, active: e.target.value === '1' })}>
              <option value="1">Aktif</option>
              <option value="0">Pasif</option>
            </select>
          ))}
          {field('Fatura Durumu', (
            <select style={{ ...InputCls, width: '100%', fontWeight: 700 }} value={form.invoiced !== false ? '1' : '0'}
              onChange={e => setForm({ ...form, invoiced: e.target.value === '1' })}>
              <option value="1">🟢 Faturalı (Faturalar sayfasına yansır)</option>
              <option value="0">⚪ Faturasız (Faturalar sayfasına yansımaz)</option>
            </select>
          ))}
        </div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: -4, marginBottom: 12 }}>
          ℹ️ Faturasız seçildiğinde bu öğrencinin hiçbir tahsilatı Faturalar sayfasında görünmez.
        </div>
        {field('Adres', (
          <input style={{ ...InputCls, width: '100%' }} value={form.address}
            onChange={e => setForm({ ...form, address: e.target.value })} />
        ))}
        {field('Not', (
          <input style={{ ...InputCls, width: '100%' }} value={form.note}
            onChange={e => setForm({ ...form, note: e.target.value })} />
        ))}
      </div>
    )
  }

  const [fileTab, setFileTab] = useState('info')

  const renderFile = () => {
    const s = getStudent(state, form?.id)
    if (!s) return <div style={{ padding: 24, color: '#94a3b8' }}>Öğrenci bulunamadı.</div>
    const exp = expectedTotalFor(state, s.id)
    const col = collectedAll(state, s.id)
    const bal = exp - col
    const tab = {
      padding: '8px 14px', fontSize: 13, border: 'none', background: 'transparent',
      cursor: 'pointer', fontWeight: 600, color: '#64748b',
      borderBottom: '2px solid transparent'
    }
    const tabA = { ...tab, color: '#6366f1', borderBottom: '2px solid #6366f1' }
    const rowLine = {
      display: 'grid', gridTemplateColumns: '160px 1fr',
      borderBottom: '1px solid #f1f5f9', padding: '9px 0'
    }
    const th = {
      padding: '8px 10px', fontSize: 12, fontWeight: 600, color: '#475569',
      background: '#f8fafc', borderBottom: '1px solid #e6ebf3', textAlign: 'left'
    }
    const td = { padding: '8px 10px', fontSize: 13, borderBottom: '1px solid #f1f5f9' }
    const tbl = { width: '100%', borderCollapse: 'collapse' }

    let body = null
    if (fileTab === 'info') {
      body = (
        <div style={{ maxWidth: 560 }}>
          {[
            ['Sınıf', s.class || '-'],
            ['Veli', s.parent || '-'],
            ['Telefon', s.phone || '-'],
            ['TC/VKN', s.tax || '-'],
            ['Kayıt Tarihi', trDate(s.regDate)],
            ['Adres', s.address || '-'],
            ['Not', s.note || '-'],
            ['Durum', s.active ? 'Aktif' : 'Pasif'],
            ['Fatura Durumu', s.invoiced !== false ? '🟢 Faturalı (Faturalar sayfasına yansır)' : '⚪ Faturasız (Faturalar sayfasına yansımaz)']
          ].map(([k, v]) => (
            <div key={k} style={rowLine}>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{k}</div>
              <div style={{ fontSize: 13, color: '#0f172a', fontWeight: 500 }}>{v}</div>
            </div>
          ))}
        </div>
      )
    } else if (fileTab === 'plan') {
      const pt = planTableFor(state, s)
      body = (
        <div style={{ overflow: 'auto' }}>
          <table style={tbl}>
            <thead>
              <tr>
                <th style={{ ...th, minWidth: 200 }}>Kalem</th>
                {pt.periods.map(p => (
                  <th key={p} style={{ ...th, textAlign: 'center', minWidth: 70 }}>{periodName(p).slice(0, 3)}</th>
                ))}
                <th style={{ ...th, textAlign: 'right' }}>Toplam</th>
              </tr>
            </thead>
            <tbody>
              {pt.rows.map((r, ri) => (
                <tr key={ri}>
                  <td style={td}>
                    <b>{r.item.name}</b>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{r.item.installments} taksit · {money(r.perMonth)}/ay</div>
                  </td>
                  {r.months.map((m, mi) => (
                    <td key={mi} style={{ ...td, textAlign: 'center', color: m ? '#0f172a' : '#cbd5e1' }}>
                      {m ? money(m) : '·'}
                    </td>
                  ))}
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{money(r.item.total)}</td>
                </tr>
              ))}
              <tr style={{ background: '#f4f6fb' }}>
                <td style={{ ...td, fontWeight: 700 }}>Aylık Toplam</td>
                {pt.monthTotals.map((m, mi) => (
                  <td key={mi} style={{ ...td, textAlign: 'center', fontWeight: 700 }}>{money(m)}</td>
                ))}
                <td style={{ ...td, textAlign: 'right', fontWeight: 800 }}>{money(pt.totalExpected)}</td>
              </tr>
              <tr>
                <td style={{ ...td, fontWeight: 600, color: '#14966f' }}>Tahsil Edilen</td>
                {pt.monthCollected.map((m, mi) => (
                  <td key={mi} style={{ ...td, textAlign: 'center', color: '#14966f', fontWeight: 600 }}>
                    {m > 0 ? money(m) : '·'}
                  </td>
                ))}
                <td style={{ ...td, textAlign: 'right', color: '#14966f', fontWeight: 800 }}>{money(pt.totalCollected)}</td>
              </tr>
              <tr>
                <td style={{ ...td, fontWeight: 600, color: bal > 0 ? '#e74c3c' : '#14966f' }}>Kalan</td>
                {pt.monthRemaining.map((m, mi) => (
                  <td key={mi} style={{
                    ...td, textAlign: 'center', fontWeight: 600,
                    color: m > 0 ? '#e74c3c' : (m === 0 ? '#14966f' : '#0f172a')
                  }}>{m !== 0 ? money(m) : '✓'}</td>
                ))}
                <td style={{
                  ...td, textAlign: 'right', fontWeight: 800,
                  color: pt.totalRemaining > 0 ? '#e74c3c' : '#14966f'
                }}>{money(pt.totalRemaining)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )
    } else if (fileTab === 'coll') {
      const rows = (state.collections || []).filter(c => String(c.studentId) === String(s.id))
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      body = (
        <div style={{ overflow: 'auto' }}>
          <table style={tbl}>
            <thead>
              <tr>
                <th style={th}>Tarih</th>
                <th style={th}>Kalem</th>
                <th style={th}>Tutar</th>
                <th style={th}>Ödeme</th>
                <th style={th}>Fatura No</th>
                <th style={th}>Açıklama</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6} style={{ ...td, textAlign: 'center', color: '#94a3b8', padding: '20px 12px' }}>Henüz tahsilat yok.</td></tr>
              ) : rows.map(c => (
                <tr key={c.id || c._id}>
                  <td style={td}>{trDate(c.date)}</td>
                  <td style={td}>{c.item || '-'}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{money(c.amount)}</td>
                  <td style={td}>{c.payment || '-'}</td>
                  <td style={td}>{c.invoiceNo || '—'}</td>
                  <td style={td}>{c.note || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    } else if (fileTab === 'inv') {
      const ps = periodsOfYear(ys)
      body = (
        <div style={{ overflow: 'auto' }}>
          <table style={tbl}>
            <thead>
              <tr>
                <th style={th}>Dönem</th>
                <th style={th}>Beklenen</th>
                <th style={th}>Fatura</th>
                <th style={th}>Durum</th>
              </tr>
            </thead>
            <tbody>
              {ps.map(p => {
                const e = expectedFor(state, s.id, p)
                const stt = invStatus(state, s.id, p)
                const inv = invoiceFor(state, s.id, p)
                const badge = stt === 'ok' ? <span style={statusOk}>🟢 Kesildi</span>
                  : stt === 'diff' ? <span style={statusWait}>🟡 Tutar farklı</span>
                    : stt === 'none' ? <span style={statusBad}>🔴 Kesilmedi</span>
                      : <span style={{ color: '#94a3b8' }}>—</span>
                return (
                  <tr key={p}>
                    <td style={td}>{periodName(p)}</td>
                    <td style={td}>{money(e)}</td>
                    <td style={td}>{inv ? `${inv.no} · ${money(inv.total)}` : '—'}</td>
                    <td style={td}>{badge}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )
    }

    return (
      <div>
        <div className="ak-stats-grid" style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12,
          padding: 14, marginBottom: 14, background: '#f8fafc', borderRadius: 12
        }}>
          <div style={{ padding: 10 }}>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Toplam Borç</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>{money(exp)}</div>
          </div>
          <div style={{ padding: 10 }}>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Tahsil Edilen</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#10b981' }}>{money(col)}</div>
          </div>
          <div style={{ padding: 10 }}>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Kalan Bakiye</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: bal > 0 ? '#ef4444' : '#10b981' }}>{money(bal)}</div>
            <div style={{ marginTop: 6, height: 6, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: (exp > 0 ? Math.min(100, Math.round(col / exp * 100)) : 0) + '%',
                background: 'linear-gradient(90deg,#10b981,#34d399)', borderRadius: 4
              }} />
            </div>
          </div>
        </div>
        <div className="ak-tab-bar" style={{ borderBottom: '1px solid #e6ebf3', marginBottom: 16, display: 'flex' }}>
          {[
            ['info', 'Bilgiler'],
            ['plan', 'Taksit Planı'],
            ['coll', 'Tahsilatlar'],
            ['inv', 'Faturalar']
          ].map(([k, v]) => (
            <button key={k} style={fileTab === k ? tabA : tab} onClick={() => setFileTab(k)}>{v}</button>
          ))}
        </div>
        {body}
      </div>
    )
  }

  const statusOk = {
    display: 'inline-block', padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
    background: '#dcfce7', color: '#166534'
  }
  const statusBad = {
    display: 'inline-block', padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
    background: '#fee2e2', color: '#991b1b'
  }
  const statusWait = {
    display: 'inline-block', padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
    background: '#fef3c7', color: '#92400e'
  }

  const panel = {
    background: '#fff', borderRadius: 14, border: '1px solid #e6ebf3', overflow: 'hidden',
    boxShadow: '0 1px 2px rgba(15,23,42,0.04)'
  }
  const th = {
    textAlign: 'left', padding: '12px 14px', fontSize: 12, fontWeight: 700, color: '#475569',
    background: '#f8fafc', borderBottom: '1px solid #e6ebf3'
  }
  const td = {
    padding: '12px 14px', fontSize: 13, color: '#0f172a', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle'
  }
  const table = { width: '100%', borderCollapse: 'collapse' }

  return (
    <div>
      <div className="ak-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: 24, color: '#0f172a' }}>👥 Öğrenciler</h2>
          <p style={{ margin: 0, color: '#475569', fontSize: 14 }}>
            {isAdminPanelMode
              ? `Süper Admin Paneli · Tüm okullar: ${students.length} öğrenci · ${list.length} listeleniyor`
              : `${students.length} öğrenci · ${list.length} listeleniyor`}
          </p>
        </div>
        {!isAdminPanelMode && (
          <div className="ak-actions">
            <button onClick={() => openForm(null)} style={{
              ...Btn, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff',
              boxShadow: '0 4px 12px rgba(99,102,241,0.25)'
            }}>
              <span style={{ fontSize: 16 }}>+</span> Yeni Öğrenci
            </button>
          </div>
        )}
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
            Süper Admin Paneli modundasınız. Bu görünüm tüm okulların öğrencilerini birleştirerek listeler.
            Değişiklik yapmak için üstten bir okul seçiniz.
          </div>
        </div>
      )}

      <div className="ak-panel ak-filter-bar" style={{
        ...panel, marginBottom: 16, padding: '14px 16px',
        display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center'
      }}>
        <input style={{ ...InputCls, flex: '1 1 240px', minWidth: 200 }}
          placeholder="Öğrenci / veli ara..." value={q} onChange={e => setQ(e.target.value)} />
        <select style={{ ...InputCls, minWidth: 150 }} value={classFilter} onChange={e => setClassFilter(e.target.value)}>
          <option value="">Tüm Sınıflar</option>
          {classes.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select style={{ ...InputCls, minWidth: 140 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">Tüm Durumlar</option>
          <option value="1">Aktif</option>
          <option value="0">Pasif</option>
        </select>
      </div>

      <div className="ak-panel" style={panel}>
        <div className="ak-table-wrap" style={{ overflow: 'auto' }}>
          <table style={table}>
            <thead>
              <tr>
                {isAdminPanelMode && <th style={th}>🏫 Okul</th>}
                <th style={th}>Öğrenci</th>
                <th style={th}>Sınıf</th>
                <th style={th}>Veli</th>
                <th style={th}>Telefon</th>
                <th style={th}>TC/VKN</th>
                <th style={{ ...th, textAlign: 'right' }}>Planlanan</th>
                <th style={{ ...th, textAlign: 'right' }}>Kalan</th>
                <th style={th}>Durum</th>
                <th style={{ ...th, minWidth: isAdminPanelMode ? 120 : 240 }}>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr><td colSpan={isAdminPanelMode ? 10 : 9} style={{ ...td, textAlign: 'center', color: '#94a3b8', padding: '40px 12px' }}>
                  Henüz öğrenci yok. {!isAdminPanelMode ? 'Sağ üstten "Yeni Öğrenci" ekleyin.' : ''}
                </td></tr>
              ) : list.map(s => {
                const bal = balanceFor(state, s.id)
                return (
                  <tr key={String(s.id || s._id)} style={{ transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fafbff'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    {isAdminPanelMode && (
                      <td style={td}>
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 10px', borderRadius: 20,
                          fontSize: 11, fontWeight: 700,
                          background: 'rgba(99,102,241,0.08)', color: '#4338ca',
                          border: '1px solid rgba(99,102,241,0.18)'
                        }}>
                          🏫 {s._schoolName || '—'}
                        </span>
                      </td>
                    )}
                    <td style={td}>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{s.name || '-'}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Kayıt: {trDate(s.regDate)}</div>
                    </td>
                    <td style={td}>{s.class || '-'}</td>
                    <td style={td}>{s.parent || '-'}</td>
                    <td style={td}>{s.phone || '-'}</td>
                    <td style={td}>{s.tax || '-'}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{money(expectedTotalFor(state, s.id))}</td>
                    <td style={{
                      ...td, textAlign: 'right', fontWeight: 700,
                      color: bal > 0 ? '#ef4444' : '#10b981'
                    }}>{money(bal)}</td>
                    <td style={td}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                        {s.active
                          ? <span style={statusOk}>Aktif</span>
                          : <span style={statusBad}>Pasif</span>}
                        {s.invoiced !== false ? (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
                            background: '#e0e7ff', color: '#3730a3', border: '1px solid #c7d2fe'
                          }}>
                            🧾 Faturalı
                          </span>
                        ) : (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
                            background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0'
                          }}>
                            ⚪ Faturasız
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button onClick={() => { setFileTab('info'); openFile(s.id) }} style={{
                          ...Btn, background: '#f1f5f9', color: '#0f172a'
                        }}>Dosya</button>
                        {!isAdminPanelMode && (
                          <>
                            <button onClick={() => openForm(s)} style={{
                              ...Btn, background: '#eef2ff', color: '#4338ca'
                            }}>Düzenle</button>
                            <button onClick={() => handleDelete(s.id)} style={{
                              ...Btn, background: '#fee2e2', color: '#991b1b'
                            }}>Sil</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
          padding: 20
        }}>
          <div style={{
            background: '#fff', borderRadius: 18, width: modal === 'file' ? 'min(920px, 100%)' : 'min(640px, 100%)',
            maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
            boxShadow: '0 20px 50px rgba(15,23,42,0.25)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              padding: '18px 22px', borderBottom: '1px solid #e6ebf3',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>
                {modal === 'form'
                  ? (form?.id ? 'Öğrenci Bilgilerini Düzenle' : 'Yeni Öğrenci Kaydet')
                  : `Öğrenci Dosyası: ${getStudent(state, form?.id)?.name || ''}`}
              </h3>
              <button onClick={() => { setModal(null); setForm(null) }} style={{
                padding: '6px 10px', borderRadius: 8, border: 'none', background: '#f1f5f9',
                cursor: 'pointer', fontSize: 14, color: '#475569', fontWeight: 700
              }}>✕</button>
            </div>
            <div style={{ padding: 22, overflow: 'auto' }}>
              {modal === 'form' ? renderForm() : renderFile()}
            </div>
            <div style={{
              padding: '14px 22px', borderTop: '1px solid #e6ebf3',
              display: 'flex', justifyContent: 'flex-end', gap: 10,
              background: '#f8fafc'
            }}>
              {modal === 'form' && (
                <>
                  <button onClick={() => { setModal(null); setForm(null) }} style={{
                    ...Btn, background: '#fff', color: '#475569', border: '1px solid #cbd5e1'
                  }}>Vazgeç</button>
                  {!form?.id && (
                    <button onClick={saveFormAndNew} style={{
                      ...Btn, background: 'linear-gradient(135deg,#0891b2,#06b6d4)', color: '#fff',
                      boxShadow: '0 4px 12px rgba(8,145,178,0.2)'
                    }}>Kaydet ve Yeni</button>
                  )}
                  <button onClick={saveForm} style={{
                    ...Btn, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff',
                    boxShadow: '0 4px 12px rgba(99,102,241,0.25)'
                  }}>Kaydet</button>
                </>
              )}
              {modal === 'file' && (
                <>
                  <button onClick={() => { setModal(null); setForm(null) }} style={{
                    ...Btn, background: '#fff', color: '#475569', border: '1px solid #cbd5e1'
                  }}>Kapat</button>
                  <button onClick={() => {
                    const s = getStudent(state, form?.id); if (s) openForm(s)
                  }} style={{
                    ...Btn, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff'
                  }}>✏️ Düzenle</button>
                </>
              )}
            </div>
          </div>
        </div>
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
