import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/apiClient.js'
import { toast } from '../../lib/toast.js'
import { useAuth } from '../../context/AuthContext.jsx'
import TopluAlacakRaporu from './TopluAlacakRaporu.jsx'

const INPUT_STYLE = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 10,
  border: '1.5px solid #e2e8f0',
  fontSize: 14,
  outline: 'none',
  background: '#fff',
  color: '#0f172a',
  boxSizing: 'border-box'
}

const LABEL_STYLE = { fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4, display: 'block' }

export default function RegionAdminOkullarimPage() {
  const { user, accessibleTenants, regionCurrentTenantId, setRegionCurrentTenantId, refresh } = useAuth()
  const navigate = useNavigate()

  const [pageTab, setPageTab] = useState('okullarim')
  const [schools, setSchools] = useState([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState('')

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    ownerName: '',
    ownerEmail: '',
    ownerPassword: ''
  })

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const results = await Promise.all(
          (accessibleTenants || []).map(async (t) => {
            try {
              const res = await api('/api/anaokulu/', {
                portalOverride: 'anaokulu',
                params: { tenantId: t.id },
                headers: { 'X-Tenant-Id': t.id },
                silent: true
              })
              return { ...t, detail: res?.ok !== false ? res : null }
            } catch {
              return { ...t, detail: null }
            }
          })
        )
        setSchools(results)
      } catch {
        setSchools(accessibleTenants || [])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [accessibleTenants])

  const handleSelectSchool = (schoolId) => {
    setRegionCurrentTenantId(schoolId)
    navigate('/anaokulu/genel-bakis')
  }

  const handleCreateSubmit = async (e) => {
    e.preventDefault()
    setCreateLoading(true)
    setCreateError('')
    try {
      if (!form.name.trim()) throw new Error('Okul adı zorunludur')
      if (!form.ownerEmail.trim()) throw new Error('Yönetici e-postası zorunludur')
      if (!form.ownerPassword || form.ownerPassword.length < 6) throw new Error('Şifre en az 6 karakter olmalıdır')

      const res = await api('/api/platform/region-admin/create-school', {
        method: 'POST',
        data: {
          name: form.name.trim(),
          email: form.email.trim() || form.ownerEmail.trim(),
          phone: form.phone ? form.phone.trim() : '',
          ownerPhone: form.phone ? form.phone.trim() : '',
          address: form.address.trim(),
          ownerName: form.ownerName.trim() || form.name.trim(),
          ownerEmail: form.ownerEmail.trim(),
          ownerPassword: form.ownerPassword,
          systemType: 'anaokulu'
        },
        portalOverride: 'anaokulu'
      })

      if (!res?.ok && res?.success !== true) {
        throw new Error(res?.message || res?.error || 'Okul oluşturulamadı')
      }

      const newTenantId = res?.tenantId || res?.tenant?.id || res?.tenant?._id || res?.id
      if (newTenantId) {
        setRegionCurrentTenantId(String(newTenantId))
      }

      toast.success('Yeni anaokulu başarıyla oluşturuldu!')
      setCreateOpen(false)
      setForm({ name: '', email: '', phone: '', address: '', ownerName: '', ownerEmail: '', ownerPassword: '' })
      if (typeof refresh === 'function') {
        await refresh()
      }
    } catch (err) {
      setCreateError(err.message || 'Bir hata oluştu')
    } finally {
      setCreateLoading(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 20, maxWidth: pageTab === 'alacak-raporu' ? 1200 : 960 }}>
      {/* Sayfa Üst Sekmeleri */}
      <div style={{ display: 'flex', gap: 10, borderBottom: '2px solid #e2e8f0', paddingBottom: 0 }}>
        <button
          type="button"
          onClick={() => setPageTab('okullarim')}
          style={{
            padding: '12px 20px', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 800,
            background: 'transparent', borderRadius: '10px 10px 0 0',
            borderBottom: pageTab === 'okullarim' ? '3px solid #6366f1' : '3px solid transparent',
            color: pageTab === 'okullarim' ? '#6366f1' : '#64748b',
            marginBottom: -2, display: 'inline-flex', alignItems: 'center', gap: 8
          }}
        >
          🏫 Okullarım ({schools.length})
        </button>
        <button
          type="button"
          onClick={() => setPageTab('alacak-raporu')}
          style={{
            padding: '12px 20px', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 800,
            background: 'transparent', borderRadius: '10px 10px 0 0',
            borderBottom: pageTab === 'alacak-raporu' ? '3px solid #6366f1' : '3px solid transparent',
            color: pageTab === 'alacak-raporu' ? '#6366f1' : '#64748b',
            marginBottom: -2, display: 'inline-flex', alignItems: 'center', gap: 8
          }}
        >
          📊 Toplu Öğrenci Alacak Raporu (Excel)
        </button>
      </div>

      {pageTab === 'alacak-raporu' ? (
        <TopluAlacakRaporu initialSchools={schools} />
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Okullarim
              </h1>
              <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 14 }}>
                Yonetiminiz altindaki anaokulu ve kresleri goruntuleyin, secin veya yeni ekleyin.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '11px 20px', borderRadius: 12,
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: '#fff', border: 'none', cursor: 'pointer',
                fontWeight: 700, fontSize: 14,
                boxShadow: '0 6px 20px rgba(99,102,241,0.3)'
              }}
            >
              + Yeni Anaokulu Ekle
            </button>
          </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Toplam Okul', value: schools.length, color: '#6366f1' },
          { label: 'Aktif Secili', value: schools.filter(s => String(s.id) === String(regionCurrentTenantId)).length, color: '#10b981' }
        ].map(stat => (
          <div key={stat.label} style={{
            padding: '16px 24px', borderRadius: 14,
            background: '#fff', border: '1.5px solid #e2e8f0',
            boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
            display: 'flex', alignItems: 'center', gap: 14, minWidth: 160
          }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b', fontWeight: 600 }}>
          Okullar yukleniyor...
        </div>
      ) : schools.length === 0 ? (
        <div style={{
          padding: 48, textAlign: 'center', borderRadius: 18,
          background: '#fff', border: '2px dashed #e2e8f0'
        }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
            Henuz yonettiginiz okul yok
          </div>
          <div style={{ color: '#64748b', fontSize: 14, marginBottom: 20 }}>
            Platform yoneticisinden okul atamasi isteyebilir veya yeni okul ekleyebilirsiniz.
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            style={{
              padding: '12px 24px', borderRadius: 12,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: '#fff', border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: 14
            }}
          >
            + Ilk Anaokulunu Ekle
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {schools.map((school) => {
            const isActive = String(school.id) === String(regionCurrentTenantId)
            return (
              <div
                key={school.id}
                style={{
                  padding: 20, borderRadius: 16, background: '#fff',
                  border: '2px solid ' + (isActive ? '#6366f1' : '#e2e8f0'),
                  boxShadow: isActive ? '0 8px 30px rgba(99,102,241,0.15)' : '0 2px 10px rgba(0,0,0,0.04)',
                  transition: 'all 0.2s ease', cursor: 'pointer', position: 'relative'
                }}
                onClick={() => handleSelectSchool(school.id)}
              >
                {isActive && (
                  <div style={{
                    position: 'absolute', top: 12, right: 12,
                    padding: '3px 10px', borderRadius: 20,
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    color: '#fff', fontSize: 11, fontWeight: 800
                  }}>
                    AKTIF
                  </div>
                )}
                <div style={{
                  width: 52, height: 52, borderRadius: 14,
                  background: isActive ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : '#f1f5f9',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, marginBottom: 14
                }}>
                  🏫
                </div>
                <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a', marginBottom: 6 }}>
                  {school.name || 'Isimsiz Okul'}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  <span style={{
                    padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                    background: 'rgba(16, 185, 129, 0.1)', color: '#059669'
                  }}>
                    Anaokulu
                  </span>
                  {school.detail?.students?.length > 0 && (
                    <span style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: 'rgba(99, 102, 241, 0.08)', color: '#4f46e5'
                    }}>
                      {school.detail.students.length} Ogrenci
                    </span>
                  )}
                </div>
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleSelectSchool(school.id) }}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: 10,
                      background: isActive ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : '#f8fafc',
                      color: isActive ? '#fff' : '#475569',
                      border: '1.5px solid ' + (isActive ? 'transparent' : '#e2e8f0'),
                      cursor: 'pointer', fontWeight: 700, fontSize: 13
                    }}
                  >
                    {isActive ? 'Secili Okul' : 'Bu Okulu Sec'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
        </>
      )}

      {createOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: '#fff', borderRadius: 20, width: '100%', maxWidth: 560,
            maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 30px 80px rgba(15,23,42,0.25)', padding: 28
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>Yeni Anaokulu Ekle</div>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                  Yeni okul eklenince otomatik olarak yetkinize atanacak.
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setCreateOpen(false); setCreateError('') }}
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: '#f1f5f9', border: 'none', cursor: 'pointer',
                  fontSize: 20, lineHeight: 1
                }}
              >x</button>
            </div>

            {createError && (
              <div style={{
                padding: '10px 14px', borderRadius: 10, background: '#fef2f2',
                color: '#b91c1c', fontSize: 13, fontWeight: 600, marginBottom: 16
              }}>
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} style={{ display: 'grid', gap: 14 }}>
              <div style={{
                padding: '14px 16px', borderRadius: 12,
                background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.12)'
              }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#6366f1', marginBottom: 12 }}>
                  OKUL BILGILERI
                </div>
                <div style={{ display: 'grid', gap: 12 }}>
                  <label>
                    <span style={LABEL_STYLE}>Okul Adi *</span>
                    <input style={INPUT_STYLE} value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      placeholder="Ornek: Gunes Anaokulu" required />
                  </label>
                  <label>
                    <span style={LABEL_STYLE}>Okul E-posta</span>
                    <input type="email" style={INPUT_STYLE} value={form.email}
                      onChange={e => setForm({ ...form, email: e.target.value })}
                      placeholder="okul@ornek.com" />
                  </label>
                  <label>
                    <span style={LABEL_STYLE}>Telefon</span>
                    <input style={INPUT_STYLE} value={form.phone}
                      onChange={e => setForm({ ...form, phone: e.target.value })}
                      placeholder="05xx xxx xx xx" />
                  </label>
                  <label>
                    <span style={LABEL_STYLE}>Adres</span>
                    <input style={INPUT_STYLE} value={form.address}
                      onChange={e => setForm({ ...form, address: e.target.value })}
                      placeholder="Okul adresi" />
                  </label>
                </div>
              </div>

              <div style={{
                padding: '14px 16px', borderRadius: 12,
                background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.12)'
              }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#059669', marginBottom: 12 }}>
                  OKUL YONETICISI
                </div>
                <div style={{ display: 'grid', gap: 12 }}>
                  <label>
                    <span style={LABEL_STYLE}>Yonetici Ad Soyad</span>
                    <input style={INPUT_STYLE} value={form.ownerName}
                      onChange={e => setForm({ ...form, ownerName: e.target.value })}
                      placeholder="Ahmet Yilmaz" />
                  </label>
                  <label>
                    <span style={LABEL_STYLE}>Yonetici E-posta *</span>
                    <input type="email" style={INPUT_STYLE} value={form.ownerEmail}
                      onChange={e => setForm({ ...form, ownerEmail: e.target.value })}
                      placeholder="yonetici@okul.com" required />
                  </label>
                  <label>
                    <span style={LABEL_STYLE}>Giris Sifresi * (En az 6 karakter)</span>
                    <input type="password" style={INPUT_STYLE} value={form.ownerPassword}
                      onChange={e => setForm({ ...form, ownerPassword: e.target.value })}
                      placeholder="Sifre" required />
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                <button type="button"
                  onClick={() => { setCreateOpen(false); setCreateError('') }}
                  style={{
                    padding: '10px 20px', borderRadius: 10, background: '#f1f5f9',
                    color: '#475569', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14
                  }}>
                  Vazgec
                </button>
                <button type="submit" disabled={createLoading}
                  style={{
                    padding: '10px 24px', borderRadius: 10,
                    background: createLoading ? '#c7d2fe' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    color: '#fff', border: 'none',
                    cursor: createLoading ? 'not-allowed' : 'pointer',
                    fontWeight: 700, fontSize: 14
                  }}>
                  {createLoading ? 'Olusturuluyor...' : 'Anaokulu Olustur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
