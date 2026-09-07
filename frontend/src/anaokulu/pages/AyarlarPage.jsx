import React, { useState, useRef, useEffect } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAnaokuluData } from '../context/AnaokuluDataContext.jsx'
import { exportDataJSON, getYearStart, periodsOfYear, periodName, DEFAULT_YEAR_START, DEFAULT_PERIODS } from '../utils/calculations.js'

const Btn = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 14px', borderRadius: 10, fontWeight: 600,
  cursor: 'pointer', border: 'none', fontSize: 13
}

const InputCls = {
  padding: '9px 12px', borderRadius: 10,
  border: '1px solid #cbd5e1', background: '#fff',
  fontSize: 13, outline: 'none', width: '100%'
}

const LabelCls = {
  fontSize: 12, color: '#475569', fontWeight: 600,
  display: 'block', marginBottom: 6
}

const FieldCls = { marginBottom: 14 }

const genId = () => `id_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

export default function AyarlarPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const isUyeler = location.pathname.includes('/uyeler')

  const { state, actions } = useAnaokuluData()
  const s = state?.settings || {}
  const ys = getYearStart(state)

  const [form, setForm] = useState({
    school: s.school || s.okulAdi || '',
    vat: Number(s.vat ?? s.vergiOrani ?? 10),
    yearStart: s.yearStart || s.donem || ys || DEFAULT_YEAR_START,
    matchBy: s.matchBy || 'tax'
  })

  // Ücret kalemleri state
  const [feeCategories, setFeeCategories] = useState(
    Array.isArray(s.feeCategories) ? s.feeCategories : []
  )
  const [newFee, setNewFee] = useState({ name: '', defaultPrice: 0, invoiced: true })

  // Luca e-Fatura Ayarları state — backend yüklenince useEffect ile senkronize edilir
  const [lucaSettings, setLucaSettings] = useState({ tckn: '', password: '' })
  const [lucaUserEdited, setLucaUserEdited] = useState(false)

  // Backend'den veri geldiğinde (state.loaded olduğunda) formu güncelle
  useEffect(() => {
    if (lucaUserEdited) return // Kullanıcı form ile uğraşıyorsa override etme
    const tckn = s?.luca?.tckn || s?.luca?.username || s?.luca?.customerNo || ''
    const password = s?.luca?.password || ''
    if (tckn || password) {
      setLucaSettings({ tckn, password })
    }
  }, [s?.luca?.tckn, s?.luca?.username, s?.luca?.customerNo, s?.luca?.password])

  // İndirimler state
  const [discounts, setDiscounts] = useState(
    Array.isArray(s.discounts) ? s.discounts : []
  )
  const [newDiscount, setNewDiscount] = useState({ name: '', type: 'percent', value: 0 })

  const [activeTab, setActiveTab] = useState('genel')
  const [toastMsg, setToastMsg] = useState('')
  const fileRef = useRef(null)

  const toast = (m) => { setToastMsg(m); setTimeout(() => setToastMsg(''), 3000) }

  const upd = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const saveAll = () => {
    const next = {
      school: String(form.school || '').trim() || 'Anaokulu',
      okulAdi: String(form.school || '').trim() || 'Anaokulu',
      vat: Number(form.vat) || 0,
      vergiOrani: Number(form.vat) || 0,
      yearStart: form.yearStart || DEFAULT_YEAR_START,
      donem: form.yearStart || DEFAULT_YEAR_START,
      matchBy: form.matchBy || 'tax',
      feeCategories,
      discounts,
      luca: { tckn: lucaSettings.tckn, password: lucaSettings.password }
    }
    actions.updateSettings(next)
    toast('Ayarlar kaydedildi.')
  }

  const addFeeCategory = () => {
    if (!newFee.name.trim()) { toast('Kalem adı boş olamaz.'); return }
    const updated = [
      ...feeCategories,
      {
        id: genId(),
        name: newFee.name.trim(),
        defaultPrice: Number(newFee.defaultPrice) || 0,
        invoiced: newFee.invoiced !== false
      }
    ]
    setFeeCategories(updated)
    setNewFee({ name: '', defaultPrice: 0, invoiced: true })
    actions.updateSettings({ ...s, feeCategories: updated })
    toast('Ücret kalemi eklendi.')
  }

  const removeFeeCategory = (id) => {
    const updated = feeCategories.filter(f => f.id !== id)
    setFeeCategories(updated)
    actions.updateSettings({ ...s, feeCategories: updated })
    toast('Kalem silindi.')
  }

  const updateFeeCategory = (id, field, val) => {
    const updated = feeCategories.map(f => {
      if (f.id !== id) return f
      let finalVal = val
      if (field === 'defaultPrice') finalVal = Number(val) || 0
      if (field === 'invoiced') finalVal = val === '1' || val === true
      return { ...f, [field]: finalVal }
    })
    setFeeCategories(updated)
  }

  const saveFeeCategories = () => {
    actions.updateSettings({ ...s, feeCategories })
    toast('Ücret kalemleri kaydedildi.')
  }

  const saveLucaSettings = () => {
    actions.updateSettings({ ...s, luca: { tckn: lucaSettings.tckn, password: lucaSettings.password } })
    toast('✓ TÜRMOB Luca e-Fatura ayarları kaydedildi.')
  }

  const addDiscount = () => {
    if (!newDiscount.name.trim()) { toast('İndirim adı boş olamaz.'); return }
    const updated = [...discounts, { id: genId(), name: newDiscount.name.trim(), type: newDiscount.type, value: Number(newDiscount.value) || 0 }]
    setDiscounts(updated)
    setNewDiscount({ name: '', type: 'percent', value: 0 })
    actions.updateSettings({ ...s, discounts: updated })
    toast('İndirim eklendi.')
  }

  const removeDiscount = (id) => {
    const updated = discounts.filter(d => d.id !== id)
    setDiscounts(updated)
    actions.updateSettings({ ...s, discounts: updated })
    toast('İndirim silindi.')
  }

  const updateDiscount = (id, field, val) => {
    const updated = discounts.map(d => d.id === id ? { ...d, [field]: field === 'value' ? Number(val) || 0 : val } : d)
    setDiscounts(updated)
  }

  const saveDiscounts = () => {
    actions.updateSettings({ ...s, discounts })
    toast('İndirimler kaydedildi.')
  }

  const handleImportJSON = (e) => {
    const f = e.target.files && e.target.files[0]
    if (!f) return
    const r = new FileReader()
    r.onload = () => {
      try {
        const d = JSON.parse(r.result)
        if (!d || !Array.isArray(d.students)) throw new Error('students eksik')
        const payload = {
          settings: d.settings || {},
          students: d.students || [],
          collections: d.collections || [],
          invoices: d.invoices || [],
          checks: d.checks || []
        }
        actions.replaceAll(payload)
        toast('Veriler içe aktarıldı.')
      } catch {
        toast('Geçersiz yedek dosyası.')
      }
      e.target.value = ''
    }
    r.readAsText(f)
  }

  const panel = {
    background: '#fff', borderRadius: 14, border: '1px solid #e6ebf3',
    boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
    padding: '18px 22px', marginBottom: 16
  }
  const h3 = { margin: '0 0 14px 0', fontSize: 16, fontWeight: 700, color: '#0f172a' }
  const th = { padding: '10px 12px', fontSize: 12, fontWeight: 700, color: '#475569', background: '#f8fafc', borderBottom: '1px solid #e6ebf3', textAlign: 'left' }
  const td = { padding: '10px 12px', fontSize: 13, borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' }
  const tbl = { width: '100%', borderCollapse: 'collapse' }

  const tabs = [
    { key: 'genel', label: '🏫 Genel' },
    { key: 'ucretler', label: '💰 Ücret Kalemleri' },
    { key: 'indirimler', label: '🏷️ İndirimler' },
    { key: 'luca', label: '🧾 TÜRMOB Luca e-Fatura' },
    { key: 'veri', label: '💾 Veri' }
  ]

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: '0 0 4px 0', fontSize: 24, color: '#0f172a' }}>⚙️ Ayarlar</h2>
        <p style={{ margin: 0, color: '#475569', fontSize: 14 }}>
          Okul, vergi, ücret kalemleri ve indirim parametreleri
        </p>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', borderBottom: '2px solid #e6ebf3', paddingBottom: 0 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => {
            if (isUyeler) navigate('/anaokulu/ayarlar')
            setActiveTab(t.key)
          }} style={{
            padding: '10px 16px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
            background: 'transparent', borderRadius: '8px 8px 0 0',
            borderBottom: (!isUyeler && activeTab === t.key) ? '2px solid #6366f1' : '2px solid transparent',
            color: (!isUyeler && activeTab === t.key) ? '#6366f1' : '#64748b',
            marginBottom: -2
          }}>{t.label}</button>
        ))}

        <NavLink to="/anaokulu/ayarlar/uyeler" style={({ isActive }) => ({
          padding: '10px 16px', textDecoration: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
          background: 'transparent', borderRadius: '8px 8px 0 0',
          borderBottom: isActive ? '2px solid #6366f1' : '2px solid transparent',
          color: isActive ? '#6366f1' : '#64748b',
          marginBottom: -2, display: 'inline-flex', alignItems: 'center'
        })}>👤 Üyeler</NavLink>
      </div>

      {isUyeler ? (
        <Outlet />
      ) : (
        <>

      {/* Genel Ayarlar */}
      {activeTab === 'genel' && (
        <div style={panel}>
          <h3 style={h3}>🏫 Okul &amp; Vergi</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            <div style={FieldCls}>
              <label style={LabelCls}>Okul Adı</label>
              <input style={InputCls} placeholder="Gül Anaokulu"
                value={form.school} onChange={e => upd('school', e.target.value)} />
            </div>
            <div style={FieldCls}>
              <label style={LabelCls}>Varsayılan KDV (%)</label>
              <input style={InputCls} type="number" min="0" max="100" step="0.1"
                value={form.vat} onChange={e => upd('vat', Number(e.target.value) || 0)} />
            </div>
            <div style={FieldCls}>
              <label style={LabelCls}>Eğitim Yılı Başlangıcı</label>
              <select style={InputCls} value={form.yearStart}
                onChange={e => upd('yearStart', e.target.value)}>
                {DEFAULT_PERIODS.map(p => (
                  <option key={p} value={p}>{p} ({p.split('-')[0]} - {Number(p.split('-')[0]) + 1} Eğitim Yılı)</option>
                ))}
              </select>
            </div>
            <div style={FieldCls}>
              <label style={LabelCls}>Fatura Eşleştirme Kriteri</label>
              <select style={InputCls} value={form.matchBy}
                onChange={e => upd('matchBy', e.target.value)}>
                <option value="student">Öğrenci Adı (Önerilen - Faturalar Öğrenciye Kesiliyorsa)</option>
                <option value="tax">TCKN / VKN Öncelikli (Bulunamazsa Veli Adı)</option>
                <option value="parent">Yalnızca Veli Adı</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: 20, textAlign: 'right' }}>
            <button onClick={saveAll} style={{
              ...Btn, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff',
              boxShadow: '0 4px 12px rgba(99,102,241,0.25)'
            }}>💾 Ayarları Kaydet</button>
          </div>
        </div>
      )}

      {/* Ücret Kalemleri */}
      {activeTab === 'ucretler' && (
        <div style={panel}>
          <h3 style={h3}>💰 Ücret Kalemleri</h3>
          <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 16px 0' }}>
            Öğrencilere atayabileceğiniz ücret kalemlerini, varsayılan fiyatlarını ve <strong>fatura durumlarını</strong> buradan tanımlayın.
          </p>

          <div style={{
            background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10,
            padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#475569'
          }}>
            ℹ️ <strong>Kural:</strong> "Faturasız" olarak işaretlenen ücret kalemlerinin tahsilatı yapıldığında, öğrenci faturalı olsa dahi Faturalar sayfasına yansımaz.
          </div>

          {/* Mevcut Kalemler */}
          <div style={{ marginBottom: 20, overflowX: 'auto' }}>
            <table style={tbl}>
              <thead>
                <tr>
                  <th style={th}>Kalem Adı</th>
                  <th style={{ ...th, width: 180 }}>Varsayılan Fiyat (₺)</th>
                  <th style={{ ...th, width: 200 }}>Fatura Durumu</th>
                  <th style={{ ...th, width: 80, textAlign: 'center' }}>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {feeCategories.length === 0 ? (
                  <tr><td colSpan={4} style={{ ...td, textAlign: 'center', color: '#94a3b8', padding: '24px 12px' }}>
                    Henüz ücret kalemi eklenmedi.
                  </td></tr>
                ) : feeCategories.map(fc => (
                  <tr key={fc.id}>
                    <td style={td}>
                      <input style={{ ...InputCls, width: '100%' }} value={fc.name}
                        onChange={e => updateFeeCategory(fc.id, 'name', e.target.value)} />
                    </td>
                    <td style={td}>
                      <input style={{ ...InputCls, width: '100%' }} type="number" step="0.01" value={fc.defaultPrice}
                        onChange={e => updateFeeCategory(fc.id, 'defaultPrice', e.target.value)} />
                    </td>
                    <td style={td}>
                      <select
                        style={{ ...InputCls, width: '100%', fontWeight: 700 }}
                        value={fc.invoiced !== false ? '1' : '0'}
                        onChange={e => updateFeeCategory(fc.id, 'invoiced', e.target.value)}
                      >
                        <option value="1">🟢 Faturalı</option>
                        <option value="0">⚪ Faturasız</option>
                      </select>
                    </td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      <button onClick={() => removeFeeCategory(fc.id)} style={{
                        ...Btn, background: '#fee2e2', color: '#991b1b', padding: '6px 10px'
                      }}>🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Yeni Kalem Ekle */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 150px 180px auto', gap: 10,
            alignItems: 'flex-end', padding: '14px', background: '#f8fafc', borderRadius: 10
          }}>
            <div>
              <label style={LabelCls}>Kalem Adı *</label>
              <input style={InputCls} placeholder="Örn: Servis" value={newFee.name}
                onChange={e => setNewFee({ ...newFee, name: e.target.value })} />
            </div>
            <div>
              <label style={LabelCls}>Varsayılan Fiyat (₺)</label>
              <input style={InputCls} type="number" step="0.01" value={newFee.defaultPrice}
                onChange={e => setNewFee({ ...newFee, defaultPrice: Number(e.target.value) || 0 })} />
            </div>
            <div>
              <label style={LabelCls}>Fatura Durumu</label>
              <select
                style={{ ...InputCls, fontWeight: 700 }}
                value={newFee.invoiced !== false ? '1' : '0'}
                onChange={e => setNewFee({ ...newFee, invoiced: e.target.value === '1' })}
              >
                <option value="1">🟢 Faturalı</option>
                <option value="0">⚪ Faturasız</option>
              </select>
            </div>
            <button onClick={addFeeCategory} style={{
              ...Btn, background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff',
              padding: '9px 14px', alignSelf: 'flex-end'
            }}>+ Ekle</button>
          </div>

          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <button onClick={saveFeeCategories} style={{
              ...Btn, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff',
              boxShadow: '0 4px 12px rgba(99,102,241,0.25)'
            }}>💾 Kalemleri Kaydet</button>
          </div>
        </div>
      )}

      {/* İndirimler */}
      {activeTab === 'indirimler' && (
        <div style={panel}>
          <h3 style={h3}>🏷️ İndirim Tanımları</h3>
          <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 16px 0' }}>
            Ücret kalemi eklerken seçilebilecek indirimleri buradan tanımlayın.
            (Yüzde veya sabit tutar olarak belirleyebilirsiniz.)
          </p>

          <div style={{ marginBottom: 20, overflowX: 'auto' }}>
            <table style={tbl}>
              <thead>
                <tr>
                  <th style={th}>İndirim Adı</th>
                  <th style={th}>Tür</th>
                  <th style={th}>Değer</th>
                  <th style={{ ...th, width: 80 }}>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {discounts.length === 0 ? (
                  <tr><td colSpan={4} style={{ ...td, textAlign: 'center', color: '#94a3b8', padding: '24px 12px' }}>
                    Henüz indirim tanımlanmadı.
                  </td></tr>
                ) : discounts.map(d => (
                  <tr key={d.id}>
                    <td style={td}>
                      <input style={{ ...InputCls, width: '100%' }} value={d.name}
                        onChange={e => updateDiscount(d.id, 'name', e.target.value)} />
                    </td>
                    <td style={td}>
                      <select style={{ ...InputCls, width: 130 }} value={d.type}
                        onChange={e => updateDiscount(d.id, 'type', e.target.value)}>
                        <option value="percent">Yüzde (%)</option>
                        <option value="fixed">Sabit (₺)</option>
                      </select>
                    </td>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input style={{ ...InputCls, width: 100 }} type="number" step="0.01" value={d.value}
                          onChange={e => updateDiscount(d.id, 'value', e.target.value)} />
                        <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                          {d.type === 'percent' ? '%' : '₺'}
                        </span>
                      </div>
                    </td>
                    <td style={td}>
                      <button onClick={() => removeDiscount(d.id)} style={{
                        ...Btn, background: '#fee2e2', color: '#991b1b', padding: '6px 10px'
                      }}>🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Yeni İndirim Ekle */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 140px 140px auto', gap: 10,
            alignItems: 'flex-end', padding: '14px', background: '#f8fafc', borderRadius: 10
          }}>
            <div>
              <label style={LabelCls}>İndirim Adı *</label>
              <input style={InputCls} placeholder="Örn: Kardeş İndirimi" value={newDiscount.name}
                onChange={e => setNewDiscount({ ...newDiscount, name: e.target.value })} />
            </div>
            <div>
              <label style={LabelCls}>Tür</label>
              <select style={InputCls} value={newDiscount.type}
                onChange={e => setNewDiscount({ ...newDiscount, type: e.target.value })}>
                <option value="percent">Yüzde (%)</option>
                <option value="fixed">Sabit (₺)</option>
              </select>
            </div>
            <div>
              <label style={LabelCls}>Değer</label>
              <input style={InputCls} type="number" step="0.01" value={newDiscount.value}
                onChange={e => setNewDiscount({ ...newDiscount, value: Number(e.target.value) || 0 })} />
            </div>
            <button onClick={addDiscount} style={{
              ...Btn, background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff',
              padding: '9px 14px', alignSelf: 'flex-end'
            }}>+ Ekle</button>
          </div>

          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <button onClick={saveDiscounts} style={{
              ...Btn, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff',
              boxShadow: '0 4px 12px rgba(99,102,241,0.25)'
            }}>💾 İndirimleri Kaydet</button>
          </div>
        </div>
      )}

      {/* TÜRMOB Luca e-Fatura Entegrasyonu */}
      {activeTab === 'luca' && (
        <div style={panel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div>
              <h3 style={{ ...h3, margin: '0 0 4px 0' }}>🧾 TÜRMOB Luca e-Fatura Entegrasyonu</h3>
              <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
                TÜRMOB Luca e-Fatura portalı üzerinden kesilen e-Fatura ve e-Arşiv faturalarını sistemle senkronize edin.
              </p>
            </div>
            <a
              href="https://turmobefatura.luca.com.tr/Account/Login"
              target="_blank"
              rel="noreferrer"
              style={{
                ...Btn,
                background: 'linear-gradient(135deg,#0284c7,#0369a1)',
                color: '#fff',
                textDecoration: 'none',
                boxShadow: '0 4px 12px rgba(2,132,199,0.25)'
              }}
            >
              🔗 Luca Portalına Git ↗
            </a>
          </div>

          <div style={{
            background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 12,
            padding: '14px 16px', marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center'
          }}>
            <span style={{ fontSize: 24 }}>💡</span>
            <div style={{ fontSize: 13, color: '#0369a1' }}>
              <strong>Luca e-Fatura Portalı:</strong> <code>https://turmobefatura.luca.com.tr</code><br/>
              Giriş bilgilerinizi tanımlayarak Faturalar sayfasından faturalarınızı doğrudan kontrol edebilir ve otomatik tahsilat eşleştirmesi yapabilirsiniz.
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 20 }}>
            <div style={FieldCls}>
              <label style={LabelCls}>TCKN (TC Kimlik Numarası) *</label>
              <input
                style={InputCls}
                placeholder="11 haneli TC Kimlik Numaranız"
                maxLength={11}
                value={lucaSettings.tckn}
                onChange={e => { setLucaUserEdited(true); setLucaSettings({ ...lucaSettings, tckn: e.target.value.replace(/\D/g, '').slice(0, 11) }) }}
              />
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Luca portalına giriş için kullandığınız TC Kimlik No</div>
            </div>
            <div style={FieldCls}>
              <label style={LabelCls}>Şifre *</label>
              <input
                style={InputCls}
                type="password"
                placeholder="••••••••"
                value={lucaSettings.password}
                onChange={e => { setLucaUserEdited(true); setLucaSettings({ ...lucaSettings, password: e.target.value }) }}
              />
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Luca portalı giriş şifreniz</div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid #e6ebf3', paddingTop: 16 }}>
            <button
              type="button"
              onClick={() => {
                if (!lucaSettings.tckn || !lucaSettings.password) {
                  toast('⚠️ Lütfen TCKN ve Şifre alanlarını doldurunuz.')
                  return
                }
                toast('✓ Bilgiler geçerli görünüyor. Faturalar sayfasından "Faturaları Kontrol Et" ile test edebilirsiniz.')
              }}
              style={{
                ...Btn, background: '#f8fafc', color: '#0369a1', border: '1px solid #bae6fd'
              }}
            >
              ⚡ Bağlantıyı Test Et
            </button>
            <button
              type="button"
              onClick={saveLucaSettings}
              style={{
                ...Btn, background: 'linear-gradient(135deg,#0284c7,#0369a1)', color: '#fff',
                boxShadow: '0 4px 12px rgba(2,132,199,0.25)'
              }}
            >
              💾 Luca Ayarlarını Kaydet
            </button>
          </div>
        </div>
      )}

      {/* Veri */}
      {activeTab === 'veri' && (
        <div style={panel}>
          <h3 style={h3}>💾 Veri</h3>
          <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 14px 0' }}>
            Tüm veriler (öğrenci, taksit, tahsilat, fatura) sunucu tarafında tenant bazlı saklanır.
            Yedek almak veya başka bir ortama taşımak için dışa aktarın.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={() => { exportDataJSON(state); toast('Yedek indirildi.') }} style={{
              ...Btn, background: 'linear-gradient(135deg,#0891b2,#06b6d4)', color: '#fff',
              boxShadow: '0 4px 12px rgba(8,145,178,0.25)'
            }}>⬇ Verileri dışa aktar (JSON)</button>
            <button onClick={() => fileRef.current?.click()} style={{
              ...Btn, background: '#f1f5f9', color: '#0f172a'
            }}>⬆ Verileri içe aktar</button>
            <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }}
              onChange={handleImportJSON} />
            <span style={{ fontSize: 12, color: '#94a3b8', alignSelf: 'center' }}>
              {state.saving ? '⏳ Kaydediliyor...' : '✓ Son değişiklikler: otomatik kaydedildi'}
            </span>
          </div>
        </div>
      )}
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
